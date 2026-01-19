// 阅读数据转换脚本：将 READINGS.md 转换为 JSON 格式
// 运行方式：node convert-readings.js

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
    
    // 找到第一个题目行的位置
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('# 题目：')) {
            startIndex = i;
            break;
        }
    }
    
    for (let i = startIndex; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        
        // 跳过注释和 JSON 示例
        if (line.startsWith('<!--') || line.startsWith('```') || line.startsWith('*')) {
            continue;
        }
        
        // 检测题目行
        if (line.startsWith('# 题目：')) {
            // 保存上一个阅读材料
            if (currentReading) {
                readings.push(currentReading);
            }
            
            const titleMatch = line.match(/# 题目：(.+?)\s*\(([^)]+)\)/);
            currentReading = {
                id: `reading-${String(readingIndex + 1).padStart(3, '0')}`,
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
        
        // 检测场景行
        if (line.startsWith('# 场景：')) {
            currentReading.scene = line.replace('# 场景：', '').trim();
            continue;
        }
        
        // 检测重点句型行
        if (line.startsWith('# 重点句型：') || line === '# 重点句型') {
            isParsingPatterns = true;
            isParsingKnowledgePoints = false;
            continue;
        }
        
        // 检测知识点行
        if (line.startsWith('# 知识点：') || line === '# 知识点') {
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
    
    return { readings };
}

function main() {
    console.log('开始转换 READINGS.md...');
    const data = parseReadingsMD();
    
    console.log(`\n解析结果：共 ${data.readings.length} 篇阅读材料`);
    data.readings.forEach((reading, index) => {
        console.log(`  ${index + 1}. ${reading.title} (${reading.titleCn})`);
        console.log(`     - 句型: ${reading.keySentencePatterns.length} 个`);
        console.log(`     - 知识点: ${reading.knowledgePoints.length} 个`);
        console.log(`     - 对话: ${reading.dialogues.length} 句`);
    });
    
    // 生成 JSON 数据
    const jsonOutput = JSON.stringify(data, null, 2);
    
    // 保存到 data/readings.json
    const outputPath = path.join(__dirname, 'data', 'readings.json');
    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');
    console.log(`\n数据已保存到: ${outputPath}`);
    
    console.log('\n转换完成！');
}

main();
