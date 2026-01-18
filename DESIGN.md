# 英语单词记忆网站设计方案

## 1 项目概述

### 1.1 项目背景

本项目旨在设计一个交互式英语单词记忆网站，通过闪卡测试的方式帮助更高效地记忆英语单词。网站支持根据教材单元组织单词内容，提供灵活的测试模式，并具备简洁友好的用户界面。

### 1.2 目标用户

- 小学三至六年级学生
- 需要辅助记忆英语单词的学习者

### 1.3 核心目标

- 提供直观、友好的单词学习界面
- 支持灵活的单元选择和测试模式
- 通过闪卡形式提高记忆效率
- 集成发音功能辅助听说能力培养
- 提供AI助手解答复杂语法和单词问题

---

## 2 需求描述

### 2.1 单词展示功能

网页上可以根据不同词书单元显示对应的英语单词、单词中文解释，以及单词的例句或用法。显示的单词信息通过格式化定义的单词文件提供，数据来源为 WORDS.md 文件解析后的 JSON 数据。

### 2.2 闪卡测试功能

页面上支持可以选择指定的单元（一个或多个），生成记忆闪卡（Flash Card）的测试功能，可以选择显示英文提问中文，或者显示中文提问英文的方式进行测试。

**具体交互要求**：

- 每个问题页面下有一个"查看答案"按钮
- 点击后翻转卡片效果显示答案
- 答案包含单词、释义、例句完整信息
- 添加"记住"/"忘记"按钮记录掌握情况
- 进度条显示当前测试进度
- 测试结果统计（正确率、用时等）

### 2.3 AI 助手功能

提供智能问答功能，帮助解答单词用法、语法规则等复杂问题。

**具体要求**：

- 支持 Markdown 格式展示回复
- 保护 API Key 不暴露在前端
- 防止恶意高频调用

---

## 3 技术方案设计

### 3.1 技术栈选择

**前端技术**：HTML5 + CSS3 + JavaScript（原生实现）

**后端技术**：Python Flask

**理由**：

- 轻量级前端实现，无需复杂构建工具
- 原生 JavaScript 易于理解和维护
- Python 后端保护 API Key 安全
- Flask 简单易用，适合本项目需求
- 适合静态网站部署（前端）+ API 服务（后端）

**数据存储**：

- 单词数据：JSON 文件（data/words.json）
- 用户进度：localStorage
- API 配置：独立 Python 配置文件（api_config.py）

**部署方式**：

- 前端：静态网站托管（GitHub Pages、Netlify、Vercel）
- 后端：Python 服务器（开发环境 Flask、生产环境 Gunicorn）

### 3.2 项目目录结构

```
english-notes/
├── index.html              # 主页面
├── server.py               # Python Flask 后端服务器
├── run.sh                  # 服务器管理脚本
├── api_config.py           # API 配置文件（忽略版本控制）
├── api_config.example.py   # API 配置模板
├── css/
│   └── main.css            # 主样式文件
├── js/
│   └── app.js              # 主应用逻辑
├── data/
│   └── words.json          # 单词数据文件
├── tools/
│   └── update-tool.html    # 数据更新工具
├── convert.js              # 数据转换脚本（Node.js）
├── WORDS.md                # 原始单词数据
├── DESIGN.md               # 设计文档
├── README.md               # 项目说明
└── .gitignore              # Git 忽略配置
```

---

## 4 数据结构设计

### 4.1 单词数据模型

单词数据存储为 JSON 格式，支持多词书结构，便于维护和更新。

**数据结构示例**：

```json
[
  {
    "id": "grade5-upper",
    "name": "英语五年级上册",
    "units": [
      {
        "unit": "Unit 1",
        "title": "Unit 1: My future",
        "words": [
          {
            "id": "grade5-upper-u1-w1",
            "word": "future",
            "meaning": "将来；未来",
            "phonetic": "/ˈfjuːtʃər/",
            "example": "I want to be a teacher in the future.",
            "translation": "我将来想成为一名老师。",
            "memoryTip": "future 开头的 fu=福，ture=愁，联想：福愁——将来会有福气，不用发愁",
            "audio": "future.mp3",
            "category": "职业相关"
          }
        ]
      }
    ]
  }
]
```

