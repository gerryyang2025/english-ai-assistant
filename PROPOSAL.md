# 英语单词记忆网站设计方案

## 需求描述

设计一个高效记忆英语单词的网站，具备以下功能：

1. **单词展示功能**：
   - 网页上可以根据不同词书单元显示对应的英语单词、单词中文解释、例句或用法
   - 单词信息通过格式化定义的单词文件（WORDS.md）提供
   - 支持分页显示、中英文搜索、收藏功能

2. **闪卡测试功能**：
   - 支持选择指定的单元（一个或多个），生成记忆闪卡测试
   - 可以选择英文提问中文、中文提问英文或混合模式
   - 每个问题页面有"查看答案"按钮，点击后翻转卡片显示答案
   - 包含单词、释义、例句完整信息
   - 添加"记住"/"忘记"按钮记录掌握情况
   - 进度条显示当前测试进度
   - 测试结果统计（正确率、用时等）
   - 错词自动加入错词本
   - **支持独立选择词书**，闪卡测试与单词列表使用独立的词书选择

3. **AI 助手功能**：
   - 提供智能问答功能，解答单词用法、语法规则等复杂问题
   - 支持 Markdown 格式展示回复
   - 保护 API Key 不暴露在前端
   - 防止恶意高频调用（速率限制）

4. **发音功能**：
   - 点击单词播放发音
   - 支持英式发音（🇬🇧）和美式发音（🇺🇸）

5. **学习进度追踪**：
   - 记录学习进度、错词本、收藏夹
   - 展示统计信息

6. **每日一笑功能**：
   - 首页显示每日随机英文笑话
   - 调用 Chuck Norris API 获取笑话
   - 获取失败时自动隐藏，不影响用户体验

7. **服务健康检查**：
   - 后端提供 /api/health 健康检查端点
   - 前端启动时自动检测服务状态
   - 服务不可用时显示友好错误提示界面

8. **阅读模块功能**：
   - 提供英语阅读材料跟读练习
   - 阅读列表页面显示所有可用材料
   - 阅读详情页面显示完整对话内容
   - 支持逐句语音播放（Web Speech API）
   - 重点句型高亮展示
   - 知识点 Markdown 渲染
   - 阅读进度追踪

9. **工具页面功能**：
   - Markdown 文件转换为 JSON 格式
   - JSON 文件上传实时生效，无需重启服务器
   - 数据预览功能
   - 格式帮助文档
   - 单词数据和阅读数据两种模式

10. **数据安全检查**：
    - 上传文件类型验证（支持 .md 和 .json 后缀）
    - 文件大小限制（最大 2MB）
    - 内容安全扫描（防止恶意脚本上传）
    - 危险模式检测（script 标签、iframe、event handlers 等）

11. **格式检查工具**：
    - 单词格式检查：`python3 check-words-format.py`
    - 阅读格式检查：`python3 check-readings-format.py`
    - 验证数据格式正确性
    - 报告错误和警告

12. **语句练习功能**：
    - 选择书本和单元进行句子听写练习
    - 句子自动分词生成输入框
    - 支持检查答案和显示参考答案
    - 支持播放句子语音
    - 记录练习结果（正确数、错误数、用时）
    - 答错的句子自动加入错句本

13. **错句复习功能**：
    - 从错句本中选择句子进行复习
    - 复用语句练习界面
    - 错句随机排序
    - 复习时答错不重复添加，自动更新错词次数

## 技术栈选择

- **前端**：HTML5 + CSS3 + JavaScript（原生实现，支持 Chrome 浏览器及 iPad）
- **后端**：Python Flask
- **数据存储**：JSON 文件 + localStorage
- **AI 服务**：MiniMax API（通过后端代理调用）
- **外部 API**：Chuck Norris Jokes API（每日笑话）
- **部署**：静态前端托管 + Python 后端服务器

**浏览器兼容性说明：**
- 本系统针对 Chrome 浏览器进行开发和测试
- 利用 Chrome 专有特性实现最佳用户体验
- **新增 iPad Chrome APP 模式支持**：完整的移动端适配，包括安全区域适配、动态视口高度、滚动优化
- 建议用户使用 Chrome 浏览器访问以获得完整功能支持

## 网站结构

