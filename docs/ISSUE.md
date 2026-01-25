# 问题记录

## 错题本页面句子播放失败问题

### 问题描述
错题本页面中，包含单引号（如 `I'm`、`We're`）的句子无法播放语音，点击播放按钮没有声音也没有错误提示。

### 问题原因
在 HTML 属性中直接传递包含单引号的文本时，JavaScript 解析会出错。

**错误的实现方式：**
```javascript
// 第 1805 行（修改前）
onclick='speakSentence("${escapeHtml(item.english).replace(/'/g, "\\'")}")'
```

**问题分析：**
1. `escapeHtml()` 函数将单引号转换为 HTML 实体 `&#39;`
2. 然后 `.replace(/'/g, "\\'")` 无法找到原始单引号进行转义
3. 最终生成的 HTML 属性值中，单引号未被正确转义
4. 当句子包含 `I'm` 时，`onclick` 属性被错误解析，导致 JavaScript 执行失败

### 解决方案
采用与阅读页面相同的**索引传递方式**，避免在 HTML 属性中直接传递文本。

**修改内容：**

1. 新增 `playWrongSentence(globalIndex)` 函数：
```javascript
function playWrongSentence(globalIndex) {
    const progress = AppState.userProgress;
    if (!progress.wrongSentences || globalIndex >= progress.wrongSentences.length) {
        return;
    }
    const sentence = progress.wrongSentences[globalIndex];
    if (sentence && sentence.english) {
        speakSentence(sentence.english);
    }
}
```

2. 修改 HTML 渲染，使用索引传递：
```javascript
// 第 1805 行（修改后）
onclick="playWrongSentence(${globalIndex})"
```

### 对比：阅读页面的正确实现

阅读页面（`playDialogue`）采用相同方式，正确处理了包含单引号的句子：

```javascript
// 渲染时传递索引
onclick="playDialogue(${index})"

// 函数通过索引从全局数据获取文本
function playDialogue(index) {
    const dialogue = reading.dialogues[index];
    speakText(dialogue.content, 'en-US');
}
```

### 经验总结
1. 在 HTML 属性中传递用户输入的文本时，避免直接传递包含特殊字符的文本
2. 优先使用索引传递方式，通过全局状态（AppState）存储数据
3. 传递数字索引不会涉及字符转义问题，更加安全可靠
4. 类似的处理方式可应用于：单词播放按钮、收藏页面等

### 修改文件
- `js/app.js`：第 1805 行（HTML 渲染）、第 1847-1857 行（新增函数）

---

## 语句听写页面空格键滚动问题

### 问题描述
在语句听写页面的单词输入框中输入时，按空格键或某些字母会导致页面自动下拉，影响输入体验。

### 问题原因
1. 空格键在浏览器中默认会触发页面滚动
2. 输入框的 `keydown` 事件处理中未阻止空格键的默认行为
3. macOS 上可能存在其他按键触发的滚动行为
4. 页面使用了 `scroll-behavior: smooth`，任何意外的滚动都会产生明显效果

### 解决方案
1. 在 `keydown` 事件处理中添加对空格键和修饰键的阻止
2. 在 `input` 和 `keydown` 事件中添加滚动位置锁定机制

**修改内容：**

1. 在 `keydown` 事件中添加按键阻止逻辑（第 4447-4455 行）：
```javascript
input.addEventListener('keydown', (e) => {
    // 确保按键时滚动位置不变
    inputsContainer.scrollTop = inputsScrollTop;
    
    // 阻止空格键的默认行为（避免页面滚动）
    if (e.key === ' ') {
        e.preventDefault();
    }
    // 阻止 Command 键相关的默认行为（macOS 上 Cmd+I 等快捷键）
    if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
    }
    // ... 其他处理
});
```

2. 在 `input` 事件中添加滚动位置锁定（第 4432 行）：
```javascript
input.addEventListener('input', (e) => {
    // 确保输入时滚动位置不变
    inputsContainer.scrollTop = inputsScrollTop;
    // ... 其他处理
});
```