**字段说明**：

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | String | 是 | 词书唯一标识符，如 "grade5-upper" |
| name | String | 是 | 词书名称，如 "英语五年级上册" |
| units | Array | 是 | 单元列表 |
| unit | String | 是 | 单元编号，如 "Unit 1" |
| title | String | 否 | 单元标题，如 "Unit 1: My future" |
| words | Array | 是 | 单词列表 |
| id | String | 是 | 单词唯一标识符，如 "grade5-upper-u1-w1" |
| word | String | 是 | 英文单词 |
| meaning | String | 是 | 中文含义（可包含多个，用分号分隔） |
| phonetic | String | 否 | 音标，如 "/ˈfjuːtʃər/" |
| example | String | 否 | 例句英文 |
| translation | String | 否 | 例句中文翻译 |
| memoryTip | String | 否 | 记忆技巧 |
| audio | String | 否 | 音频文件路径 |
| category | String | 否 | 分类标签 |

### 4.2 用户进度数据模型

用户学习进度使用 localStorage 存储。

```json
{
  "userProgress": {
    "wordProgress": {
      "grade5-upper-u1-w1": {
        "reviewCount": 3,
        "correctCount": 2,
        "wrongCount": 1,
        "masteryLevel": 2,
        "lastReviewed": "2026-01-18T10:00:00Z",
        "nextReview": "2026-01-25T10:00:00Z"
      }
    },
    "wrongWords": ["grade5-upper-u1-w2", "grade5-upper-u1-w5"],
    "favoriteWords": ["grade5-upper-u1-w1"],
    "stats": {
      "totalReviewed": 50,
      "totalCorrect": 40,
      "totalWrong": 10,
      "currentStreak": 5,
      "lastStudyDate": "2026-01-18"
    }
  }
}
```

### 4.3 闪卡测试数据模型

```javascript
// 闪卡问题结构
{
  id: "q-1",
  wordId: "grade5-upper-u1-w1",
  _unitName: "Unit 1",
  _unitTitle: "My future",
  questionType: "en-to-zh",  // 或 "zh-to-en"
  question: "future",         // 显示的问题
  answer: {
    word: "future",
    meaning: "将来；未来",
    example: "I want to be a teacher in the future.",
    translation: "我将来想成为一名老师。",
    memoryTip: "future 开头的 fu=福，ture=愁..."
  }
}

// 测试会话结构
{
  sessionId: "session-123",
  selectedUnits: ["unit-1", "unit-2"],
  mode: "en-to-zh",
  questions: [],
  currentIndex: 0,
  startTime: "2026-01-18T10:00:00Z",
  correctCount: 0,
  wrongCount: 0,
  wrongWordIds: []  // 本次测试中答错的单词ID列表
}
```

---

## 5 功能模块设计

### 5.1 系统架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      用户浏览器                          │
├─────────────────────────────────────────────────────────┤
│                    前端 (HTML/CSS/JS)                    │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │ 单词列表   │  │ 闪卡测试   │  │ AI 助手   │           │
│  └───────────┘  └───────────┘  └───────────┘           │
├─────────────────────────────────────────────────────────┤
│                     本地存储 (localStorage)              │
│  用户进度 | 错词本 | 收藏夹 | 学习统计                    │
├─────────────────────────────────────────────────────────┤
│                    Python Flask 后端                     │
│  ┌───────────────────┐  ┌───────────────────────────┐  │
│  │  静态文件服务      │  │  /api/chat (AI 问答代理)   │  │
│  └───────────────────┘  └───────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    MiniMax API (云端)                   │
└─────────────────────────────────────────────────────────┘
```

### 5.2 数据流程设计

```
初始化
    ↓
加载单词数据并解析
    ↓
单元选择 → 筛选对应单词数据
    ↓
学习模式：展示单词列表，支持搜索/过滤
    ↓
测试模式：
  + 用户选择单元（多选）
  + 选择测试模式（英→中 / 中→英）
  + 根据选择生成测试队列
  + 显示闪卡问题
  + 记录用户回答情况
  + 生成测试报告
    ↓
AI 问答模式：
  + 用户提交问题
  + 后端验证速率限制
  + 后端调用 MiniMax API
  + 返回 Markdown 格式答案
