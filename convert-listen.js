#!/usr/bin/env node
/**
 * 听书数据转换脚本：将 LISTEN.md 转换为 JSON 格式
 *
 * LISTEN.md 格式说明：
 * - 一级标题 # 文章题目 表示新文章
 * - 二级标题 ## 标题 可以是"文章概要"、"正文"、或其他任何章节名
 * - 二级标题下的内容都是该章节的内容
 *
 * 运行方式：node convert-listen.js
 */

const fs = require('fs');
const path = require('path');

/**
 * 解析 LISTEN.md 文件
 * 格式规则：
 *   # 文章题目  -> 表示新文章（一级标题）
 *   ## 标题    -> 章节名（二级标题），可以是"文章概要"、"正文"或其他任何名称
 *   内容       -> 二级标题下的所有内容属于该章节
 */
function parseListenMD() {
    const listenMdPath = path.join(__dirname, 'LISTEN.md');
    const content = fs.readFileSync(listenMdPath, 'utf-8');

    const lines = content.split('\n');
    const speeches = [];
    let currentSpeech = null;
    let speechIndex = 0;
    let currentChapter = null;
    let chapterContent = [];
    let isFirstChapter = true;
    let isParsingSummary = false;

    // 提取书本名称（第一个 # 标题作为书名）
    let bookName = '听书素材';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // 一级标题 # 标题格式（但不是 ## 二级标题）
        if (line.startsWith('# ') && !line.startsWith('## ')) {
            bookName = line.replace(/^#\s*/, '').trim();
            break;
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];
        const line = rawLine.trim();

        // 跳过 HTML 注释和代码块
        if (line.startsWith('<!--') || line.startsWith('```')) {
            continue;
        }

        // 检测一级标题 # 文章题目 -> 新文章开始
        if (rawLine.startsWith('# ') && !line.startsWith('## ')) {
            // 如果已有正在处理的文章，先保存它
            if (currentSpeech) {
                // 保存最后一个章节或概要
                if (isParsingSummary && chapterContent.length > 0) {
                    currentSpeech.summary = chapterContent.join('\n').trim();
                } else if (currentChapter) {
                    currentSpeech.chapters.push({
                        ...currentChapter,
                        content: chapterContent.join('\n').trim()
                    });
                }

                // 添加到结果列表（只有包含章节的文章才被视为有效）
                if (currentSpeech.chapters.length > 0) {
                    speeches.push(currentSpeech);
                    speechIndex++;
                }
            }

            // 开始新文章
            const title = line.replace('# ', '').trim();
            currentSpeech = {
                id: `speech-${String(speechIndex + 1).padStart(3, '0')}`,
                title: title,
                bookName: bookName,
                summary: '',
                chapters: []
            };
            isFirstChapter = true;
            isParsingSummary = false;
            currentChapter = null;
            chapterContent = [];
            continue;
        }

        if (!currentSpeech) continue;

        // 检测二级标题 ## 标题 -> 新章节开始
        // 章节标题可以是"文章概要"、"正文"、或其他任何章节名
        if (rawLine.startsWith('## ')) {
            const chapterTitle = line.replace('## ', '').trim();

            // 检查是否是"文章概要"章节（特殊章节，用于存储文章摘要）
            if (chapterTitle === '文章概要') {
                // 保存上一个普通章节（如果有）
                if (!isFirstChapter && currentChapter) {
                    currentSpeech.chapters.push({
                        ...currentChapter,
                        content: chapterContent.join('\n').trim()
                    });
                } else if (isFirstChapter && currentChapter && chapterContent.length > 0) {
                    // 第一个章节的情况
                    currentSpeech.chapters.push({
                        ...currentChapter,
                        content: chapterContent.join('\n').trim()
                    });
                }

                // 保存文章概要内容
                if (isParsingSummary && chapterContent.length > 0) {
                    currentSpeech.summary = chapterContent.join('\n').trim();
                }

                // 重置状态，开始解析文章概要
                isParsingSummary = true;
                isFirstChapter = false;
                currentChapter = null;
                chapterContent = [];
            } else {
                // 这是一个普通章节（正文或其他章节）
                // 如果之前在解析概要，先保存概要
                if (isParsingSummary && chapterContent.length > 0) {
                    currentSpeech.summary = chapterContent.join('\n').trim();
                }

                // 保存上一个章节（如果有）
                if (!isFirstChapter && currentChapter) {
                    currentSpeech.chapters.push({
                        ...currentChapter,
                        content: chapterContent.join('\n').trim()
                    });
                } else if (isFirstChapter && currentChapter && chapterContent.length > 0) {
                    // 第一个章节的情况
                    currentSpeech.chapters.push({
                        ...currentChapter,
                        content: chapterContent.join('\n').trim()
                    });
                }

                // 开始新章节
                isParsingSummary = false;
                currentChapter = {
                    title: chapterTitle
                };
                chapterContent = [];
                isFirstChapter = false;
            }
            continue;
        }

        // 收集章节内容
        // 二级标题下的所有内容都属于该章节
        if (isParsingSummary && currentSpeech) {
            // 跳过章节标题后的第一个空行
            if (chapterContent.length === 0 && !line) {
                continue;
            }
            chapterContent.push(rawLine);
        } else if (currentChapter) {
            // 跳过章节标题后的第一个空行
            if (chapterContent.length === 0 && !line) {
                continue;
            }
            chapterContent.push(rawLine);
        }
    }

    // 保存最后一个章节或概要
    if (currentSpeech) {
        if (isParsingSummary && chapterContent.length > 0) {
            currentSpeech.summary = chapterContent.join('\n').trim();
        } else if (currentChapter) {
            currentSpeech.chapters.push({
                ...currentChapter,
                content: chapterContent.join('\n').trim()
            });
        }
    }

    // 添加到结果列表（只有包含章节的文章才被视为有效）
    if (currentSpeech && currentSpeech.chapters.length > 0) {
        speeches.push(currentSpeech);
        speechIndex++;
    }

    return {
        bookName: bookName,
        speeches: speeches
    };
}

function main() {
    console.log('开始转换 LISTEN.md...');
    const data = parseListenMD();
    
    console.log(`\n📖 书本名称: ${data.bookName || '未设置'}`);
    console.log(`🎧 共 ${data.speeches.length} 篇听书材料`);
    
    data.speeches.forEach((speech, index) => {
        console.log(`\n  【${speech.title}】`);
        console.log(`    - 概要: ${speech.summary ? speech.summary.substring(0, 50) + '...' : '未设置'}`);
        console.log(`    - 章节数: ${speech.chapters.length} 个`);
        speech.chapters.forEach((chapter, chapterIndex) => {
            const contentLength = chapter.content ? chapter.content.length : 0;
            console.log(`      ${chapterIndex + 1}. ${chapter.title} (${contentLength} 字)`);
        });
    });
    
    // 生成 JSON 数据
    const jsonOutput = JSON.stringify(data, null, 2);
    
    // 保存到 data/listen.json
    const outputPath = path.join(__dirname, 'data', 'listen.json');
    fs.writeFileSync(outputPath, jsonOutput, 'utf-8');
    console.log(`\n\n✅ 数据已保存到: ${outputPath}`);
    
    console.log('\n转换完成！');
}

main();
