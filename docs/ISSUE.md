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
在语句听写页面的单词输入框中输入时，按空格键会导致页面自动下拉，影响输入体验。

### 问题原因
输入框的 `keydown` 事件处理中未阻止空格键的默认行为。空格键在浏览器中默认会触发页面滚动。

### 解决方案
在 `keydown` 事件处理中添加对空格键的阻止：

**修改内容（第 4444-4447 行）：**
```javascript
input.addEventListener('keydown', (e) => {
    // 阻止空格键的默认行为（避免页面滚动）
    if (e.key === ' ') {
        e.preventDefault();
    }
    // ... 其他处理
});
```

### 经验总结
1. 在输入框中处理特殊按键时，需要考虑是否需要阻止默认行为
2. 常见需要阻止默认行为的按键：空格（避免页面滚动）、方向键（避免光标移出输入框）
3. 使用 `e.preventDefault()` 可以阻止按键的默认浏览器行为

### 修改文件
- `js/app.js`：第 4443-4451 行（添加空格键阻止逻辑）
