# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/gerryyang/english-ai-assistant/compare/v3.5...HEAD
[3.5]: https://github.com/gerryyang/english-ai-assistant/compare/v3.4...v3.5
[3.4]: https://github.com/gerryyang/english-ai-assistant/compare/v3.3...v3.4
[3.3]: https://github.com/gerryyang/english-ai-assistant/compare/v3.2...v3.3
[3.2]: https://github.com/gerryyang/english-ai-assistant/compare/v3.1...v3.2
[3.1]: https://github.com/gerryyang/english-ai-assistant/compare/v3.0...v3.1
[3.0]: https://github.com/gerryyang/english-ai-assistant/compare/v2.9...v3.0
[2.9]: https://github.com/gerryyang/english-ai-assistant/compare/v2.8...v2.9
[2.8]: https://github.com/gerryyang/english-ai-assistant/compare/v2.7...v2.8
[2.7]: https://github.com/gerryyang/english-ai-assistant/compare/v2.6...v2.7
[2.6]: https://github.com/gerryyang/english-ai-assistant/compare/v2.5...v2.6
[2.5]: https://github.com/gerryyang/english-ai-assistant/compare/v2.4...v2.5
[2.4]: https://github.com/gerryyang/english-ai-assistant/compare/v2.3...v2.4
[2.3]: https://github.com/gerryyang/english-ai-assistant/compare/v2.2...v2.3
[2.2]: https://github.com/gerryyang/english-ai-assistant/compare/v2.1...v2.2
[2.1]: https://github.com/gerryyang/english-ai-assistant/compare/v2.0...v2.1
[2.0]: https://github.com/gerryyang/english-ai-assistant/compare/v1.0...v2.0
[1.0]: https://github.com/gerryyang/english-ai-assistant/releases/tag/v1.0