```

### 5.3 单词数据管理模块

**功能职责**：

- 加载和解析 JSON 格式的单词数据
- 提供按词书、单元筛选单词的功能
- 支持中英文搜索和过滤
- 管理单词分类和标签
- 处理多词书数据结构

**核心方法**：

```javascript
const WordService = {
  // 加载单词数据
  async loadWords() {
    const response = await fetch('./data/words.json');
    return response.json();
  },

  // 获取所有词书列表
  getWordBooks(wordData) {
    return wordData.map(book => ({
      id: book.id,
      name: book.name,
      unitCount: book.units.length,
      totalWords: book.units.reduce((sum, u) => sum + u.words.length, 0)
    }));
  },

  // 根据单元ID获取单词
  getWordsByUnitIds(wordData, unitIds) {
    return wordData
      .flatMap(book => book.units)
      .filter(unit => unitIds.includes(`${book.id}-${unit.unit}`))
      .flatMap(unit => unit.words.map(w => ({...w, _unitName: unit.unit, _unitTitle: unit.title})));
  },

  // 搜索单词
  searchWords(allWords, query) {
    const lowerQuery = query.toLowerCase();
    return allWords.filter(word => 
      word.word.toLowerCase().includes(lowerQuery) ||
      word.meaning.includes(query)
    );
  }
};
```

### 5.4 学习模块

**词书/单元选择区**：

- 卡片式或列表式词书展示
- 支持展开查看单元详情
- 显示每个单元的单词数量
- 支持多选模式
- 显示每个单元的学习进度

**单词展示区**：

- 表格形式展示单词、音标、中文释义、例句、记忆技巧
- 分页显示，防止数据过多
- 点击单词播放发音（使用 Web Speech API，支持英式和美式发音）
- 收藏/标记难词功能
- 单词搜索过滤

**交互功能**：

- 点击国旗图标朗读单词（🇬🇧 英音 / 🇺🇸 美音）
- 点击收藏按钮添加/取消收藏
- 支持下拉刷新加载数据

### 5.5 闪卡测试模块

**测试设置面板**：

- 词书/单元选择（多选）
- 测试模式选择（英→中 / 中→英 / 随机混合）

**闪卡界面设计**：

```
┌─────────────────────────────────────┐
│         进度条 (3/10)               │
├─────────────────────────────────────┤
│                                     │
│         显示英文或中文               │
│         Unit 1: My future           │
│                                     │
├─────────────────────────────────────┤
│         [查看答案] 按钮              │
├─────────────────────────────────────┤
│      ✓ 记住    ✗ 忘记   📌 复习      │
└─────────────────────────────────────┘
```

**答案展示**：

- 点击"查看答案"后翻转卡片效果显示答案
- 包含单词、释义、例句完整信息
- 记忆技巧（可选显示）
- 显示词书和单元来源信息
- "记住"/"忘记"按钮记录掌握情况
- "标记稍后复习"按钮
- 支持点击单词播放发音

**测试进度**：

- 进度条动态显示当前测试进度
- 显示当前题号/总题数
- 答错次数统计

**测试结果统计**：

- 正确率百分比
- 正确/错误统计
- 用时统计
- 错词回顾入口
- 重新测试按钮

### 5.6 AI 助手模块

**功能设计**：

- 位于首页英雄区域下方，突出显示
- 绿色/青色渐变主题，与欢迎区域区分
- 支持 Markdown 格式展示回复
- 后端代理保护 API Key

**后端 API 设计**：

```python
# API 端点: POST /api/chat
# 请求体: {"question": "单词用法或语法问题"}
# 响应: {"answer": "Markdown 格式的回答"}

# 速率限制
RATE_LIMIT = {
    'requests_per_hour': 20,   # 每小时最大请求数
    'cooldown_seconds': 5,     # 请求间隔冷却时间
}
```

**速率限制策略**：

- IP 级别限制：每个 IP 每小时最多 20 次请求
- 冷却时间：连续请求间隔至少 5 秒
- 超限返回 429 状态码，提示等待时间

---

## 6 详细功能实现

### 6.1 WORDS.md 格式转换

将现有的 WORDS.md 文件转换为 JSON 格式的数据文件。

**原始格式示例**：

```
## Unit 1

Title: My future Category: 职业类

* future 将来；未来 /ˈfjuːtʃər/ - 例句：I want to be a teacher in the future. (我将来想成为一名教师。)
  记忆：future 开头的 fu=福，ture=愁...
