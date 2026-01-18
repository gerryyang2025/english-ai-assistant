# 英语单词记忆网站

专为英语学习者设计的英语单词学习助手，帮助轻松记忆英语单词。

## 📖 项目介绍

本系统是一个交互式英语单词学习网站，通过闪卡测试、进度追踪、AI 助手等多种方式，帮助更高效地记忆英语单词。网站支持根据教材单元组织单词内容，提供灵活的测试模式，并具备简洁友好的用户界面。

## 🎯 主要功能

### 1. 单词列表浏览
- **按词书单元查看**：支持切换查看不同词书的单元单词内容
- **分页显示**：单词列表分页展示，每页 20 个单词
- **搜索功能**：支持中英文搜索，快速找到目标单词
- **详细信息**：每个单词包含音标、中文含义、例句和记忆技巧
- **发音功能**：点击国旗图标播放单词发音，支持英式（🇬🇧）和美式（🇺🇸）发音
- **收藏功能**：可以收藏喜欢的单词，方便复习

### 2. 闪卡测试
- **词书单元选择**：支持单选或多选单元进行测试
- **三种测试模式**：
  - 英文 → 中文：看英文说中文含义
  - 中文 → 英文：看中文说英文单词
  - 混合模式：随机切换以上两种方式
- **翻转闪卡**：点击"查看答案"按钮，卡片翻转显示答案
- **掌握记录**：回答后点击"记住了"或"没记住"记录掌握情况
- **稍后复习**：可以将困难单词标记为稍后复习
- **进度显示**：实时显示当前测试进度
- **来源信息**：显示单词所属词书和单元，方便回溯

### 3. AI 智能助手
- **智能问答**：解答单词用法、语法规则等复杂问题
- **Markdown 格式**：支持 Markdown 格式展示回复，结构清晰
- **保护 API Key**：后端代理调用，保护 API Key 不暴露
- **速率限制**：防止恶意高频调用（20 次/小时）

### 4. 学习进度追踪
- **今日统计**：显示今日学习单词数、正确率和连续学习天数
- **单元进度**：查看每个单元的学习进度
- **总体统计**：显示总单词数、已掌握单词数、总体正确率
- **错词本**：自动记录错误次数多的单词，方便重点复习
- **掌握程度**：按掌握程度分类显示（已掌握、待复习、学习中）
- **连续天数**：记录连续学习天数，鼓励坚持学习

### 5. 数据持久化
- **本地存储**：学习进度保存在浏览器本地存储中
- **隐私安全**：数据仅存储在本地，不上传到服务器
- **跨会话**：关闭浏览器后重新打开，进度数据仍然保留

## 📁 文件结构

```
english-notes/
├── index.html              # 主页面
├── server.py               # Python Flask 后端服务器
├── run.sh                  # 服务器管理脚本
├── api_config.py           # API 配置文件（忽略版本控制）
├── api_config.example.py   # API 配置模板
├── css/
│   └── main.css            # 样式文件
├── js/
│   └── app.js              # 应用程序
├── data/
│   └── words.json          # 单词数据文件
├── tools/
│   └── update-tool.html    # 数据更新工具
├── convert.js              # 数据转换脚本（Node.js）
├── DESIGN.md               # 设计文档
├── README.md               # 本文档
├── TODO.md                 # 待办事项
└── WORDS.md                # 原始单词数据
```

## 🚀 使用方法

### 方法一：使用 Python 服务器（推荐，需要 AI 功能）

如果需要使用 AI 助手功能，建议使用 Python 服务器运行：

```bash
# 进入项目目录
cd /path/to/english-notes

# 首次安装依赖
./run.sh install

# 启动服务器（开发模式）
./run.sh start

# 或启动服务器（生产模式，支持高并发）
./run.sh start prod

# 然后在浏览器中访问
# http://localhost:8080

# 停止服务器
./run.sh stop

# 重启服务器
./run.sh restart
```

**服务器管理命令**：

| 命令 | 说明 |
|------|------|
| `./run.sh install` | 安装依赖（Flask、requests、Gunicorn） |
| `./run.sh start` | 启动服务器（开发模式） |
| `./run.sh start prod` | 启动服务器（生产模式，Gunicorn） |
| `./run.sh stop` | 停止服务器 |
| `./run.sh restart` | 重启服务器 |

### 方法二：使用简单的 HTTP 服务器

如果不需要 AI 功能，可以使用简单的 HTTP 服务器：

**使用 Python：**
```bash
# 进入项目目录
cd /path/to/english-notes

# 启动服务器
python3 -m http.server 8080

# 然后在浏览器中访问
# http://localhost:8080
```

**使用 Node.js：**
```bash
# 进入项目目录
cd /path/to/english-notes

# 使用 npx 启动
npx serve .

# 或者使用 http-server
npx http-server -p 8080
```

**使用 VS Code：**
1. 安装 "Live Server" 扩展
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"

### 方法三：直接在浏览器中打开

1. 在文件管理器中找到 `index.html` 文件
2. 双击用浏览器（Chrome、Edge、Safari、Firefox等）打开即可

**注意**：直接打开文件可能无法使用 AI 功能，且部分浏览器可能限制语音功能。

## 🔧 API 配置

### 配置 MiniMax API Key

AI 助手功能需要配置 MiniMax API Key：

1. **复制配置文件模板**
   ```bash
   cp api_config.example.py api_config.py
   ```

