#!/usr/bin/env python3
"""
英语单词学习网站 - Python 后端服务器
保护 API Key，支持 AI 问答功能

功能：
- 静态文件服务
- API 代理（保护 MiniMax API Key）
- 速率限制
- 请求日志

使用前配置：
1. 安装依赖: pip3 install flask requests
2. 复制配置文件: cp api_config.example.py api_config.py
3. 编辑 api_config.py，填入你的 API Key
"""

import os
import sys

# 添加当前目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入 API 配置
try:
    from api_config import MINIMAX_API_KEY as API_KEY, MINIMAX_API_URL, MINIMAX_MODEL, RATE_LIMIT
except ImportError:
    # 如果配置文件不存在，使用环境变量和默认值
    API_KEY = os.environ.get('MINIMAX_API_KEY', '')
    MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
    MINIMAX_MODEL = 'MiniMax-M2.1'
    # 默认速率限制配置
    RATE_LIMIT = {
        'requests_per_hour': 20,
        'cooldown_seconds': 5,
        'requests_per_day': 0,
        'requests_per_minute': 0,
    }

import json
import time
import logging
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory, make_response
from functools import wraps
import requests

# ========== 服务器配置 ==========

HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', '8082'))

# ========== Flask 应用 ==========

app = Flask(__name__)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 内存中的请求记录（生产环境建议用 Redis）
request_history = {}

# ========== 辅助函数 ==========

def check_rate_limit(client_ip):
    """检查速率限制"""
    now = datetime.now()
    
    if client_ip not in request_history:
        request_history[client_ip] = {
            'hourly': [],     # 每小时请求记录
            'daily': [],      # 每日请求记录
            'minute': [],     # 每分钟请求记录
        }
    
    # 清理过期记录
    hourly_cutoff = now - timedelta(hours=1)
    daily_cutoff = now - timedelta(days=1)
    minute_cutoff = now - timedelta(minutes=1)
    
    # 清理每小时记录
    request_history[client_ip]['hourly'] = [
        t for t in request_history[client_ip]['hourly'] 
        if datetime.fromtimestamp(t) > hourly_cutoff
    ]
    
    # 清理每日记录
    if RATE_LIMIT.get('requests_per_day', 0) > 0:
        request_history[client_ip]['daily'] = [
            t for t in request_history[client_ip]['daily'] 
            if datetime.fromtimestamp(t) > daily_cutoff
        ]
    
    # 清理每分钟记录
    if RATE_LIMIT.get('requests_per_minute', 0) > 0:
        request_history[client_ip]['minute'] = [
            t for t in request_history[client_ip]['minute'] 
            if datetime.fromtimestamp(t) > minute_cutoff
        ]
    
    # 检查每小时请求次数
    hourly_limit = RATE_LIMIT.get('requests_per_hour', 20)
    if hourly_limit > 0 and len(request_history[client_ip]['hourly']) >= hourly_limit:
        oldest = min(request_history[client_ip]['hourly'])
        reset_time = datetime.fromtimestamp(oldest) + timedelta(hours=1)
        logger.warning(f"速率限制触发 - IP: {client_ip}, 原因: 每小时请求超限")
        return False, f"请求过于频繁，请在 {reset_time.strftime('%H:%M:%S')} 后重试"
    
    # 检查每日请求次数
    daily_limit = RATE_LIMIT.get('requests_per_day', 0)
    if daily_limit > 0 and len(request_history[client_ip]['daily']) >= daily_limit:
        oldest = min(request_history[client_ip]['daily'])
        reset_time = datetime.fromtimestamp(oldest) + timedelta(days=1)
        logger.warning(f"速率限制触发 - IP: {client_ip}, 原因: 每日请求超限")
        return False, f"今日请求次数已达上限，请在 {reset_time.strftime('%Y-%m-%d %H:%M:%S')} 后重试"
    
    # 检查每分钟请求次数
    minute_limit = RATE_LIMIT.get('requests_per_minute', 0)
    if minute_limit > 0 and len(request_history[client_ip]['minute']) >= minute_limit:
        oldest = min(request_history[client_ip]['minute'])
        reset_time = datetime.fromtimestamp(oldest) + timedelta(minutes=1)
        logger.warning(f"速率限制触发 - IP: {client_ip}, 原因: 每分钟请求超限")
        return False, f"请求过于频繁，请在 {reset_time.strftime('%S')} 秒后重试"
    
    # 检查冷却时间
    cooldown = RATE_LIMIT.get('cooldown_seconds', 5)
    if cooldown > 0 and request_history[client_ip]['hourly']:
        last_request = max(request_history[client_ip]['hourly'])
        if (now - datetime.fromtimestamp(last_request)).total_seconds() < cooldown:
            logger.warning(f"速率限制触发 - IP: {client_ip}, 原因: 冷却时间未到")
            return False, f"请等待 {cooldown} 秒后重试"
    
    # 记录请求
    now_ts = now.timestamp()
    request_history[client_ip]['hourly'].append(now_ts)
    request_history[client_ip]['daily'].append(now_ts)
    request_history[client_ip]['minute'].append(now_ts)
    return True, "OK"