* pilot 飞行员 /ˈpaɪlət/ - 记忆：pilot 开飞机，pilot 很厉害！
```

**转换后的 JSON 格式**：

```json
[
  {
    "id": "grade5-upper",
    "name": "英语五年级上册",
    "units": [
      {
        "unit": "Unit 1",
        "title": "My future",
        "category": "职业类",
        "words": [
          {
            "id": "grade5-upper-u1-w1",
            "word": "future",
            "meaning": "将来；未来",
            "phonetic": "/ˈfjuːtʃər/",
            "example": "I want to be a teacher in the future.",
            "translation": "我将来想成为一名教师。",
            "memoryTip": "future 开头的 fu=福，ture=愁...",
            "category": "职业类"
          },
          {
            "id": "grade5-upper-u1-w2",
            "word": "pilot",
            "meaning": "飞行员",
            "phonetic": "/ˈpaɪlət/",
            "memoryTip": "pilot 开飞机，pilot 很厉害！",
            "category": "职业类"
          }
        ]
      }
    ]
  }
]
```

### 6.2 闪卡测试逻辑

**测试流程**：

```
开始测试
    ↓
用户选择词书/单元 → 多选单元
    ↓
选择测试模式 → 英译中 / 中译英 / 随机混合
    ↓
生成题目 → 根据选择的单元和模式生成问题列表
    ↓
显示问题 → 随机抽取单词，显示问题面
    ↓
用户操作 → 点击"查看答案"
    ↓
显示答案 → 显示单词、中文、例句、来源信息
    ↓
用户标记 → "记住" / "不认识" / "稍后复习"
    ↓
下一题 → 移动到下一张闪卡
    ↓
测试结束 → 统计正确率，保存学习记录
    ↓
错词处理 → 答错的单词加入错词本
```

**题目生成算法**：

```javascript
function generateQuestions(words, mode, count) {
  // 随机打乱顺序
  const shuffledWords = [...words].sort(() => Math.random() - 0.5);
  
  // 限制题目数量（可选）
  const selectedWords = count ? shuffledWords.slice(0, count) : shuffledWords;
  
  // 生成问题
  return selectedWords.map((word, index) => {
    const questionType = mode === 'mixed' 
      ? (Math.random() > 0.5 ? 'en-to-zh' : 'zh-to-en')
      : mode;
    
    return {
      id: `q-${index}`,
      wordId: word.id,
      _unitName: word._unitName,
      _unitTitle: word._unitTitle,
      questionType,
      question: questionType === 'en-to-zh' ? word.word : word.meaning,
      answer: {
        word: word.word,
        meaning: word.meaning,
        example: word.example,
        translation: word.translation,
        memoryTip: word.memoryTip
      }
    };
  });
}
```

### 6.3 发音功能实现

使用浏览器内置 Web Speech API 实现单词发音功能，支持英式和美式发音。

```javascript
// 播放英式发音
function speakWordUK(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('浏览器不支持语音合成');
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-GB';  // 英式发音
  utterance.rate = 0.8;      // 语速稍慢
  utterance.pitch = 1.0;
  
  window.speechSynthesis.speak(utterance);
}