3. 保存并恢复滚动位置（第 4410-4411 行、第 4492-4493 行）：
```javascript
// 生成单词输入框前保存滚动位置
const inputsScrollTop = inputsContainer.scrollTop;

// 聚焦第一个输入框后恢复滚动位置
setTimeout(() => {
    firstInput.focus();
    inputsContainer.scrollTop = inputsScrollTop;
}, 100);
```

### 经验总结
1. 在输入框中处理特殊按键时，需要考虑是否需要阻止默认行为
2. 常见需要阻止默认行为的按键：空格（避免页面滚动）、方向键（避免光标移出输入框）
3. 使用 `e.preventDefault()` 可以阻止按键的默认浏览器行为
4. 对于复杂的交互场景，需要同时处理事件阻止和滚动位置锁定
5. macOS 上可能存在特殊的按键行为（如 Command 键组合），需要额外处理

### 修改文件
- `js/app.js`：第 4410-4411 行（保存滚动位置）、第 4432 行（input 事件锁定滚动）、第 4449-4455 行（keydown 事件处理）、第 4490-4494 行（恢复滚动位置）

---

## 错句复习重复添加问题

### 问题描述
在复习错句功能中，如果对同一个句子重复回答错误，会多次将该句子添加到错句列表中，导致数据重复。

### 问题原因
复习错句时，将错句转换为对话格式用于练习界面，但没有保留原始错句的 `id`。在 `checkSentenceAnswer` 中，句子 ID 是动态生成的（`${dialogue.sourceId}-${currentIndex}`），导致每次回答错误时都生成新的 ID，无法触发 `addWrongSentence` 中的排重逻辑。

**问题代码（第 1946-1952 行，修改前）：**
```javascript
const dialogues = progress.wrongSentences.map((sentence, index) => ({
    content: sentence.english,
    contentCn: sentence.chinese,
    speaker: '',
    speakerCn: '',
    sourceId: sentence.readingTitleCn || ''
}));
```

**`checkSentenceAnswer` 中动态生成的 ID（第 4581 行）：**
```javascript
const sentenceId = `${dialogue.sourceId}-${currentIndex}`;
```

### 解决方案
1. 在将错句转换为对话格式时，保留原始错句的 `id`
2. 在检查答案时，使用对话的原始 `id` 进行排重

**修改内容：**

1. **`reviewAllWrongSentences` 函数（第 1946 行）：**
```javascript
const dialogues = progress.wrongSentences.map((sentence) => ({
    id: sentence.id,  // 保留原始错句 ID，用于排重
    content: sentence.english,
    contentCn: sentence.chinese,
    speaker: '',
    speakerCn: '',
    sourceId: sentence.readingTitleCn || ''
}));
```

2. **`checkSentenceAnswer` 函数（第 4581-4592 行）：**
```javascript
const sentenceId = dialogue.id || `${dialogue.sourceId}-${currentIndex}`;
if (!session.wrongSentenceIds.includes(sentenceId)) {
    session.wrongSentenceIds.push(sentenceId);
}

// 记录错句（使用原始 ID 触发排重逻辑）
addWrongSentence({
    id: sentenceId,
    readingId: dialogue.sourceId || '',
    readingTitleCn: dialogue.sourceId || '',
    english: dialogue.content,
    chinese: dialogue.contentCn
});
```

### 经验总结
1. 在复习场景中，需要保留原始数据的唯一标识符（`id`）
2. 与错词复习对比：错词复习在生成题目时已保留 `word.id`，所以天然支持排重
3. 复习功能的会话数据应该尽量复用原始数据的标识系统
4. 任何涉及"去重"的场景，都应优先使用原始数据的唯一标识

### 修改文件
- `js/app.js`：第 1946 行（添加 `id` 字段）、第 4581-4592 行（使用原始 `id`）