2. **编辑配置文件**
   ```bash
   # 编辑 api_config.py，填入你的 API Key
   nano api_config.py
   ```

   内容示例：
   ```python
   # MiniMax API Key
   MINIMAX_API_KEY = 'your-api-key-here'
   
   # API Endpoint
   MINIMAX_API_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
   
   # Model name
   MINIMAX_MODEL = 'MiniMax-M2.1'
   ```

3. **获取 API Key**
   - 访问 [MiniMax 平台](https://platform.minimaxi.com)
   - 注册账号并创建 API Key
   - 将 API Key 填入 `api_config.py`

4. **重启服务器**
   ```bash
   ./run.sh restart
   ```

### 速率限制

AI 助手功能有以下限制：
- 每小时最多 20 次请求
- 连续请求间隔至少 5 秒
- 超限会返回 429 错误，提示等待时间

## 📚 单词数据

系统目前包含以下词书的单词内容：

### 英语五年级上册（12个单元，193个单词）

| 单元 | 主题 | 分类 | 单词数 |
|------|------|------|--------|
| Unit 1 | My future（我的未来） | 职业类 | 13 |
| Unit 2 | Going to school（上学交通） | 交通类 | 17 |
| Unit 3 | My birthday（生日序数词） | 序数词 | 40 |
| Unit 4 | Grandparents（频率副词） | 频率副词 | 8 |
| Unit 5 | Friends（朋友交流） | 日常交流类 | 18 |
| Unit 6 | Family life（家庭生活） | 房间类 | 16 |
| Unit 7 | At the beach（海滩度假） | 度假类 | 12 |
| Unit 8 | An outing（远足探险） | 远足探险类 | 13 |
| Unit 9 | Around the city（城市方向） | 方向类 | 13 |
| Unit 10 | Wind（风的副词） | 副词类 | 14 |
| Unit 11 | Water（水与自然） | 生活自然类 | 16 |
| Unit 12 | Fire（消防安全） | 安全类 | 13 |

### 英语六年级上册（1个单元，10个单词）

| 单元 | 主题 | 分类 | 单词数 |
|------|------|------|--------|
| Unit 1 | Growing up（成长变化） | 成长变化类 | 10 |

## 🔄 更新单词数据

当您修改了 `WORDS.md` 文件后，需要将内容同步到网站数据。有以下几种方式：

### 方法一：使用更新工具（推荐）

这是最简单的方式，无需安装任何工具：

1. **打开更新工具**
   
   在浏览器中打开 `tools/update-tool.html` 文件：
   
   ```bash
   # 在 macOS 上
   open tools/update-tool.html
   
   # 或者在文件管理器中双击打开
   ```

2. **上传 WORDS.md 文件**
   
   - 点击或拖拽 `WORDS.md` 文件到上传区域
   - 工具会自动解析并显示数据预览

3. **生成并下载数据文件**
   
   点击"生成并下载数据文件"按钮，会下载 `words.json` 文件

4. **更新项目文件**
   
   ```bash
   # 复制 words.json 到 data 目录
   cp words.json data/words.json
   ```

5. **刷新页面**
   
   重新打开 `index.html` 查看更新后的内容。

### 方法二：使用 Node.js 脚本

如果你的电脑上安装了 Node.js，可以使用命令行工具：

```bash
# 进入项目目录
cd /path/to/english-notes

# 运行转换脚本
node convert.js

# 脚本会自动：
# 1. 读取 WORDS.md 文件
# 2. 解析单词数据
# 3. 更新 data/words.json
```

### 方法三：手动更新

1. **编辑 WORDS.md**
   
   按照现有格式添加或修改单词内容。格式说明：
   
   ```
   ## Unit X
   
   Title: 单元标题 Category: 分类名称
   
   * 单词 /音标/ 含义 - 例句：(翻译)
   * 单词 /音标/ 含义 - 记忆：记忆技巧
   ```

2. **运行转换脚本**
   
   ```bash
   node convert.js
   ```

3. **或手动更新 JSON 文件**
   
   如果你熟悉 JSON 格式，可以直接编辑 `data/words.json` 文件。

## 🎨 设计特点

- **友好的界面**：色彩柔和，适合儿童使用
- **大字体显示**：单词和内容采用大字体，方便阅读
- **动画效果**：闪卡翻转动画增加学习趣味性
- **响应式设计**：支持电脑、平板和手机等多种设备
- **操作简单**：按钮大且清晰，易于点击操作
- **AI 助手**：绿色/青色渐变主题，突出显示

## 🔧 技术实现

- **前端**：HTML5 + CSS3 + JavaScript（原生实现）
- **后端**：Python Flask（API 代理，保护 API Key）
- **AI 服务**：MiniMax API（通过后端代理调用）
- **CSS 动画**：流畅的动画效果
- **Web Speech API**：浏览器内置语音合成（支持英式和美式发音）
- **localStorage**：本地数据持久化存储
- **速率限制**：防止 API 滥用（20 次/小时）
- **生产部署**：Gunicorn 支持高并发

## 📝 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-01-18 | 初始版本，完成核心功能 |
| v2.0 | 2026-01-18 | 添加 Python 后端服务器、AI 助手、速率限制、Gunicorn 生产部署支持 |

## 📄 许可证

本项目仅供学习交流使用。

## 🤝 贡献

欢迎提出建议和改进意见！
