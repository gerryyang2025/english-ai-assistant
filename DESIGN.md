# 英语学习小精灵设计方案

## 1 项目概述

### 1.1 核心目标
为英语学习者设计综合学习平台，通过单词记忆、语句练习、阅读跟读、AI 助手等多种方式高效学习。

### 1.2 设计原则
- **简洁友好**：界面清晰，操作简单，适合各年龄段
- **循序渐进**：按教材单元组织，从易到难
- **多感官学习**：视觉（闪卡）、听觉（发音）、动觉（交互）
- **数据驱动**：进度追踪和错题记录优化学习路径

---

## 2 功能架构

### 2.1 核心功能模块
| 模块 | 功能 |
|------|------|
| 单词 | 按单元展示、搜索、分页、发音、收藏 |
| 闪卡测试 | 三种测试模式、掌握记录、进度追踪 |
| 语句练习 | 句子听写、智能分词、语音播放 |
| 阅读 | 材料展示、知识点、逐句播放 |
| 听书 | 书本章节选择、多音色切换、倍速播放 |
| 错题本 | 错词错句管理、复习功能 |
| AI 助手 | 单词用法、语法问答 |
| 工具 | Markdown/JSON 转换、实时生效 |

### 2.2 数据流
```
用户选择 → 生成题目 → 记录结果 → 更新进度
                      ↓
            错题本 / 收藏 / 统计
```

---

## 3 技术方案

### 3.1 技术栈
- **前端**：HTML5 + CSS3 + 原生 JavaScript
- **后端**：Python Flask（API 代理，保护 API Key）
- **存储**：JSON 文件 + localStorage
- **语音**：Web Speech API + MiniMax 音色复刻

### 3.2 架构特点
- 前后端分离，前端静态化
- 用户数据本地存储，隐私安全
- 后端仅 API 代理，无复杂业务逻辑
- 支持 Chrome（桌面/移动）+ iPad Chrome APP 模式

### 3.3 语音架构（多音色）
```
前端配置
├── AppState.speechCloneVoices: [{file_id, description}, ...]
├── AppState.speechCloneSelectedVoice: 当前选择
└── AppState.speechCloneAudioCache: Map<hash, url>

后端 API
├── GET /api/status → 返回 voices 列表
└── POST /api/voice-clone → 接收 file_id 参数
```

---

## 4 核心设计模式

### 4.1 状态管理
```javascript
const AppState = {
    // 静态数据
    wordData: [], readings: [], speechData: [],
    
    // 用户数据（localStorage 持久化）
    userProgress: {},
    wrongBook: {},
    favorites: [],
    
    // 语音状态
    speechCloneVoices: [],
    speechCloneSelectedVoice: null,
    speechCloneAudioCache: new Map(),
    
    // 会话状态
    speechVoiceMode: 'system',
    speechPlaybackSpeed: 1.0,
};
```

### 4.2 页面切换
SPA 模式，通过 CSS 类控制页面显隐：
- 所有页面预先加载，通过 `active` 类切换
- 页面切换触发对应的初始化函数

### 4.3 语音下拉框动态生成
```javascript
function initSpeechVoiceDropdown() {
    // 保留 system 选项
    // 动态生成音色选项：音色 (description)
    // 默认选择 system 模式
}
```

### 4.4 语音切换缓存处理
```javascript
function changeVoiceMode(mode) {
    // 切换不同音色时清除缓存
    if (previousVoice.file_id !== newVoice.file_id) {
        AppState.speechCloneAudioCache.clear();
    }
}
```

---

## 5 用户界面设计

### 5.1 视觉风格
- **主色调**：蓝色系
- **辅助色**：绿色（正确）、红色（错误）
- **动画**：卡片翻转、页面切换

### 5.2 响应式断点
- 默认：桌面 >768px
- iPad：768px - 1024px（专用优化）
- 平板：481px - 768px
- 手机：361px - 480px
- 小屏：≤360px

### 5.3 iPad 优化
- viewport-fit=cover
- 动态视口高度（dvh/svh）
- 安全区域适配
- 底部控制栏防遮挡

---

## 6 常见问题准则

### 6.1 HTML 属性传参
- 使用索引替代文本传递
- 通过全局状态存储数据

### 6.2 输入框按键
- 空格键阻止默认滚动
- 方向键阻止默认行为

### 6.3 复习数据保留
- 保留原始数据的 id 进行排重
- 复习错句/错词时保留原始 id
