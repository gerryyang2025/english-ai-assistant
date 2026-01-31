#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LISTEN.md 格式检查工具
用于验证 LISTEN.md 文件的语法格式是否正确
运行方式：python check-listen-format.py [文件路径]
"""

import re
import sys
import os
from typing import List, Dict, Tuple, Optional


class ListenFormatChecker:
    """LISTEN.md 格式检查器"""
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.book_name: str = ''
        self.stats = {
            'total_speeches': 0,
            'valid_speeches': 0,
            'total_chapters': 0,
            'speeches_with_summary': 0
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
            if stripped.startswith('# ') and not stripped.startswith('## '):
                book_name = re.sub(r'^#\s*', '', stripped)
                self.book_name = book_name
                break
        
        current_speech = None
        current_chapter = None
        chapter_content = []
        is_first_chapter = True
        is_parsing_summary = False
        speech_index = 0
        
        for i in range(len(lines)):
            raw_line = lines[i]
            line = raw_line.strip()
            
            # 跳过空行
            if not line:
                continue
            
            # 跳过 JSON 示例代码块
            if line.startswith('```'):
                continue
            
            # 检测文章标题 (# 开头的行，且不是 ## 开头)
            if line.startswith('# ') and not line.startswith('## '):
                # 保存上一个听书材料
                if current_speech:
                    self.validate_speech(current_speech)
                
                speech_index += 1
                current_speech = {
                    'index': speech_index,
                    'line_number': i + 1,
                    'title_line': line,
                    'book_name': book_name,
                    'title': re.sub(r'^#\s*', '', line).strip(),
                    'summary': '',
                    'has_summary': False,
                    'chapters': []
                }
                self.stats['total_speeches'] += 1
                is_first_chapter = True
                is_parsing_summary = False
                chapter_content = []
                continue
            
            # 如果没有当前听书材料，跳过
            if not current_speech:
                continue
            
            # 检测章节 (## 开头)
            if line.startswith('## '):
                chapter_title = re.sub(r'^##\s*', '', line).strip()
                
                # 检查是否是文章概要
                if chapter_title == '文章概要':
                    # 保存上一个章节（如果有）
                    if not is_first_chapter and current_chapter:
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)
                        self.stats['total_chapters'] += 1
                    elif is_first_chapter and current_chapter and chapter_content:
                        # 第一个章节的情况
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)
                        self.stats['total_chapters'] += 1
                    
                    # 保存文章概要
                    if is_parsing_summary and chapter_content:
                        current_speech['summary'] = '\n'.join(chapter_content).strip()
                        current_speech['has_summary'] = bool(current_speech['summary'])
                    
                    # 重置状态，开始解析概要
                    is_parsing_summary = True
                    is_first_chapter = False
                    current_chapter = None
                    chapter_content = []
                else:
                    # 这是一个普通章节
                    # 如果之前在解析概要，先保存概要
                    if is_parsing_summary and chapter_content:
                        current_speech['summary'] = '\n'.join(chapter_content).strip()
                        current_speech['has_summary'] = bool(current_speech['summary'])
                    
                    # 保存上一个章节（如果有）
                    if not is_first_chapter and current_chapter:
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)
                        self.stats['total_chapters'] += 1
                    elif is_first_chapter and current_chapter and chapter_content:
                        # 第一个章节的情况
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)
                        self.stats['total_chapters'] += 1
                    
                    # 开始新章节
                    is_parsing_summary = False
                    current_chapter = {
                        'title': chapter_title,
                        'content': ''
                    }
                    chapter_content = []
                    is_first_chapter = False
                continue
            
            # 收集内容
            if is_parsing_summary:
                # 跳过空的行（文章概要标题后的第一个空行）
                if not chapter_content and not line:
                    continue
                chapter_content.append(raw_line)
            elif current_chapter:
                # 跳过空的行（章节标题后的第一个空行）
                if not chapter_content and not line:
                    continue
                chapter_content.append(raw_line)
        
        # 保存最后一个章节或概要
        if current_speech:
            if is_parsing_summary and chapter_content:
                current_speech['summary'] = '\n'.join(chapter_content).strip()
                current_speech['has_summary'] = bool(current_speech['summary'])
                if current_speech['has_summary']:
                    self.stats['speeches_with_summary'] += 1
            elif current_chapter:
                current_chapter['content'] = '\n'.join(chapter_content).strip()
                current_speech['chapters'].append(current_chapter)
                self.stats['total_chapters'] += 1
            
            # 如果是第一个章节（没有经过章节切换），也需要保存
            if is_first_chapter and current_chapter and current_chapter.get('content'):
                current_speech['chapters'].append(current_chapter)
                self.stats['total_chapters'] += 1
            
            self.validate_speech(current_speech)
    
    def validate_speech(self, speech: Dict):
        """验证单个听书材料"""
        title = speech.get('title', f"speech-{speech['index']}")
        
        # 检查是否有概要
        if speech.get('has_summary'):
            self.stats['speeches_with_summary'] += 1
        else:
            self.warnings.append(f"第 {speech['line_number']} 行 \"{title}\"：缺少文章概要 (## 文章概要)")
        
        # 检查是否有章节
        if not speech.get('chapters'):
            self.errors.append(f"第 {speech['line_number']} 行 \"{title}\"：缺少章节内容")
        
        # 验证章节格式
        for idx, chapter in enumerate(speech.get('chapters', [])):
            if not chapter.get('title'):
                self.errors.append(f"第 {speech['line_number']} 行 \"{title}\"：第 {idx + 1} 个章节缺少标题")
            if not chapter.get('content'):
                self.warnings.append(f"第 {speech['line_number']} 行 \"{title}\"：第 {idx + 1} 个章节 \"{chapter.get('title', '')}\" 缺少内容")
        
        self.stats['valid_speeches'] += 1
    
    def print_results(self) -> bool:
        """打印检查结果"""
        print('\n' + '=' * 60)
        print('🎧 LISTEN.md 格式检查报告')
        print('=' * 60)
        
        # 书本名称
        if self.book_name:
            print(f'\n📖 书本名称: {self.book_name}')
        
        # 统计信息
        print('\n📊 统计信息：')
        print(f"   - 听书材料总数：{self.stats['total_speeches']}")
        print(f"   - 有效听书材料：{self.stats['valid_speeches']}")
        print(f"   - 章节总数：{self.stats['total_chapters']}")
        print(f"   - 有概要的材料：{self.stats['speeches_with_summary']}")
        
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
            print('✅ 格式检查通过！所有听书材料格式正确。')
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
        listen_path = file_path or os.path.join(os.path.dirname(__file__), 'LISTEN.md')
        
        print('🔍 开始检查 LISTEN.md 格式...')
        print(f'📁 文件路径: {listen_path}')
        
        if not self.check_file_exists(listen_path):
            self.print_results()
            return False
        
        content = self.read_file(listen_path)
        if content is None:
            self.print_results()
            return False
        
        self.check_format(content)
        return self.print_results()


def main():
    """主函数"""
    checker = ListenFormatChecker()
    
    # 获取命令行参数
    args = sys.argv[1:]
    file_path = args[0] if args else None
    
    # 运行检查
    success = checker.run(file_path)
    
    # 退出码
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
