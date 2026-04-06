#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LISTEN.md 格式检查工具
用于验证 LISTEN.md 文件的语法格式是否正确

格式规则：
- 一级标题 # 书本名称 表示新书本
- 二级标题 ## 标题 可以是"文章概要"、"正文"、或其他任何章节名
- 二级标题下的内容都是该章节的内容

运行方式（在仓库根目录）：python3 scripts/check-listen-format.py [文件路径]
"""

import re
import sys
import os
from typing import List, Dict, Tuple, Optional

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.normpath(os.path.join(_SCRIPT_DIR, '..'))


class ListenFormatChecker:
    """LISTEN.md 格式检查器"""

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.books: List[Dict] = []
        self.stats = {
            'total_books': 0,
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
        """
        检查 LISTEN.md 格式

        格式规则：
        - 一级标题 # 书本名称 表示新书本
        - 二级标题 ## 标题 可以是"文章概要"、"正文"、或其他任何章节名
        - 二级标题下的内容都是该章节的内容
        """
        lines = content.split('\n')

        current_book = None
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

            # 跳过 HTML 注释和代码块
            if line.startswith('<!--') or line.startswith('```'):
                continue

            # 检测一级标题 # 书本名称 -> 新书开始
            if line.startswith('# ') and not line.startswith('## '):
                # 如果已有正在处理的书，先保存它
                if current_book and current_speech:
                    # 保存最后一个章节或概要
                    if is_parsing_summary and chapter_content:
                        current_speech['summary'] = '\n'.join(chapter_content).strip()
                        current_speech['has_summary'] = bool(current_speech['summary'])
                    elif current_chapter:
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)

                    # 添加到当前书的 speeches 列表
                    if current_speech.get('chapters'):
                        current_book['speeches'].append(current_speech)

                    # 收集统计信息
                    self.stats['total_speeches'] += 1
                    if current_speech.get('chapters'):
                        self.stats['valid_speeches'] += 1
                    if current_speech.get('has_summary'):
                        self.stats['speeches_with_summary'] += 1
                    self.stats['total_chapters'] += len(current_speech.get('chapters', []))

                # 添加到书籍列表
                if current_book and current_book.get('speeches'):
                    self.books.append(current_book)

                # 开始新书
                book_name = re.sub(r'^#\s*', '', line).strip()
                current_book = {
                    'name': book_name,
                    'line_number': i + 1,
                    'speeches': []
                }
                current_speech = None
                is_first_chapter = True
                is_parsing_summary = False
                current_chapter = None
                chapter_content = []
                continue

            if not current_book:
                continue

            # 如果还没有 currentSpeech，创建一个
            if not current_speech:
                speech_index += 1
                current_speech = {
                    'index': speech_index,
                    'line_number': i + 1,
                    'title': current_book['name'],
                    'summary': '',
                    'has_summary': False,
                    'chapters': []
                }

            # 检测二级标题 ## 标题 -> 新章节开始
            # 章节标题可以是"文章概要"、"正文"、或其他任何章节名
            if line.startswith('## '):
                chapter_title = re.sub(r'^##\s*', '', line).strip()

                # 检查是否是"文章概要"章节（特殊章节，用于存储文章摘要）
                if chapter_title == '文章概要':
                    # 保存上一个普通章节（如果有）
                    if not is_first_chapter and current_chapter:
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)
                    elif is_first_chapter and current_speech and current_chapter and chapter_content:
                        # 第一个章节的情况
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)

                    # 保存文章概要内容
                    if is_parsing_summary and chapter_content:
                        current_speech['summary'] = '\n'.join(chapter_content).strip()
                        current_speech['has_summary'] = bool(current_speech['summary'])

                    # 重置状态，开始解析文章概要
                    is_parsing_summary = True
                    is_first_chapter = False
                    current_chapter = None
                    chapter_content = []
                else:
                    # 这是一个普通章节（正文或其他章节）
                    # 如果之前在解析概要，先保存概要
                    if is_parsing_summary and chapter_content:
                        current_speech['summary'] = '\n'.join(chapter_content).strip()
                        current_speech['has_summary'] = bool(current_speech['summary'])

                    # 保存上一个章节（如果有）
                    if not is_first_chapter and current_chapter:
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)
                    elif is_first_chapter and current_speech and current_chapter and chapter_content:
                        # 第一个章节的情况
                        current_chapter['content'] = '\n'.join(chapter_content).strip()
                        current_speech['chapters'].append(current_chapter)

                    # 开始新章节
                    is_parsing_summary = False
                    current_chapter = {
                        'title': chapter_title,
                        'content': ''
                    }
                    chapter_content = []
                    is_first_chapter = False
                continue

            # 收集章节内容
            # 二级标题下的所有内容都属于该章节
            if is_parsing_summary:
                # 跳过章节标题后的第一个空行
                if not chapter_content and not line:
                    continue
                chapter_content.append(raw_line)
            elif current_chapter:
                # 跳过章节标题后的第一个空行
                if not chapter_content and not line:
                    continue
                chapter_content.append(raw_line)

        # 保存最后一个章节或概要
        if current_book and current_speech:
            if is_parsing_summary and chapter_content:
                current_speech['summary'] = '\n'.join(chapter_content).strip()
                current_speech['has_summary'] = bool(current_speech['summary'])
            elif current_chapter:
                current_chapter['content'] = '\n'.join(chapter_content).strip()
                current_speech['chapters'].append(current_chapter)

            # 如果是第一个章节（没有经过章节切换），也需要保存
            if is_first_chapter and current_chapter and current_chapter.get('content'):
                current_speech['chapters'].append(current_chapter)

            # 添加到当前书的 speeches 列表
            if current_speech.get('chapters'):
                current_book['speeches'].append(current_speech)

            # 收集统计信息
            self.stats['total_speeches'] += 1
            if current_speech.get('chapters'):
                self.stats['valid_speeches'] += 1
            if current_speech.get('has_summary'):
                self.stats['speeches_with_summary'] += 1
            self.stats['total_chapters'] += len(current_speech.get('chapters', []))

        # 添加最后一本书到列表
        if current_book and current_book.get('speeches'):
            self.books.append(current_book)

        # 更新书籍总数
        self.stats['total_books'] = len(self.books)

    def print_results(self) -> bool:
        """打印检查结果"""
        print('\n' + '=' * 60)
        print('🎧 LISTEN.md 格式检查报告')
        print('=' * 60)

        # 打印每本书的信息
        if self.books:
            print('\n📚 书本列表：')
            for idx, book in enumerate(self.books, 1):
                print(f'\n  【第 {idx} 本】{book["name"]}')
                print(f'    - 听书材料数：{len(book["speeches"])}')
                for speech in book['speeches']:
                    print(f'    - 章节数：{len(speech.get("chapters", []))}')

        # 统计信息
        print('\n📊 统计信息：')
        print(f"   - 书本总数：{self.stats['total_books']}")
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
        listen_path = file_path or os.path.join(_REPO_ROOT, 'data', 'LISTEN.md')
        
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
