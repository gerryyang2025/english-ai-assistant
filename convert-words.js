// 数据转换脚本：将 WORDS.md 转换为 JSON 格式
// 运行方式：node convert-words.js

const fs = require('fs');
const path = require('path');

// 词书名称到 ID 的映射
const bookNameToId = {
    '英语五年级上册': 'grade5-upper',
    '英语六年级上册': 'grade6-upper',
    '英语五年级下册': 'grade5-lower',
    '英语六年级下册': 'grade6-lower'
};

function parseWordsMD() {
    // 读取 WORDS.md 文件
    const wordsMdPath = path.join(__dirname, 'WORDS.md');
    const content = fs.readFileSync(wordsMdPath, 'utf-8');
    
    const lines = content.split('\n');
    const wordBooks = [];
    let currentBook = null;
    let currentUnit = null;
    let currentWordData = null;
    let wordIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        
        // 跳过注释
        if (line.startsWith('<!--') || line.startsWith('```')) {
            continue;
        }
        
        // 检测词书标题
        if (rawLine.startsWith('# ')) {
            const bookName = line.replace('# ', '').replace('单词', '').trim();
            if (bookName.includes('年级')) {
                // 保存上一个单词
                if (currentWordData && currentUnit) {
                    currentUnit.words.push(currentWordData);
                    wordIndex++;
                }
                
                currentBook = {
                    id: bookNameToId[bookName] || bookName,
                    name: bookName,
                    units: []
                };
                wordBooks.push(currentBook);
                currentUnit = null;
                currentWordData = null;
                wordIndex = 0;
            }
            continue;
        }
        
        // 检测单元标题
        if (rawLine.startsWith('## ')) {
            const unitMatch = line.match(/##\s*(Unit\s*\d+)/);
            if (unitMatch) {
                // 保存上一个单词
                if (currentWordData && currentUnit) {
                    currentUnit.words.push(currentWordData);
                    wordIndex++;
                }
                currentWordData = null;
                
                currentUnit = {
                    unit: unitMatch[1],
                    title: '',
                    category: '',
                    words: []
                };
                wordIndex = 0;
                if (currentBook) {
                    currentBook.units.push(currentUnit);
                }
            }
            continue;
        }
        
        // 检测 Title 行
        if (rawLine.startsWith('Title:')) {
            const titleMatch = line.match(/Title:\s*(.+?)\s*Category:\s*(.+)/);
            if (titleMatch && currentUnit) {
                currentUnit.title = titleMatch[1].trim();
                currentUnit.category = titleMatch[2].trim();
            }
            continue;
        }
        
        // 检测详情行（缩进的 - 行）
        if (rawLine.startsWith('  - ')) {
            const detailContent = line.substring(2).trim(); // 移除 "- "
            
            // 如果还没有当前单词数据，跳过
            if (!currentWordData) continue;
            
            if (detailContent.startsWith('例句：')) {
                const examplePart = detailContent.substring(3); // 移除 "例句："
                const match = examplePart.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
                if (match) {
                    currentWordData.example = match[1].trim();
                    currentWordData.translation = match[2].trim();
                } else if (examplePart.trim()) {
                    currentWordData.example = examplePart.trim();
                }
            } else if (detailContent.startsWith('记忆：')) {
                currentWordData.memoryTip = detailContent.substring(3).trim();
            }
            continue;
        }
        
        // 检测单词行（以 * 开头但不是缩进的）
        if (rawLine.startsWith('* ')) {
            // 保存上一个单词
            if (currentWordData && currentUnit) {
                currentUnit.words.push(currentWordData);
                wordIndex++;
            }
            
            currentWordData = parseWordLine(line, currentBook, currentUnit, wordIndex);
            continue;
        }
    }
    
    // 保存最后一个单词
    if (currentWordData && currentUnit) {
        currentUnit.words.push(currentWordData);
    }
    
    return wordBooks;
}

function parseWordLine(line, book, unit, index) {
    // 格式: * word /phonetic/ meaning
    const wordLine = line.substring(2).trim(); // 移除 "* "
    
    // 先提取音标 /.../
    let word = wordLine;
    let phonetic = '';
    let meaning = '';
    
    const phoneticMatch = wordLine.match(/\/([^\/]+)\//);
    if (phoneticMatch) {
        phonetic = '/' + phoneticMatch[1] + '/';
        const parts = wordLine.split('/');
        if (parts.length >= 3) {
            word = parts[0].trim();
            meaning = parts[2].trim();
        }
    } else {
        // 没有音标，使用原有的空格分割逻辑
        const wordMatch = wordLine.match(/^([^\s\/]+(?:\s+[^\s\/]+)?)/);
        if (!wordMatch) return null;
        
        word = wordMatch[1].trim();
        let remaining = wordLine.substring(wordMatch[0].length).trim();
        meaning = remaining;
    }
    
    // 生成 ID（包含词书前缀以确保唯一性）
    const bookId = book ? (book.id || 'book') : 'book';
    const unitNum = unit ? unit.unit.replace('Unit ', 'u') : 'u0';
    const id = `${bookId}-${unitNum}-w${index + 1}`;
    
    return {
        id: id,
        word: word,
        phonetic: phonetic,
        meaning: meaning,
        example: '',
        translation: '',
        memoryTip: '',
        category: unit ? unit.category : ''
    };
}

// 主程序
function main() {
    console.log('开始转换 WORDS.md...');
    
    const wordBooks = parseWordsMD();
    
    // 输出到控制台预览
    console.log('\n解析结果预览:');
    wordBooks.forEach(book => {
        console.log(`\n词书: ${book.name} (${book.id})`);
        console.log(`单元数: ${book.units.length}`);
        book.units.forEach(unit => {
            console.log(`  - ${unit.unit} (${unit.title}): ${unit.words.length} 个单词`);
        });
    });
    
    // 生成 JSON 数据
    const jsonOutput = JSON.stringify(wordBooks, null, 2);
    
    // 保存到 data/words.json
    const outputPath = path.join(__dirname, 'data', 'words.json');
    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');
    console.log(`\n数据已保存到: ${outputPath}`);
    
    // 生成嵌入式数据（用于 app.js）
    const embeddedOutput = `// ========== 内嵌单词数据（当 fetch 失败时使用）==========
// 数据格式：词书列表，每个词书包含多个单元
// 此文件由 convert-words.js 自动生成，不要手动修改
const EMBEDDED_WORD_DATA = ${jsonOutput};`;
    
    // 更新 app.js 中的数据
    const appJsPath = path.join(__dirname, 'js', 'app.js');
    let appJsContent = fs.readFileSync(appJsPath, 'utf-8');
    
    // 替换嵌入式数据部分
    const dataStartMarker = '// ========== 内嵌单词数据（当 fetch 失败时使用）==========';
    const dataEndMarker = '// ========== DOM 元素缓存 ==========';
    
    const startIdx = appJsContent.indexOf(dataStartMarker);
    const endIdx = appJsContent.indexOf(dataEndMarker);
    
    if (startIdx !== -1 && endIdx !== -1) {
        const newAppJs = appJsContent.substring(0, startIdx) + 
                        embeddedOutput + '\n\n' + 
                        appJsContent.substring(endIdx);
        
        fs.writeFileSync(appJsPath, newAppJs, 'utf-8');
        console.log(`嵌入式数据已更新到: ${appJsPath}`);
    } else {
        console.log('警告: 无法找到 app.js 中的数据标记，请手动更新');
    }
    
    console.log('\n转换完成！');
}

main();
