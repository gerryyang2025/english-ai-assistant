#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
READINGS.md 格式检查工具
用于验证 READINGS.md 文件的语法格式是否正确
运行方式：python check-readings-format.py [文件路径]
"""

import re
import sys
import os
from typing import List, Dict, Tuple, Optional


class ReadingsFormatChecker:
    """READINGS.md 格式检查器"""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.book_name: str = ''
        self.stats = {
            'total_readings': 0,
            'valid_readings': 0,
            'total_dialogues': 0,
            'total_patterns': 0,
            'total_knowledge_points': 0
        }
    
    def check_file_exists(self, file_path: str) -> bool:
        """检查文件是否存在"""
        if not os.path.exists(file_path):
            self.errors.append(f"文件不存在: {file_path}")
            return False
        return True
    
    def read_file(self, file_path: str) -> Optional[str]:
        """读取文件内容"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            self.errors.append(f"读取文件失败: {e}")
            return None
    
    def check_format(self, content: str):
        """检查格式"""
        lines = content.split('\n')
        
        # 提取书本名称（第一个 # 标题）
        book_name = ''
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('# ') and not stripped.startswith('# 题目：') and \
               not stripped.startswith('# 场景：') and not stripped.startswith('# 重点句型') and \
               not stripped.startswith('# 知识点'):
                book_name = re.sub(r'^#\s*', '', stripped)
                self.book_name = book_name
                break
        
        # 当前单元名称
        current_unit_name = ''
        
        # 跳过注释部分，找到第一个题目行（支持两种格式：# 题目： 和 * 题目：）
        start_index = 0
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped.startswith('# 题目：') or stripped.startswith('* 题目：'):
                start_index = i
                break
        
        current_reading = None
        is_parsing_patterns = False
        is_parsing_knowledge_points = False
        reading_index = 0
        
        for i in range(start_index, len(lines)):
            raw_line = lines[i]
            line = raw_line.strip()
            
            # 跳过空行
            if not line:
                continue
            
            # 跳过 JSON 示例代码块
            if line.startswith('```'):
                continue
            
            # 检测单元标题行（## 开头的行）
            if line.startswith('## '):
                current_unit_name = re.sub(r'^##\s*', '', line)
                continue
            
            # 检测题目行（支持两种格式：# 题目： 和 * 题目：）
            if line.startswith('# 题目：') or line.startswith('* 题目：'):
                # 保存上一个阅读材料
                if current_reading:
                    self.validate_reading(current_reading)
                
                reading_index += 1
                current_reading = {
                    'index': reading_index,
                    'line_number': i + 1,
                    'title_line': line,
                    'book_name': book_name,
                    'unit_name': current_unit_name,
                    'has_scene': False,
                    'has_patterns': False,
                    'has_content': False,
                    'patterns': [],
                    'knowledge_points': [],
                    'dialogues': []
                }
                self.stats['total_readings'] += 1
                
                # 移除 # 或 * 前缀
                clean_line = re.sub(r'^[*#]\s*', '', line)
                
                # 解析标题
                title_match = re.match(r'题目：(.+?)\s*\(([^)]+)\)', clean_line)
                if title_match:
                    current_reading['title'] = title_match.group(1).strip()
                    current_reading['title_cn'] = title_match.group(2).strip()
                else:
                    self.errors.append(f"第 {i + 1} 行：标题格式错误，应为 \"* 题目：English Title (中文标题)\"")
                continue
            
            # 如果没有当前阅读材料，跳过
            if not current_reading:
                continue
            
            # 检测场景行（支持两种格式：# 场景： 和 * 场景：）
            if line.startswith('# 场景：') or line.startswith('* 场景：'):
                current_reading['has_scene'] = True
                scene_content = re.sub(r'^[*#]\s*场景：', '', line)
                current_reading['scene'] = scene_content.strip()
                if not current_reading['scene']:
                    self.warnings.append(f"第 {i + 1} 行：场景描述为空")
                continue
            
            # 检测重点句型行（支持多种格式）
            if (line.startswith('# 重点句型：') or line.startswith('# 重点句型') or 
                line.startswith('* 重点句型：') or line.startswith('* 重点句型')):
                is_parsing_patterns = True
                is_parsing_knowledge_points = False
                continue
            
            # 检测知识点行（支持多种格式）
            if (line.startswith('# 知识点：') or line.startswith('# 知识点') or 
                line.startswith('* 知识点：') or line.startswith('* 知识点')):
                is_parsing_patterns = False
                is_parsing_knowledge_points = True
                continue
            
            # 解析重点句型（缩进的 - 行）
            if raw_line.startswith('  - ') and is_parsing_patterns:
                current_reading['has_patterns'] = True
                pattern_line = line[2:].strip()  # 移除 "- " 前缀
                
                # 检查是否包含中文括号
                if '（' in pattern_line and '）' in pattern_line:
                    pattern_match = re.match(r'^(.+)（(.+)）$', pattern_line)
                    if pattern_match:
                        current_reading['patterns'].append({
                            'pattern': pattern_match.group(1).strip(),
                            'meaning': pattern_match.group(2).strip()
                        })
                        self.stats['total_patterns'] += 1
                    else:
                        self.warnings.append(f"第 {i + 1} 行：句型格式可能不正确")
                else:
                    # 没有中文翻译，保存为简单格式
                    current_reading['patterns'].append({
                        'pattern': pattern_line,
                        'meaning': ''
                    })
                    self.stats['total_patterns'] += 1
                continue
            
            # 解析知识点（缩进的 - 行）
            if raw_line.startswith('  - ') and is_parsing_knowledge_points:
                knowledge_point_line = line[2:].strip()  # 移除 "- " 前缀
                if knowledge_point_line:
                    current_reading['knowledge_points'].append(knowledge_point_line)
                    self.stats['total_knowledge_points'] += 1
                continue
            
            # 检测对话/正文行
            if ':' in line and ('（' in line or '(' in line):
                is_parsing_patterns = False
                is_parsing_knowledge_points = False
                current_reading['has_content'] = True
                
                # 尝试匹配全角括号格式
                dialogue_match = re.match(r'^([^:]+):\s*(.+?)\s*（([^）]+）)', line)
                if dialogue_match:
                    cn_translation = dialogue_match.group(3).strip()
                    cn_translation = cn_translation.rstrip('。')
                    
                    speaker_cn = cn_translation.split('：')[0] if '：' in cn_translation else cn_translation
                    
                    current_reading['dialogues'].append({
                        'speaker': dialogue_match.group(1).strip(),
                        'speaker_cn': speaker_cn,
                        'content': dialogue_match.group(2).strip(),
                        'content_cn': cn_translation
                    })
                    self.stats['total_dialogues'] += 1
                else:
                    # 尝试匹配半角括号格式
                    dialogue_match = re.match(r'^([^:]+):\s*(.+?)\s*\(([^)]+)\)', line)
                    if dialogue_match:
                        cn_translation = dialogue_match.group(3).strip()
                        cn_translation = cn_translation.rstrip('.')
                        
                        speaker_cn = cn_translation.split(':')[0] if ':' in cn_translation else cn_translation
                        
                        current_reading['dialogues'].append({
                            'speaker': dialogue_match.group(1).strip(),
                            'speaker_cn': speaker_cn,
                            'content': dialogue_match.group(2).strip(),
                            'content_cn': cn_translation
                        })
                        self.stats['total_dialogues'] += 1
                    else:
                        self.warnings.append(f"第 {i + 1} 行：对话格式不正确")
                continue
            
            # 结束句型/知识点解析
            if not raw_line.startswith('  '):
                is_parsing_patterns = False
                is_parsing_knowledge_points = False
        
        # 验证最后一个阅读材料
        if current_reading:
            self.validate_reading(current_reading)
    
    def validate_reading(self, reading: Dict):
        """验证单个阅读材料"""
        title = reading.get('title', f"reading-{reading['index']}")
        
        # 检查是否有场景描述
        if not reading['has_scene']:
            self.warnings.append(f"第 {reading['line_number']} 行 \"{title}\"：缺少场景描述 (# 场景：)")
        
        # 检查是否有内容
        if not reading['has_content']:
            self.warnings.append(f"第 {reading['line_number']} 行 \"{title}\"：缺少对话或正文内容")
        
        # 验证对话格式
        for idx, dialogue in enumerate(reading['dialogues']):
            if not dialogue.get('speaker'):
                self.errors.append(f"第 {reading['line_number']} 行 \"{title}\"：第 {idx + 1} 句缺少说话者")
            if not dialogue.get('content'):
                self.errors.append(f"第 {reading['line_number']} 行 \"{title}\"：第 {idx + 1} 句缺少英文内容")
            if not dialogue.get('content_cn'):
                self.errors.append(f"第 {reading['line_number']} 行 \"{title}\"：第 {idx + 1} 句缺少中文翻译")
        
        self.stats['valid_readings'] += 1
    
    def print_results(self) -> bool:
        """打印检查结果"""
        print('\n' + '=' * 60)
        print('📚 READINGS.md 格式检查报告')
        print('=' * 60)
        
        # 书本名称
        if self.book_name:
            print(f'\n📖 书本名称: {self.book_name}')
        
        # 统计信息
        print('\n📊 统计信息：')
        print(f"   - 阅读材料总数：{self.stats['total_readings']}")
        print(f"   - 有效阅读材料：{self.stats['valid_readings']}")
        print(f"   - 句型总数：{self.stats['total_patterns']}")
        print(f"   - 知识点总数：{self.stats['total_knowledge_points']}")
        print(f"   - 对话/正文总数：{self.stats['total_dialogues']}")
        
        # 错误
        if self.errors:
            print('\n❌ 错误 (必须修复)：')
            for idx, error in enumerate(self.errors, 1):
                print(f"   {idx}. {error}")
        
        # 警告
        if self.warnings:
            print('\n⚠️ 警告 (建议修复)：')
            for idx, warning in enumerate(self.warnings, 1):
                print(f"   {idx}. {warning}")
        
        # 总结
        print('\n' + '=' * 60)
        if not self.errors and not self.warnings:
            print('✅ 格式检查通过！所有阅读材料格式正确。')
            result = True
        elif not self.errors:
            print('⚠️ 格式检查完成，有警告但无错误。')
            result = True
        else:
            print('❌ 格式检查失败，请修复上述错误。')
            result = False
        print('=' * 60 + '\n')
        
        return result
    
    def run(self, file_path: str = None) -> bool:
        """运行检查"""
        readings_path = file_path or os.path.join(os.path.dirname(__file__), 'READINGS.md')
        
        print('🔍 开始检查 READINGS.md 格式...')
        print(f'📁 文件路径: {readings_path}')
        
        if not self.check_file_exists(readings_path):
            self.print_results()
            return False
        
        content = self.read_file(readings_path)
        if content is None:
            self.print_results()
            return False
        
        self.check_format(content)
        return self.print_results()


def main():
    """主函数"""
    checker = ReadingsFormatChecker()
    
    # 获取命令行参数
    args = sys.argv[1:]
    file_path = args[0] if args else None
    
    # 运行检查
    success = checker.run(file_path)
    
    # 退出码
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