// 播放美式发音
function speakWordUS(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('浏览器不支持语音合成');
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';  // 美式发音
  utterance.rate = 0.8;
  utterance.pitch = 1.0;
  
  window.speechSynthesis.speak(utterance);
}
```

### 6.4 学习进度追踪

**掌握程度分类**：

| 等级 | 名称 | 描述 | 复习间隔 |
|------|------|------|----------|
| 0 | 学习中 | 刚开始学习或多次错误的单词 | 1天 |
| 1 | 待复习 | 有一定印象但需要巩固 | 2天 |
| 2-4 | 复习中 | 基本掌握，需要定期巩固 | 4-14天 |
| 5 | 已掌握 | 完全熟练掌握 | 30天 |

**进度更新逻辑**：

```javascript
function updateWordProgress(wordId, isCorrect) {
  const progress = getProgress();
  
  // 初始化单词进度
  if (!progress.wordProgress[wordId]) {
    progress.wordProgress[wordId] = {
      reviewCount: 0,
      correctCount: 0,
      wrongCount: 0,
      masteryLevel: 0,
      lastReviewed: null,
      nextReview: null
    };
  }
  
  const wordProgress = progress.wordProgress[wordId];
  wordProgress.reviewCount += 1;
  wordProgress.lastReviewed = new Date().toISOString();
  
  if (isCorrect) {
    wordProgress.correctCount += 1;
    wordProgress.masteryLevel = Math.min(5, wordProgress.masteryLevel + 1);
  } else {
    wordProgress.wrongCount += 1;
    wordProgress.masteryLevel = Math.max(0, wordProgress.masteryLevel - 1);
    // 加入错词本
    if (!progress.wrongWords.includes(wordId)) {
      progress.wrongWords.push(wordId);
    }
  }
  
  // 计算下次复习时间
  const intervals = [1, 2, 4, 7, 14, 30];
  const interval = intervals[wordProgress.masteryLevel] || 1;
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  wordProgress.nextReview = nextDate.toISOString();
  
  // 更新统计数据
  progress.stats.totalReviewed += 1;
  if (isCorrect) {
    progress.stats.totalCorrect += 1;
  } else {
    progress.stats.totalWrong += 1;
  }
  
  saveProgress(progress);
}
```

### 6.5 服务器实现

**Flask 服务器**（server.py）：

- 静态文件服务
- API 代理（/api/chat）
- 速率限制
- 请求日志
- MiniMax API 集成

**服务器管理脚本**（run.sh）：

```bash
./run.sh start        # 开发模式（Flask 内置服务器）
./run.sh start prod   # 生产模式（Gunicorn，4个 worker）
./run.sh stop         # 停止服务器
./run.sh restart      # 重启服务器
./run.sh install      # 安装依赖
```

**生产部署**：

```bash
# 使用 Gunicorn 部署
gunicorn server:app -w 4 -b 0.0.0.0:8080
```

---

## 7 界面设计方案

### 7.1 页面结构

网站包含以下页面：

1. **首页（词书选择+AI助手）**：主功能入口
2. **单词列表页**：按词书单元展示单词，支持分页和搜索
3. **闪卡测试页**：核心测试功能
4. **学习统计页**：展示学习进度
5. **错词本页**：错词管理和复习
6. **收藏页**：收藏单词管理

### 7.2 视觉设计

**色彩方案**：

- 主色调：蓝色系（#4A90D9），代表学习、信任感
- 辅助色：绿色（#7ED321）表示正确，红色（#E02020）表示错误
- AI 助手：绿色/青色渐变（#10B981 → #06B6D4）
- 背景色：浅灰色或浅蓝色（#F5F7FA）护眼设计
- 卡片：白色背景，轻微阴影

**字体选择**：

- 英文：Arial, Helvetica, sans-serif
- 中文："Microsoft YaHei", "PingFang SC", sans-serif
- 标题：加粗，适当增大字号

**交互效果**：

- 卡片翻转动画（3D 旋转效果，500ms）
- 按钮悬停效果
- 进度条动态填充
- 单词高亮显示
- 页面切换淡入淡出效果（300ms）

### 7.3 响应式设计

- 移动端优先设计
- 桌面端最大宽度限制（1200px）
- 平板横竖屏适配
- 触摸友好的按钮尺寸（最小 44x44px）

---

## 8 闪卡组件设计

### 8.1 闪卡结构

```html
<div class="flashcard" id="flashcard">
  <div class="flashcard-inner">
    <!-- 正面：问题 -->
    <div class="flashcard-front">
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="question-text" id="questionText"></div>
      <div class="source-info" id="sourceInfo"></div>
      <button class="btn-reveal" id="btnReveal">查看答案</button>
    </div>
    
    <!-- 反面：答案 -->
    <div class="flashcard-back">
      <div class="answer-word" id="answerWord">
        <span class="word-text"></span>
        <button class="audio-btn uk" onclick="speakCurrentWordUK()">🇬🇧</button>
        <button class="audio-btn us" onclick="speakCurrentWordUS()">🇺🇸</button>
      </div>
      <div class="answer-meaning" id="answerMeaning"></div>
      <div class="answer-example" id="answerExample"></div>
      <div class="answer-source" id="answerSource"></div>
      <div class="answer-actions">
        <button class="btn-known" id="btnKnown">记住了</button>
        <button class="btn-unknown" id="btnUnknown">没记住</button>
        <button class="btn-review" id="btnReview">稍后复习</button>
      </div>
    </div>
  </div>
