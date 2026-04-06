#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WORDS.md 格式检查工具
用于验证 WORDS.md 文件的语法格式是否正确
运行方式（在仓库根目录）：python3 scripts/check-words-format.py [文件路径]

注意：词条与例句等处禁止使用 Markdown 加粗 **...**，否则生成到听写练习时会要求用户输入 * 号，不合理。
"""

import re
import sys
import os
from typing import List, Dict, Optional

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.normpath(os.path.join(_SCRIPT_DIR, '..'))


class WordsFormatChecker:
    """WORDS.md 格式检查器"""
    
    # 词书名称到 ID 的映射（用于验证）
    BOOK_NAME_MAP = {
        '英语五年级上册': 'grade5-upper',
        '英语六年级上册': 'grade6-upper',
        '英语五年级下册': 'grade5-lower',
        '英语六年级下册': 'grade6-lower'
    }
    
    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.stats = {
            'total_books': 0,
            'valid_books': 0,
            'total_units': 0,
            'total_words': 0,
            'total_examples': 0,
            'total_memory_tips': 0
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
    
    def _check_markdown_bold_forbidden(self, lines: List[str]) -> None:
        """
        禁止使用 **...** 加粗。
        若词条或例句等含 **，转换后听写/输入会要求用户键入星号，与正常听写不符。
        """
        in_comment_block = False
        in_code_block = False
        for i, raw_line in enumerate(lines):
            line_stripped = raw_line.strip()
            if in_comment_block:
                if '-->' in raw_line:
                    in_comment_block = False
                continue
            if line_stripped.startswith('<!--'):
                in_comment_block = True
                continue
            if line_stripped.startswith('```'):
                in_code_block = not in_code_block
                continue
            if in_code_block:
                continue
            if '**' in raw_line:
                self.errors.append(
                    f"第 {i + 1} 行：禁止使用 Markdown 加粗 **...** "
                    f"(听写功能会按原文判题，用户不应输入 * 号；请去掉 ** 仅保留文字)"
                )

    def check_format(self, content: str):
        """检查格式"""
        lines = content.split('\n')
        self._check_markdown_bold_forbidden(lines)

        current_book = None
        current_unit = None
        current_word = None
        word_index = 0
        in_comment_block = False  # 是否在 <!-- ... --> 注释块内
        
        for i, raw_line in enumerate(lines):
            line = raw_line.strip()
            
            # 跳过 HTML 注释块：进入 <!-- 后直到 --> 之前都忽略
            if line.startswith('<!--'):
                in_comment_block = True
                continue
            if in_comment_block:
                if '-->' in line:
                    in_comment_block = False
                continue
            # 跳过独立的代码块标记行
            if line.startswith('```'):
                continue
            
            # 检测词书标题
            if raw_line.startswith('# '):
                # 保存上一个词书
                if current_book:
                    self.validate_book(current_book)
                
                book_name = line.replace('# ', '').replace('单词', '').strip()
                
                if '年级' not in book_name:
                    continue
                
                current_book = {
                    'index': self.stats['total_books'] + 1,
                    'line_number': i + 1,
                    'name': book_name,
                    'id': self.BOOK_NAME_MAP.get(book_name, book_name),
                    'has_valid_name': True,
                    'units': []
                }
                self.stats['total_books'] += 1
                current_unit = None
                current_word = None
                continue
            
            # 如果没有当前词书，跳过
            if not current_book:
                continue
            
            # 检测单元标题
            if raw_line.startswith('## '):
                # 保存上一个单词
                if current_word and current_unit:
                    self.validate_word(current_word, current_unit, current_book)
                    current_unit['words'].append(current_word)
                    word_index += 1
                current_word = None
                
                unit_match = re.match(r'##\s*(Unit\s*\d+)', line)
                if unit_match:
                    current_unit = {
                        'unit': unit_match[1],
                        'line_number': i + 1,
                        'title': '',
                        'category': '',
                        'has_title': False,
                        'words': []
                    }
                    current_book['units'].append(current_unit)
                    self.stats['total_units'] += 1
                    word_index = 0
                continue
            
            # 如果没有当前单元，跳过
            if not current_unit:
                continue
            
            # 检测 Title 行
            if raw_line.startswith('Title:'):
                title_match = re.match(r'Title:\s*(.+?)\s*Category:\s*(.+)', line)
                if title_match:
                    current_unit['title'] = title_match.group(1).strip()
                    current_unit['category'] = title_match.group(2).strip()
                    current_unit['has_title'] = True
                else:
                    self.warnings.append(f"第 {i + 1} 行：Title/Category 格式不正确，应为 \"Title:标题 Category:分类\"")
                continue
            
            # 检测详情行（缩进的 - 行）
            if raw_line.startswith('  - '):
                detail_content = line[2:].strip()  # 移除 "- " 前缀
                
                # 如果还没有当前单词数据，跳过
                if not current_word:
                    continue
                
                if detail_content.startswith('例句：'):
                    example_part = detail_content[3:]  # 移除 "例句："
                    example_match = re.match(r'^(.+?)\s*\(([^)]+)\)\s*$', example_part)
                    if example_match:
                        current_word['example'] = example_match.group(1).strip()
                        current_word['translation'] = example_match.group(2).strip()
                        self.stats['total_examples'] += 1
                    elif example_part.strip():
                        # 没有括号格式，保存原始内容
                        current_word['example'] = example_part.strip()
                        self.stats['total_examples'] += 1
                elif detail_content.startswith('记忆：'):
                    current_word['memory_tip'] = detail_content[3:].strip()
                    self.stats['total_memory_tips'] += 1
                continue
            
            # 检测单词行（以 * 开头但不是缩进的）
            if raw_line.startswith('* '):
                # 保存上一个单词
                if current_word and current_unit:
                    self.validate_word(current_word, current_unit, current_book)
                    current_unit['words'].append(current_word)
                    word_index += 1
                
                current_word = self.parse_word_line(line, i + 1, current_book, current_unit, word_index)
                if current_word:
                    self.stats['total_words'] += 1
                continue
        
        # 保存最后一个单词
        if current_word and current_unit:
            self.validate_word(current_word, current_unit, current_book)
            current_unit['words'].append(current_word)
            word_index += 1
        
        # 验证最后一个词书
        if current_book:
            self.validate_book(current_book)
    
    def parse_word_line(self, line: str, line_number: int, book, unit, index: int) -> Optional[Dict]:
        """解析单词行"""
        word_line = line[2:].strip()  # 移除 "* "
        
        # 先提取音标 /.../
        phonetic_match = re.search(r'/([^\/]+)/', word_line)
        phonetic = ''
        meaning = ''
        word = ''
        
        if phonetic_match:
            phonetic = '/' + phonetic_match.group(1) + '/'
            parts = word_line.split('/')
            if len(parts) >= 3:
                word = parts[0].strip()
                meaning = parts[2].strip()
            else:
                # 没有足够部分，使用空格分割
                word_match = re.match(r'^([^\s\/]+(?:\s+[^\s\/]+)?)', word_line)
                if word_match:
                    word = word_match[1].strip()
                    remaining = word_line[len(word_match[0]):].strip()
                    meaning = remaining
        else:
            # 没有音标
            word_match = re.match(r'^([^\s\/]+(?:\s+[^\s\/]+)?)', word_line)
            if not word_match:
                self.warnings.append(f"第 {line_number} 行：无法解析单词行")
                return None
            word = word_match[1].strip()
            remaining = word_line[len(word_match[0]):].strip()
            meaning = remaining
        
        # 生成 ID
        book_id = book.get('id', 'book')
        unit_num = unit.get('unit', 'u0').replace('Unit ', 'u') if unit else 'u0'
        word_id = f"{book_id}-{unit_num}-w{index + 1}"
        
        return {
            'id': word_id,
            'word': word,
            'phonetic': phonetic,
            'meaning': meaning,
            'line_number': line_number,
            'has_meaning': bool(meaning),
            'example': '',
            'translation': '',
            'memory_tip': ''
        }
    
    def validate_book(self, book: Dict):
        """验证单个词书"""
        name = book.get('name', f"book-{book['index']}")
        
        # 检查是否有单元
        if not book.get('units'):
            self.warnings.append(f"第 {book['line_number']} 行 \"{name}\"：词书中没有单元")
            return
        
        # 检查词书名称
        if not book.get('has_valid_name', True):
            self.errors.append(f"第 {book['line_number']} 行：词书名称格式不正确")
        
        # 检查每个单元
        for unit in book['units']:
            if not unit.get('title'):
                self.warnings.append(f"第 {unit['line_number']} 行：单元 {unit['unit']} 缺少标题 (Title:...)")
            
            if not unit.get('words'):
                self.warnings.append(f"第 {unit['line_number']} 行：单元 {unit['unit']} 没有单词")
        
        self.stats['valid_books'] += 1
    
    def validate_word(self, word: Dict, unit: Dict, book: Dict):
        """验证单个单词"""
        title = book.get('name', 'unknown') + ' - ' + unit.get('unit', 'unknown')
        
        # 检查单词
        if not word.get('word'):
            self.errors.append(f"第 {word['line_number']} 行：单词为空")
        
        # 检查释义
        if not word.get('meaning'):
            self.warnings.append(f"第 {word['line_number']} 行：单词 \"{word.get('word', '?')}\" 缺少释义")
    
    def print_results(self) -> bool:
        """打印检查结果"""
        print('\n' + '=' * 60)
        print('📖 WORDS.md 格式检查报告')
        print('=' * 60)
        
        # 统计信息
        print('\n📊 统计信息：')
        print(f"   - 词书总数：{self.stats['total_books']}")
        print(f"   - 有效词书：{self.stats['valid_books']}")
        print(f"   - 单元总数：{self.stats['total_units']}")
        print(f"   - 单词总数：{self.stats['total_words']}")
        print(f"   - 例句总数：{self.stats['total_examples']}")
        print(f"   - 记忆技巧总数：{self.stats['total_memory_tips']}")
        
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
            print('✅ 格式检查通过！所有词书格式正确。')
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
        words_path = file_path or os.path.join(_REPO_ROOT, 'data', 'WORDS.md')
        
        print('🔍 开始检查 WORDS.md 格式...')
        print(f'📁 文件路径: {words_path}')
        
        if not self.check_file_exists(words_path):
            self.print_results()
            return False
        
        content = self.read_file(words_path)
        if content is None:
            self.print_results()
            return False
        
        self.check_format(content)
        return self.print_results()


def main():
    """主函数"""
    checker = WordsFormatChecker()
    
    # 获取命令行参数
    args = sys.argv[1:]
    file_path = args[0] if args else None
    
    # 运行检查
    success = checker.run(file_path)
    
    # 退出码
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
