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
    
    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();
        
        // 跳过注释
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
                dialogues: []
            };
            readingIndex++;
            continue;
        }
        
        // 检测场景行
        if (line.startsWith('# 场景：')) {
            if (currentReading) {
                currentReading.scene = line.replace('# 场景：', '').trim();
            }
            continue;
        }
        
        // 检测重点句型行
        if (line.startsWith('# 重点句型：') || line === '# 重点句型') {
            if (currentReading) {
                currentReading.isParsingPatterns = true;
            }
            continue;
        }
        
        // 解析重点句型（缩进的 - 行）
        if (rawLine.startsWith('  - ') && currentReading && currentReading.isParsingPatterns) {
            const patternLine = line.substring(2).trim(); // 移除 "- " 前缀
            const patternMatch = patternLine.match(/^(.+?)（(.+)）$/);
            if (patternMatch) {
                currentReading.keySentencePatterns.push({
                    pattern: patternMatch[1].trim(),
                    meaning: patternMatch[2].trim()
                });
            }
            continue;
        }
        
        // 检测对话行（结束句型解析）
        if (line.includes(':') && line.includes('(') && line.includes(')')) {
            if (currentReading) {
                currentReading.isParsingPatterns = false;
                const dialogueMatch = line.match(/^([^:]+):\s*(.+?)\s*\(([^)]+)\)/);
                if (dialogueMatch) {
                    // dialogueMatch[1] = speaker, dialogueMatch[2] = english content, dialogueMatch[3] = chinese translation
                    const cnTranslation = dialogueMatch[3].trim();
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
            }
            continue;
        }
    }
    
    // 保存最后一个阅读材料
    if (currentReading) {
        // 删除临时字段
        delete currentReading.isParsingPatterns;
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
