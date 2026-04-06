# 爱英语学习 - 墨小灵

专为英语学习者设计的综合学习平台，支持单词记忆、语句练习、阅读跟读、AI 助手等功能。

## 核心功能

| 模块 | 功能 |
|------|------|
| **单词** | 按单元查看、分页浏览、搜索、中英互译 |
| **闪卡测试** | 词书单元选择、三种测试模式、掌握记录 |
| **语句练习** | 句子听写、智能分词、语音播放 |
| **阅读** | 阅读材料、知识点展示、语音播放 |
| **听书** | 书本章节选择、音色切换、倍速播放 |
| **错题本** | 错词错句管理、复习功能 |
| **墨小灵 / AI** | 首页纯 Lottie 角色 + 单词用法解释、语法问答 |
| **进度追踪** | 今日统计、学习进度、连续天数 |

## 文件结构

```
english-ai-assistant/
├── index.html              # 主页面
├── server.py               # Flask 后端
├── api_config.py           # API 配置（忽略版本控制）
├── api_config.example.py   # 配置模板
├── css/                    # 样式文件
├── js/app.js               # 前端逻辑
├── images/                 # 其他静态图（可选）
├── lottie/                 # 首页墨小灵 Lottie（无参数时每次刷新随机多形象之一；可选 ?mascot= / localStorage 固定，见 lottie/README.md）
├── data/                   # 数据文件
│   ├── words.json
│   ├── readings.json
│   └── listen.json
├── WORDS.md                # 单词数据源
├── READINGS.md             # 阅读数据源
└── LISTEN.md               # 听书数据源
```

## 快速开始

```bash
# 安装依赖
./optools.sh install

# 启动服务器
./optools.sh start

# 浏览器访问 http://localhost:8082
```

## 服务器命令

| 命令 | 说明 |
|------|------|
| `./optools.sh install` | 安装依赖 |
| `./optools.sh start` | 启动服务器 |
| `./optools.sh start prod` | 生产模式 |
| `./optools.sh stop` | 停止服务器 |
| `./optools.sh restart` | 重启服务器 |
| `./optools.sh status` | 检查状态 |

## API 配置

```bash
cp api_config.example.py api_config.py
# 编辑 api_config.py，填入 MiniMax API Key
./optools.sh restart
```

### 音色复刻配置

```python
MINIMAX_VOICE_CLONE_VOICES = [
    {
        'file_id': 123456789012345,
        'description': 'gerry (默认)'
    },
    {
        'file_id': 987654321098765,
        'description': 'Teacher Li'
    }
]
```

## 数据更新

转换与检查时会自动忽略源文件中的 `<!-- ... -->` 注释块（如格式示例），仅解析正文内容。

### 在线工具

导航栏点击「工具」按钮，可上传 Markdown 或 JSON 文件实时生效。

### 命令行工具

**数据转换**（Node.js，可用 `node 脚本名` 或 `./脚本名`）：

```bash
./convert-words.js      # 或 node convert-words.js  — 转换单词数据
./convert-readings.js   # 或 node convert-readings.js — 转换阅读数据
./convert-listen.js     # 或 node convert-listen.js  — 转换听书数据
```

**格式检查**（Python，可用 `python3 脚本名` 或 `./脚本名`）：

```bash
./check-words-format.py     # 或 python3 check-words-format.py  — 检查 WORDS.md
./check-readings-format.py # 或 python3 check-readings-format.py — 检查 READINGS.md
./check-listen-format.py   # 或 python3 check-listen-format.py   — 检查 LISTEN.md
```

## 技术栈

- **前端**: HTML5 + CSS3 + JavaScript（[lottie-web](https://github.com/airbnb/lottie-web) CDN 用于面部眨眼/口型叠加）
- **后端**: Python Flask
- **AI**: MiniMax API
- **存储**: localStorage 本地存储

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)


## Refer

* https://github.com/gerryyang2025/ChinaTextbook