def call_minimax_api(question):
    """调用 MiniMax API"""
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {API_KEY}'
    }
    
    messages = [
        {
            'role': 'system',
            'content': '''You are an English learning assistant for primary school students. 
Help explain English words, sentences, and grammar in a clear and simple way.
Use Chinese to explain when helpful.
Format your response with clear structure using headings and bullet points.
Respond in Simplified Chinese with Chinese punctuation.'''
        },
        {
            'role': 'user',
            'content': question
        }
    ]
    
    data = {
        'model': MINIMAX_MODEL,
        'messages': messages,
        'temperature': 0.7,
        'max_tokens': 1000
    }
    
    try:
        response = requests.post(
            MINIMAX_API_URL,
            headers=headers,
            json=data,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        logger.error(f"MiniMax API HTTP 错误: {e}")
        error_data = e.response.json() if e.response else {}
        raise Exception(f"API 请求失败: {error_data.get('base_resp', {}).get('msg', str(e))}")
    except Exception as e:
        logger.error(f"MiniMax API 错误: {e}")
        raise Exception(f"API 请求失败: {str(e)}")

# ========== API 路由 ==========

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat_api():
    """AI 问答 API 代理"""
    
    # 处理 CORS 预检请求
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    
    # 获取客户端 IP
    client_ip = request.remote_addr or 'unknown'
    
    # 检查速率限制
    allowed, message = check_rate_limit(client_ip)
    if not allowed:
        logger.warning(f"速率限制触发 - IP: {client_ip}, 原因: {message}")
        response = jsonify({'error': message})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 429
    
    # 解析请求
    data = request.get_json()
    if not data or 'question' not in data:
        response = jsonify({'error': '请提供问题内容'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 400
    
    question = data['question'].strip()
    if not question:
        response = jsonify({'error': '问题不能为空'})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 400
    
    # 记录请求
    logger.info(f"API 请求 - IP: {client_ip}, 问题长度: {len(question)}")
    
    try:
        # 检查 API Key
        if not API_KEY:
            response = jsonify({
                'error': '服务器未配置 API Key',
                'help': '请设置环境变量 MINIMAX_API_KEY 或编辑 server.py'
            })
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response, 500
        
        # 调用 MiniMax API
        result = call_minimax_api(question)
        
        # 解析响应 - 尝试多种可能的格式
        answer = None
        
        # 格式1: OpenAI 兼容格式 choices[0].message.content
        if result.get('choices') and len(result['choices']) > 0:
            choice = result['choices'][0]
            if 'message' in choice:
                answer = choice.get('message', {}).get('content')
            elif 'delta' in choice:
                answer = choice.get('delta', {}).get('content')
            elif 'text' in choice:
                answer = choice.get('text')
        
        # 格式2: 直接返回文本
        if answer is None and 'text' in result:
            answer = result['text']
        
        # 格式3: base_resp 中可能包含文本
        if answer is None and result.get('base_resp'):
            answer = result['base_resp'].get('content') or result['base_resp'].get('text')
        
        if answer:
            response_data = {'answer': answer}
        else:
            logger.error(f"API 响应格式异常: {result}")
            raise Exception('API 响应格式错误，无法提取回答内容')
        
        logger.info(f"API 成功 - IP: {client_ip}")
        response = jsonify(response_data)
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
        
    except Exception as e:
        logger.error(f"API 错误 - IP: {client_ip}, 错误: {str(e)}")
        response = jsonify({'error': str(e)})
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response, 500

@app.route('/api/status', methods=['GET'])
def api_status():
    """API 状态检查"""
    return jsonify({
        'status': 'ok',
        'api_configured': bool(API_KEY),
        'rate_limit': RATE_LIMIT
    })

# ========== 静态文件服务 ==========

# 获取当前目录
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(CURRENT_DIR, '')

@app.route('/')
def index():
    """主页面"""
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    """静态文件服务"""
    return send_from_directory(STATIC_DIR, filename)

# ========== 启动服务器 ==========

def main():
    """启动服务器"""
    # 检查 API Key
    if not API_KEY:
        logger.warning("=" * 60)
        logger.warning("警告: 未配置 MiniMax API Key！")
        logger.warning("请设置环境变量: export MINIMAX_API_KEY='your-api-key'")
        logger.warning("或编辑 server.py 直接设置 API_KEY 变量")
        logger.warning("=" * 60)
    
    logger.info("=" * 60)
    logger.info("英语单词学习网站服务器")
    logger.info("=" * 60)
    logger.info(f"启动地址: http://localhost:{PORT}")
    logger.info(f"速率限制: {RATE_LIMIT['requests_per_hour']} 次/小时")
    logger.info(f"API Key: {'已配置' if API_KEY else '未配置'}")
    logger.info("=" * 60)
    logger.info("按 Ctrl+C 停止服务器")
    logger.info("=" * 60)
    
    app.run(host=HOST, port=PORT, debug=False)

if __name__ == '__main__':
    main()