```
英语单词记忆网站
├── 首页（每日笑话 + 词书选择 + AI助手）
├── 单词列表页（分页/搜索）
├── 闪卡测试页面（独立词书选择）
├── 学习统计页
├── 错题本管理页（错词 + 错句）
├── 收藏夹管理页
├── 语句练习页（句子听写）
├── 阅读页（阅读列表 + 详情 + 语音播放）
├── 工具页（Markdown/JSON 转换 + 实时生效）
└── Python 后端服务器（API 代理 + 静态文件服务 + 健康检查）
```

## 核心功能模块设计

### 数据流程设计

```
初始化
    ↓
检查服务健康状态（/api/health）
    ↓
加载单词数据（JSON格式，支持多词书结构）
    ↓
加载每日笑话（Chuck Norris API）
    ↓
词书单元选择 → 筛选对应单词数据
    ↓
学习模式：展示单词列表，支持搜索/过滤/分页
    ↓
测试模式：
  + 用户选择词书（独立于单词列表）
  + 用户选择单元（多选）
  + 选择测试模式（英→中 / 中→英 / 混合）
  + 生成测试队列
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

### 每日笑话模块

**功能特点**：
- 位于首页英雄区域，替换原有的静态标语
- 调用第三方 API 获取随机英文笑话
- 5秒超时，避免长时间等待
- 获取失败时自动隐藏，不显示错误信息

**API 调用**：
```javascript
// 端点: GET https://api.chucknorris.io/jokes/random
// 响应格式:
{
  "categories": [],
  "created_at": "2020-01-05T13:42:20.841843Z",
  "icon_url": "https://api.chucknorris.io/img/avatar/chuck-norris.png",
  "id": "w0M0-3ByTOOMBtfnnXqblw",
  "updated_at": "2020-01-05T13:42:20.841843Z",
  "url": "https://api.chucknorris.io/jokes/w0M0-3ByTOOMBtfnnXqblw",
  "value": "Why did the chicken cross the road? To get away from Chuck Norris..."
}
```

### 服务健康检查模块

**后端端点**：
```python
# 端点: GET /api/health
# 响应: {"status": "ok", "service": "english-ai-assistant", "timestamp": "..."}
# CORS: Access-Control-Allow-Origin: *
```

**前端检测**：
- 页面加载时调用 /api/health
- 使用 AbortController 实现5秒超时
- 服务不可用时显示错误覆盖层
- 隐藏主内容，避免显示缓存旧页面

### 单词数据管理模块

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
            "category": "职业相关"
          }
        ]
      }
    ]
  }
]
```

**特点**：
- 支持多词书结构
- 单词 ID 在所有词书中唯一（包含词书前缀）
- 支持音标、例句、翻译、记忆技巧

### 学习模块

**词书/单元选择区**：
- 卡片式或列表式词书展示
- 支持展开查看单元详情
- 显示每个单元的单词数量
- 支持多选模式
- 显示每个单元的学习进度

**单词展示区**：
- 表格形式展示单词、音标、中文释义、例句、记忆技巧
- 分页显示（每页 20 个单词）
- 点击国旗图标播放发音（🇬🇧 英音 / 🇺🇸 美音）（使用 Web Speech API）
- 收藏/取消收藏功能
- 中英文搜索过滤

### 闪卡测试模块

**测试设置面板**：
- 词书/单元选择（多选）
- 测试模式选择（英→中 / 中→英 / 随机混合）

**闪卡界面**：
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
- 翻转卡片显示答案
- 包含单词、释义、例句、记忆技巧
- 显示词书和单元来源信息
- 支持点击单词播放发音
- "记住"/"忘记"按钮记录掌握情况

### AI 助手模块

**功能特点**：
- 位于首页英雄区域下方
- 绿色/青色渐变主题
- 支持 Markdown 格式展示
- 后端代理保护 API Key

**API 设计**：
```python
# 端点: POST /api/chat
# 请求: {"question": "问题内容"}
# 响应: {"answer": "Markdown格式答案"}

# 速率限制
RATE_LIMIT = {
    'requests_per_hour': 20,   # 每小时最大请求数
    'cooldown_seconds': 5,     # 请求间隔冷却时间
}
```

### 服务器管理

**使用 run.sh 脚本**：
```bash
./run.sh install      # 安装依赖
./run.sh start        # 开发模式（Flask）
./run.sh start prod   # 生产模式（Gunicorn）
./run.sh stop         # 停止服务器
./run.sh restart      # 重启服务器
./run.sh status       # 检查服务器状态
```