</div>
```

### 8.2 闪卡样式

```css
.flashcard {
  width: 100%;
  max-width: 500px;
  height: 400px;
  perspective: 1000px;
  margin: 0 auto;
}

.flashcard-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

.flashcard.flipped .flashcard-inner {
  transform: rotateY(180deg);
}

.flashcard-front,
.flashcard-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 24px;
  box-sizing: border-box;
}

.flashcard-front {
  background: white;
}

.flashcard-back {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transform: rotateY(180deg);
}

.answer-source {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 16px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 20px;
}

.answer-source .source-value {
  color: #FFAB91;
}
```

### 8.3 闪卡交互逻辑

```javascript
class FlashCard {
  constructor(container) {
    this.container = container;
    this.isFlipped = false;
    this.currentQuestion = null;
    this.init();
  }
  
  init() {
    this.render();
    this.bindEvents();
  }
  
  flip() {
    this.isFlipped = !this.isFlipped;
    this.container.classList.toggle('flipped', this.isFlipped);
  }
  
  showQuestion(question) {
    this.currentQuestion = question;
    this.isFlipped = false;
    this.container.classList.remove('flipped');
    
    document.getElementById('questionText').textContent = question.question;
    document.getElementById('answerWord').querySelector('.word-text').textContent = question.answer.word;
    document.getElementById('answerMeaning').textContent = question.answer.meaning;
    document.getElementById('answerExample').textContent = 
      `${question.answer.example}\n${question.answer.translation || ''}`;
    document.getElementById('sourceInfo').textContent = 
      `${question._unitName}: ${question._unitTitle}`;
  }
  
  updateProgress(current, total) {
    const percent = (current / total) * 100;
    document.getElementById('progressFill').style.width = `${percent}%`;
  }
  
  bindEvents() {
    document.getElementById('btnReveal').addEventListener('click', () => {
      this.flip();
    });
    
    document.getElementById('btnKnown').addEventListener('click', () => {
      this.onMarkKnown && this.onMarkKnown();
    });
    
    document.getElementById('btnUnknown').addEventListener('click', () => {
      this.onMarkUnknown && this.onMarkUnknown();
    });
    
    document.getElementById('btnReview').addEventListener('click', () => {
      this.onMarkReview && this.onMarkReview();
    });
    
    // 点击单词播放发音
    document.getElementById('answerWord').addEventListener('click', () => {
      speakCurrentWordUK();
    });
  }
}
```

---

## 9 开发计划

### 9.1 第一阶段：基础功能

**目标**：实现基本的单词展示和闪卡测试功能

| 任务 | 描述 | 预估工时 |
|-----|------|---------|
| 项目初始化 | 创建 HTML/CSS/JS 项目结构 | 1小时 |
| 数据转换 | 将 WORDS.md 转换为 JSON 格式 | 2小时 |
| 基础 UI 样式 | 按钮、卡片、布局样式 | 2小时 |
| 单词列表页 | 实现单元选择和单词展示 | 4小时 |
| 闪卡测试页 | 实现闪卡测试核心功能 | 6小时 |
| 本地存储 | 实现用户数据本地存储 | 2小时 |
| 响应式适配 | 移动端界面适配 | 2小时 |

**交付物**：可运行的 MVP 版本，包含单词展示和闪卡测试功能

### 9.2 第二阶段：增强功能

**目标**：完善用户体验，增加辅助功能

| 任务 | 描述 | 预估工时 |
|-----|------|---------|
| 发音功能 | 集成 Web Speech API，支持英式和美式发音 | 2小时 |
| 搜索功能 | 单词搜索和筛选 | 2小时 |
| 进度追踪 | 学习数据统计和展示 | 4小时 |
| 错词本 | 错词管理和复习 | 4小时 |
| 收藏功能 | 收藏单词管理 | 2小时 |
| 分页功能 | 单词列表分页显示 | 2小时 |
| 动画效果 | 闪卡翻转动画优化 | 2小时 |

**交付物**：功能完整的正式版本

### 9.3 第三阶段：AI 集成

**目标**：集成 AI 助手，提供智能问答功能

| 任务 | 描述 | 预估工时 |
|-----|------|---------|
| 后端服务器 | Python Flask 服务器搭建 | 4小时 |
| API 代理 | MiniMax API 代理集成 | 2小时 |
| 速率限制 | 防止恶意高频调用 | 2小时 |
| 前端集成 | AI 助手界面和交互 | 4小时 |
| Markdown 支持 | AI 回复 Markdown 渲染 | 2小时 |
| 安全配置 | API Key 保护和配置文件 | 2小时 |
| 生产部署 | Gunicorn 部署配置 | 2小时 |

**交付物**：完整的 AI 助手功能，支持生产环境部署

---

## 10 部署方案

### 10.1 开发环境部署

**使用 run.sh 脚本**：

```bash
# 安装依赖
./run.sh install

