# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 首页「墨小灵」互动区：**纯 Lottie 矢量角色**（默认 `lottie/mascot-bot.json` bot 形象，[lottie-web](https://github.com/airbnb/lottie-web) 播放），与 AI 单词问答（`/api/chat`）一体化；无位图叠加；`thinking`/`happy` 通过播放速率区分；`prefers-reduced-motion` 下以静态占位替代
- 备选 LottieFiles 角色 `lottie/mascot-character.json`；通过 `?mascot=lottiefiles` 或 `localStorage.moxiaolingLottieVariant` 切换（见 `lottie/README.md`）
- 虚拟形象交互：光晕与思考点、答毕星光、对话气泡、点击/键盘鼓励语、视差倾斜、Web Audio 点击提示音
- 问答区支持回车提交、结果区 `aria-live`；联网搜索平铺展示且默认开启（不再收入家长折叠区）

### Changed
- 网站名称由「英语学习 - 墨小灵」改为「爱英语学习 - 墨小灵」（标题、顶栏、页脚、README、DESIGN）
- 首页问答文案儿童向调整（「问小灵」、提示语等）；墨小灵面板配色与站点主色统一
- 首页问答主标题为「墨小灵陪你学英语」；联网搜索改为平铺、默认开启
- 首页 Hero：**今日一词**（从词书 `words.json` 按日期确定性选词，含音标、释义、例句/译文、记忆提示；「问墨小灵」预填问题并滚动到问答区），**移除** Chuck Norris 外链笑话

## [3.6] - 2026-03-21

正式发布系统。

### Changed
- 网站名称由「英语学习小精灵 - 记住么」改为「英语学习 - 墨小灵」（页面标题、顶栏、页脚及文档）
- 转换脚本 `convert-words.js`、`convert-readings.js`、`convert-listen.js` 增加 shebang（`#!/usr/bin/env node`），支持直接执行 `./convert-words.js` 等
- 格式检查脚本 `check-words-format.py`、`check-readings-format.py`、`check-listen-format.py` 已设为可执行，支持 `./check-words-format.py` 等直接运行
- README 中命令行工具说明已更新：补充听书转换与听书格式检查，并区分「数据转换」与「格式检查」及两种运行方式

### Fixed
- 格式检查工具 `check-words-format.py` 现在会跳过 `<!-- ... -->` 注释块，避免将文件内示例格式误解析为内容，消除「单元 Unit 2 没有单词」等误报
- 转换脚本 `convert-words.js` 解析时跳过 `<!-- ... -->` 注释块，不再将 WORDS.md 开头的格式示例写入 words.json
- 转换脚本 `convert-readings.js` 解析时跳过注释块，并过滤掉无句型/知识点/对话的空壳阅读条目，避免 READINGS.md 示例进入 readings.json

## [3.5] - 2026-02-01

### Added
- Added support for configuring multiple voice clone file IDs
- Added description field for each voice in the voice selection dropdown
- Added dynamic voice dropdown generation based on server configuration

### Changed
- Updated voice dropdown display from "复刻 (name)" to "音色 (name)"
- Updated speech page UI: "选择文章" to "选择书本"
- Updated dropdown default options for better clarity
- Default voice mode changed to "system" instead of "clone"

### Fixed
- Fixed voice cache not being cleared when switching between different voice clones
- Fixed playback not resetting when changing voice mode
- Improved voice switching logic to properly clear audio cache and reset playback state

## [3.4] - 2026-01-31

### Added
- Added mobile responsive optimization for speech page (listening page)
- Added 768px, 480px, and 360px breakpoint styles for speech page
- Added speech selector styles for tablet and mobile devices
- Added speech card grid layout for mobile devices

### Fixed
- Fixed voice playback issue where switching chapters would play previous chapter content (voice clone mode)
- Fixed auto-play issue when switching chapters in speech page
- Improved stopSpeech() function to properly clear all playback states
- Improved playSpeechWithSystem() to prevent incorrect resume attempts after cancellation
- Enhanced voice clone mode state management to prevent recovering old content

### Added
- Added Chinese description of learning content (words and readings)

### Changed
- Updated project name to "英语学习小精灵 - 记住么"
- Improved feature descriptions to highlight sentence and reading modules
- Enhanced UI descriptions for better clarity

### Fixed
- Optimized bottom control bar display on reading page
- Fixed display issues in both iPad Chrome APP mode and regular Chrome

## [3.2] - 2026-01-25

### Added
- Added iPad Chrome APP mode support with dynamic viewport height (dvh/svh)
- Added safe area adaptation for iPad
- Added scroll optimization for iPad
- Added bottom control bar anti-occlusion for iPad

### Changed
- Optimized sentence practice answer display format

### Fixed
- Fixed Web Speech API error messages
- Improved Web Speech API error handling with try-catch and visibility change handlers

## [3.1] - 2026-01-25

### Added
- Added sentence practice feature with book/unit selection
- Added sentence dictation practice functionality
- Added wrong sentence review function
- Added ability to review sentences from wrong sentence notebook

### Changed
- Refined sentence practice UI and interaction experience

## [3.0] - 2026-01-24

### Added
- Added card layout for wrong words and wrong sentences
- Added pagination display for wrong items
- Added favorite button in flashcard test

### Changed
- Completely redesigned wrong book notebook UI
- Improved user interface interaction experience
- Renamed "错词本" to "错题本" (mistake notebook)

### Fixed
- Enhanced wrong sentence recording functionality

## [2.9] - 2026-01-24

### Added
- Added wrong sentence recording feature
- Added separation of wrong words and wrong sentences in mistake notebook

### Changed
- Renamed "错词本" to "错题本" (mistake notebook)

## [2.8] - 2026-01-20

### Added
- Added data security check functionality
- Added file type validation
- Added content security scanning
- Added dangerous pattern detection (script tags, iframes, event handlers)

## [2.7] - 2026-01-20

### Changed
- Improved mobile tool page adaptation
- Enhanced responsive design for tool page

## [2.6] - 2026-01-20

### Added
- Added tool page with Markdown/JSON conversion
- Added format checking functionality
- Added real-time data upload and activation

## [2.5] - 2026-01-20

### Added
- Added reading module
- Added reading list page
- Added reading detail page
- Added voice playback functionality
- Added knowledge point display
- Added key sentence patterns highlighting

## [2.4] - 2026-01-18

### Changed
- Improved mobile responsive design
- Enhanced flashcard mobile adaptation
- Improved word list mobile display
- Enhanced favorites page mobile display
- Improved mistake book mobile display

## [2.3] - 2026-01-18

### Added
- Added service health check functionality
- Added error overlay display when service unavailable

## [2.2] - 2026-01-18

### Added
- Added daily joke feature using Chuck Norris API

## [2.1] - 2026-01-18

### Added
- Added independent wordbook selection for flashcard test

## [2.0] - 2026-01-18

### Added
- Added Python Flask backend server
- Added AI assistant feature with MiniMax API
- Added rate limiting functionality (20 requests/hour)
- Added Gunicorn production deployment support

### Changed
- Migrated from static HTML to Flask backend architecture

## [1.0] - 2026-01-18

### Added
- Initial release
- Core flashcard test functionality
- Word list browsing
- Word search functionality
- Word pronunciation (GB/US)
- Favorites management
- User progress tracking
- Basic responsive design