**生产部署**：
```bash
gunicorn server:app -w 4 -b 0.0.0.0:8082
```

**服务管理功能**：
- PID 文件记录（.server.pid）
- 多重停止机制（PID 文件 + 进程名查找）
- 详细的启动/停止日志
- 虚拟环境自动检测和创建

## 视觉设计

**色彩方案**：
- 主色调：蓝色系（#4A90D9）
- 辅助色：绿色（正确）、红色（错误）
- AI 助手：绿色/青色渐变（#10B981 → #06B6D4）
- 背景：浅灰色护眼设计
- 闪卡背面：紫色渐变（#667eea → #764ba2）

**交互效果**：
- 卡片翻转动画（3D 旋转效果，600ms）
- 按钮悬停效果
- 进度条动态填充
- 页面切换淡入淡出效果

**响应式设计（Chrome 浏览器优化，含 iPad 支持）：

| 断点 | 设备类型 | 典型屏幕宽度 |
|------|----------|--------------|
| 默认 | 桌面设备 | > 768px |
| iPad | iPad 专用 | 768px - 1024px |
| @media (max-width: 768px) | 平板设备 | 481px - 768px |
| @media (max-width: 480px) | 手机设备 | 361px - 480px |
| @media (max-width: 360px) | 小屏手机 | ≤ 360px |

**响应式适配要点（Chrome 特性优化，含 iPad）：
- 移动端优先设计理念
- 桌面端最大宽度限制（1200px）
- 触摸友好的按钮尺寸（最小 44x44px）
- 闪卡高度自适应调整（支持内容溢出滚动）
- 单词卡片竖向堆叠布局
- 导航栏响应式隐藏/显示
- 服务错误提示层响应式适配
- 利用 Chrome CSS 特性实现流畅动画效果
- **iPad 专用：动态视口高度（100dvh/100svh）、安全区域适配、底部控制栏防遮挡、滚动区域优化**

**移动端优化**：
- 单词列表：例句、发音图标、翻译自动换行不纵向排列
- 闪卡测试：增大高度确保"记住了/没记住/稍后复习"按钮在可视区域
- 收藏页面：页面头部纵向堆叠，统计徽章全宽居中
- 错词本页面：完整的响应式适配

## 文件结构

```
english-ai-assistant/
├── index.html              # 主页面
├── server.py               # Python Flask 后端服务器
├── run.sh                  # 服务器管理脚本
├── api_config.py           # API 配置文件（忽略版本控制）
├── api_config.example.py   # API 配置模板
├── README.md               # 项目说明
├── DESIGN.md               # 详细设计文档
├── PROPOSAL.md             # 项目提案文档
├── TODO.md                 # 待办事项
├── .gitignore              # Git 忽略配置
├── .gitattributes          # Git 属性配置
├── css/
│   ├── main.css            # 主样式文件
│   └── readings.css        # 阅读页面样式
├── js/
│   └── app.js              # 应用程序（包含健康检查、笑话加载、工具页面）
├── data/
│   ├── words.json          # 单词数据文件
│   └── readings.json       # 阅读数据文件
├── tools/
│   └── update-tool.html    # 数据更新工具
├── WORDS.md                # 原始单词数据
├── READINGS.md             # 原始阅读数据
├── convert-words.js        # 单词数据转换脚本（Node.js）
├── convert-readings.js     # 阅读数据转换脚本（Node.js）
├── check-words-format.py   # 单词数据格式检查工具（Python）
├── check-readings-format.py # 阅读数据格式检查工具（Python）
└── venv/                   # Python 虚拟环境（忽略版本控制）
```

## 附录

### 技术参考资料

- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Gunicorn Documentation](https://docs.gunicorn.org/)
- [MiniMax API](https://platform.minimaxi.com/docs/guides/quickstart-sdk)
- [Chuck Norris API](https://api.chucknorris.io/)

### 术语说明

| 术语 | 说明 |
|-----|------|
| 闪卡（Flash Card） | 学习工具，正面显示问题，反面显示答案 |
| TTS | Text-to-Speech，文字转语音技术 |
| WSGI | Python Web 服务器接口标准 |
| Gunicorn | Python WSGI HTTP 服务器 |
| 速率限制 | 限制单位时间内的请求次数 |
| CORS | 跨域资源共享，允许跨域请求 |
| AbortController | 用于取消 fetch 请求的控制器 |