# 启动服务器（开发模式）
./run.sh start

# 或启动服务器（生产模式）
./run.sh start prod

# 访问地址
# http://localhost:8080
```

### 10.2 生产环境部署

**方式一：直接使用 Gunicorn**

```bash
# 安装依赖
pip install gunicorn flask requests

# 启动 Gunicorn
gunicorn server:app -w 4 -b 0.0.0.0:8080 --pid server.pid
```

**方式二：使用 Docker（可选）**

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8080
CMD ["gunicorn", "server:app", "-w", "4", "-b", "0.0.0.0:8080"]
```

### 10.3 静态前端部署

**推荐平台**：GitHub Pages、Netlify、Vercel

**部署步骤**：

1. 将前端文件（index.html、css、js、data）部署到静态托管平台
2. 后端服务器单独部署
3. 修改前端 API 请求地址指向后端服务器

**优势**：

- 免费托管静态资源
- 自动 HTTPS
- 全球 CDN 加速
- 版本管理方便

### 10.4 API 配置

**配置步骤**：

1. 复制配置文件模板
   ```bash
   cp api_config.example.py api_config.py
   ```

2. 编辑配置文件，填入 API Key
   ```python
   MINIMAX_API_KEY = 'your-api-key-here'
   ```

3. 重启服务器

---

## 11 附录

### 11.1 参考资料

- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [CSS 3D Transforms](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)
- [localStorage API](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [MiniMax API](https://platform.minimaxi.com/docs/guides/quickstart-sdk)

### 11.2 术语说明

| 术语 | 说明 |
|-----|------|
| 闪卡（Flash Card） | 一种学习工具，正面显示问题，反面显示答案 |
| TTS | Text-to-Speech，文字转语音技术 |
| 艾宾浩斯曲线 | 描述记忆遗忘规律的曲线，用于优化复习间隔 |
| localStorage | 浏览器本地存储 API，用于保存用户数据 |
| WSGI | Web Server Gateway Interface，Python Web 服务器接口标准 |
| Gunicorn | Python WSGI HTTP 服务器，用于生产环境部署 |
| 速率限制 | 限制单位时间内的请求次数，防止 API 滥用 |

### 11.3 更新日志

| 版本 | 日期 | 说明 |
|-----|------|------|
| v1.0 | 2026-01-18 | 初始设计方案 |
| v1.1 | 2026-01-18 | 更新技术栈为原生 HTML/CSS/JS，简化实现方案 |
| v2.0 | 2026-01-18 | 重大更新：添加 Python 后端服务器、AI 助手、速率限制、Gunicorn 生产部署支持 |

---

## 12 常见问题

### 12.1 服务器相关

**问：服务器无法启动？**
答：请检查是否安装了依赖：`./run.sh install`，并确认 `api_config.py` 已配置 API Key。

**问：API 请求返回 429 错误？**
答：这是速率限制触发，请等待一段时间后再试。当前限制为每小时 20 次请求。

**问：如何查看服务器日志？**
答：开发模式下日志会输出到终端。生产模式下日志默认写入 stdout。

### 12.2 功能相关

**问：发音功能不工作？**
答：请确保浏览器支持 Web Speech API。某些浏览器可能需要用户交互后才能播放声音。

**问：数据没有更新？**
答：请尝试清除浏览器缓存（Ctrl+Shift+R 或 Cmd+Shift+R），然后刷新页面。

**问：错词本显示不正确？**
答：请检查 `localStorage` 中是否有损坏的数据，尝试清除后重新测试。