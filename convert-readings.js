#!/usr/bin/env node
// 阅读数据转换脚本：将 READINGS.md 转换为 JSON 格式
// 运行方式：node convert-readings.js  或  ./convert-readings.js

const fs = require('fs');
const path = require('path');

function parseReadingsMD() {
    const readingsMdPath = path.join(__dirname, 'READINGS.md');
    const content = fs.readFileSync(readingsMdPath, 'utf-8');
    
    const lines = content.split('\n');
    const readings = [];
    let currentReading = null;
    let readingIndex = 0;
    let isParsingPatterns = false;
    let isParsingKnowledgePoints = false;

    // 过滤掉 <!-- ... --> 注释块内的行（含其中的 ``` 代码块），避免将格式示例当作真实内容解析
    const filteredLines = [];
    let inCommentBlock = false;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (line.startsWith('<!--')) {
            inCommentBlock = true;
            continue;
        }
        if (inCommentBlock) {
            if (line.includes('-->')) {
                inCommentBlock = false;
            }
            continue;
        }
        filteredLines.push(raw);
    }
    const linesToParse = filteredLines;
    
    // 初始书本名称（第一个 # 书本标题，用于顶层 bookName 兼容）
    let bookName = '';
    for (let i = 0; i < linesToParse.length; i++) {
        const line = linesToParse[i].trim();
        if (line.startsWith('# ') && !line.startsWith('# 题目：') && !line.startsWith('# 场景：') && 
            !line.startsWith('# 重点句型') && !line.startsWith('# 知识点')) {
            bookName = line.replace(/^#\s*/, '').trim();
            break;
        }
    }
    
    // 当前单元名称、当前书本（解析过程中遇到新的 # 书本会更新）
    let currentUnitName = '';
    let currentBookName = bookName;
    
    // 找到第一个题目行的位置
    let startIndex = 0;
    for (let i = 0; i < linesToParse.length; i++) {
        const line = linesToParse[i].trim();
        if (line.startsWith('# 题目：') || line.startsWith('* 题目：')) {
            startIndex = i;
            break;
        }
    }
    
    for (let i = startIndex; i < linesToParse.length; i++) {
        const rawLine = linesToParse[i];
        const line = rawLine.trim();
        
        // 跳过独立的代码块标记行
        if (line.startsWith('```')) {
            continue;
        }
        
        // 检测书本标题行（# 开头且非 题目/场景/重点句型/知识点）——支持多本书
        if (line.startsWith('# ') && !line.startsWith('# 题目：') && !line.startsWith('# 场景：') &&
            !line.startsWith('# 重点句型') && !line.startsWith('# 知识点')) {
            currentBookName = line.replace(/^#\s*/, '').trim();
            continue;
        }
        
        // 检测单元标题行（## 开头的行）
        if (line.startsWith('## ')) {
            currentUnitName = line.replace(/^##\s*/, '').trim();
            continue;
        }
        
        // 检测题目行（支持两种格式：# 题目： 和 * 题目：）
        if (line.startsWith('# 题目：') || line.startsWith('* 题目：')) {
            // 保存上一个阅读材料
            if (currentReading) {
                readings.push(currentReading);
            }
            
            // 移除 # 或 * 前缀
            const cleanLine = line.replace(/^[*#]\s*/, '');
            const titleMatch = cleanLine.match(/题目：(.+?)\s*\(([^)]+)\)/);
            
            // 在当前行之前查找最近的单元标题
            let readingUnitName = '';
            for (let j = i - 1; j >= 0; j--) {
                const prevLine = linesToParse[j].trim();
                if (prevLine.startsWith('## ')) {
                    readingUnitName = prevLine.replace(/^##\s*/, '').trim();
                    break;
                }
            }
            // 如果没找到，从文件开头查找最近的单元标题
            if (!readingUnitName) {
                for (let j = 0; j < i; j++) {
                    const prevLine = linesToParse[j].trim();
                    if (prevLine.startsWith('## ')) {
                        readingUnitName = prevLine.replace(/^##\s*/, '').trim();
                        break;
                    }
                }
            }
            
            currentReading = {
                id: `reading-${String(readingIndex + 1).padStart(3, '0')}`,
                bookName: currentBookName,
                unitName: readingUnitName,
                title: titleMatch ? titleMatch[1].trim() : '',
                titleCn: titleMatch ? titleMatch[2].trim() : '',
                scene: '',
                keySentencePatterns: [],
                knowledgePoints: [],
                dialogues: []
            };
            readingIndex++;
            isParsingPatterns = false;
            isParsingKnowledgePoints = false;
            continue;
        }
        
        // 如果没有当前阅读材料，跳过
        if (!currentReading) {
            continue;
        }
        
        // 检测场景行（支持两种格式：# 场景： 和 * 场景：）
        if (line.startsWith('# 场景：') || line.startsWith('* 场景：')) {
            currentReading.scene = line.replace(/^[*#]\s*场景：/, '').trim();
            continue;
        }
        
        // 检测重点句型行（支持两种格式：# 重点句型： 和 * 重点句型：）
        if (line.startsWith('# 重点句型：') || line.startsWith('# 重点句型') || 
            line.startsWith('* 重点句型：') || line.startsWith('* 重点句型')) {
            isParsingPatterns = true;
            isParsingKnowledgePoints = false;
            continue;
        }
        
        // 检测知识点行（支持两种格式：# 知识点： 和 * 知识点：）
        if (line.startsWith('# 知识点：') || line.startsWith('# 知识点') || 
            line.startsWith('* 知识点：') || line.startsWith('* 知识点')) {
            isParsingPatterns = false;
            isParsingKnowledgePoints = true;
            continue;
        }
        
        // 解析重点句型（缩进的 - 行）
        // 格式：- Pattern (翻译) 或 - Pattern (翻译。附加说明)
        if (rawLine.startsWith('  - ') && isParsingPatterns) {
            const patternLine = line.substring(2).trim(); // 移除 "- " 前缀
            
            // 尝试匹配半角括号格式: Pattern (翻译)
            const halfMatch = patternLine.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (halfMatch) {
                let meaning = halfMatch[2].trim();
                // 如果翻译以句号结尾，移除它
                meaning = meaning.replace(/\.$/, '');
                currentReading.keySentencePatterns.push({
                    pattern: halfMatch[1].trim(),
                    meaning: meaning
                });
            }
            continue;
        }
        
        // 解析知识点（缩进的 - 行）
        // 格式：- 知识点内容
        if (rawLine.startsWith('  - ') && isParsingKnowledgePoints) {
            const knowledgePointLine = line.substring(2).trim();
            if (knowledgePointLine) {
                currentReading.knowledgePoints.push(knowledgePointLine);
            }
            continue;
        }
        
        // 结束句型/知识点解析（遇到非缩进的行）
        if (!rawLine.startsWith('  ')) {
            isParsingPatterns = false;
            isParsingKnowledgePoints = false;
        }
        
        // 检测对话/正文行
        // 格式：Speaker: Content (speaker：翻译) 或 Text: Content (正文：翻译)
        if ((line.includes(':') || line.includes('：')) && 
            (line.includes('(') || line.includes('（'))) {
            
            // 尝试匹配半角括号格式
            let dialogueMatch = line.match(/^([^:]+):\s*(.+?)\s*\(([^)]+)\)$/);
            
            if (dialogueMatch) {
                let cnTranslation = dialogueMatch[3].trim();
                cnTranslation = cnTranslation.replace(/\.$/, '');
                
                // 提取说话者的中文名字（中文冒号前面的部分）
                const speakerCnMatch = cnTranslation.match(/^([^：:]+)[：:]/);
                const speakerCn = speakerCnMatch ? speakerCnMatch[1].trim() : cnTranslation;
                
                currentReading.dialogues.push({
                    speaker: dialogueMatch[1].trim(),
                    speakerCn: speakerCn,
                    content: dialogueMatch[2].trim(),
                    contentCn: cnTranslation
                });
            }
            continue;
        }
    }
    
    // 保存最后一个阅读材料
    if (currentReading) {
        readings.push(currentReading);
    }

    // 过滤掉空壳条目（来自注释示例等：无句型、无知识点、无对话）
    const filteredReadings = readings.filter(r =>
        r.keySentencePatterns.length > 0 ||
        r.knowledgePoints.length > 0 ||
        r.dialogues.length > 0
    );
    // 重新编号 id
    filteredReadings.forEach((r, idx) => {
        r.id = `reading-${String(idx + 1).padStart(3, '0')}`;
    });

    return { 
        bookName: bookName,
        readings: filteredReadings 
    };
}

function main() {
    console.log('开始转换 READINGS.md...');
    const data = parseReadingsMD();
    
    console.log(`\n📖 书本名称: ${data.bookName || '未设置'}`);
    console.log(`📚 共 ${data.readings.length} 篇阅读材料`);
    
    // 按单元分组显示
    const unitMap = new Map();
    data.readings.forEach(reading => {
        const unitName = reading.unitName || '未分类';
        if (!unitMap.has(unitName)) {
            unitMap.set(unitName, []);
        }
        unitMap.get(unitName).push(reading);
    });
    
    unitMap.forEach((readings, unitName) => {
        console.log(`\n  【${unitName}】- ${readings.length} 篇`);
        readings.forEach((reading, index) => {
            console.log(`    ${index + 1}. ${reading.title} (${reading.titleCn})`);
            console.log(`       - 句型: ${reading.keySentencePatterns.length} 个`);
            console.log(`       - 知识点: ${reading.knowledgePoints.length} 个`);
            console.log(`       - 对话: ${reading.dialogues.length} 句`);
        });
    });
    
    // 生成 JSON 数据
    const jsonOutput = JSON.stringify(data, null, 2);
    
    // 保存到 data/readings.json
    const outputPath = path.join(__dirname, 'data', 'readings.json');
    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');
    console.log(`\n\n✅ 数据已保存到: ${outputPath}`);
    
    console.log('\n转换完成！');
}

main();
