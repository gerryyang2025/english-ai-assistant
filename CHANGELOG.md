# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Renamed **`scripts/convert-listen.js`** → **`scripts/convert-listens.js`** to match `./optools.sh convert-listens`; `optools.sh`, **`README.md`**, **`DESIGN.md`**, **`scripts/README.md`**, and historical changelog lines that cited the old filename are updated.
- **`check-listen`** → **`check-listens`** in `./optools.sh`; renamed **`scripts/check-listen-format.py`** → **`scripts/check-listens-format.py`**; **`README.md`** and **`scripts/README.md`** updated.
- Grammar **时态魔法学院** quiz (`initGrammarTensesQuiz`): expanded from **24** to **50** items (about **17 / 17 / 16** per tense group); **`content/grammar-tenses-magic.html`** quiz line now says 共50题.
- Grammar quiz: **`GRAMMAR_TENSES_QUIZ_POINTS_PER_QUESTION`** centralizes per-question score (10); **`#gtq-result`** has **`role="status"`** and **`aria-live="polite"`** for assistive tech when results update.

## [3.10] - 2026-04-06

Grammar **时态魔法学院** (lessons + 24-question quiz + stats); **`optools.sh`** startup hints for LAN/public access.

### Added
- Grammar **时态魔法学院** quiz (`content/grammar-tenses-magic.html` + `initGrammarTensesQuiz`): each question has **`textZh`** (Chinese paraphrase of the stem) shown below the English line; each question includes an **`explain`** field; after submit, per-question feedback shows **解析** (why the correct answer fits, and why distractors do not). **No on-screen tense label** before submit (avoids leaking the expected tense).

### Changed
- **`optools.sh`**: after `start` / `status`, prints listen address (`0.0.0.0`), localhost URLs, best-effort LAN IPv4 for other devices, and a short note on public-internet access (WAN/DDNS + port forward); avoids implying that `localhost` works from another machine.
- Grammar **时态魔法学院** quiz (`initGrammarTensesQuiz`): per-question **`explain`** copy reworded to avoid naming tenses in Chinese (e.g. no 「一般现在时」「现在进行时」); uses structure/context wording instead. Summary tables and **`point`** labels after submit are unchanged.
- Grammar **时态魔法学院** quiz: items are ordered by **round-robin across the three tense groups** (each group shuffled first), so the same tense is not listed in one block; `content/grammar-tenses-magic.html` quiz blurb notes the mixed order.

## [3.9] - 2026-04-06

Markdown sources moved to **`data/`**; **`requirements.txt`** and **`optools.sh`** environment checks (`check-env`, `init` / idempotent `install`); audiobook tool exports **`listen.json`** in **`books`** format; docs and comments aligned (`scripts/README.md` in English, `api_config` / server / convert paths).

### Added
- Root **`requirements.txt`** (Flask, Gunicorn, requests) for reproducible installs.
- **`./optools.sh check-env`**: read-only report for Python, Node, `venv`, package imports, `requirements.txt`, `api_config.py`, and `data/*.json`.
- **`./optools.sh init`**: alias for **`./optools.sh install`** (create virtualenv if needed, then `pip install -r requirements.txt`). **`install`** skips pip when imports already succeed unless **`--force`**.
- **`buildListenJsonExport()`** in `js/app.js` (and the same logic in `tools/update-tool.html`): in-app audiobook tool exports **`listen.json`** in the **`{ "books": [...] }`** shape used by `data/listen.json` / `convert-listens.js` (replaces legacy `{ "speeches": [...] }` + `speech.json`).
- **`scripts/README.md`** in English to align with the root **`README.md`**.

### Changed
- Markdown authoring sources **`WORDS.md`**, **`READINGS.md`**, and **`LISTEN.md`** now live under **`data/`** next to the generated JSON files. Conversion and format-check scripts default to `data/WORDS.md`, `data/READINGS.md`, and `data/LISTEN.md`.
- Comments aligned with current workflow: `api_config.example.py` header distinguishes tracked template vs gitignored `api_config.py`; `server.py` docstring references `./optools.sh install` / `requirements.txt`; home AI error copy references `./optools.sh start`; convert scripts’ top-line comments reference `data/` paths.
- **`README.md`** / **`DESIGN.md`**: Web tools section notes that audiobook export matches **`data/listen.json`**.

## [3.8] - 2026-04-06

Project layout and server startup: data tooling under `scripts/`; single **Gunicorn** entry via `optools.sh`.

### Changed
- Moved conversion and Markdown format-check scripts into `scripts/`; repo root keeps `optools.sh` as the service entry. Examples: `node scripts/convert-words.js`, `python3 scripts/check-words-format.py` (see `scripts/README.md`).
- `optools.sh start` / `restart` now only start with **Gunicorn**; removed the Flask built-in dev vs production split and dropped `start prod`.

## [3.7] - 2026-03-21

Branding and home experience: Moxiaoling Lottie-only mascot, Word of the Day with UTC+8 date, removed external joke API.

### Added
- Home **Moxiaoling** panel: **vector-only Lottie** character (default `lottie/mascot-bot.json`, [lottie-web](https://github.com/airbnb/lottie-web)), integrated with AI word Q&A (`/api/chat`); no bitmap overlay; `thinking` / `happy` via playback speed; static placeholder under `prefers-reduced-motion`.
- Alternate LottieFiles asset `lottie/mascot-character.json`; switch via `?mascot=lottiefiles` or `localStorage.moxiaolingLottieVariant` (see `lottie/README.md`).
- Mascot interaction: glow, thinking dots, success sparkles, speech bubble, tap/keyboard encouragement, parallax tilt, Web Audio tap cue.
- Q&A area: Enter to submit, `aria-live` on results; web search shown inline and on by default (no longer tucked in a parent-only collapsible).

### Changed
- Site title from *English Study - Moxiaoling* to **Love English Study - Moxiaoling** (document title, header, footer, README, DESIGN).
- Home Q&A copy tuned for children (“Ask Xiaoling”, hints); Moxiaoling panel colors aligned with site theme.
- Home Q&A heading: **Moxiaoling studies English with you**; web search layout flattened and on by default.
- Home Hero: **Word of the Day** replaces external jokes—deterministic pick from `words.json` by **UTC+8 (Beijing) calendar**; shows date and weekday; phonetics, gloss, example/translation, memory tip; `**bold**` in bank rendered as Markdown; UK/US speak for word and example (`speakExample` strips `**`); “Ask Moxiaoling” prefills and scrolls to Q&A; **removed** Chuck Norris API.

## [3.6] - 2026-03-21

First public release of the system.

### Changed
- Site title from *English Study Elf - Remember?* to **English Study - Moxiaoling** (page title, header, footer, docs).
- Added shebang (`#!/usr/bin/env node`) to `convert-words.js`, `convert-readings.js`, `convert-listens.js` for direct execution.
- Marked `check-words-format.py`, `check-readings-format.py`, `check-listen-format.py` executable for `./…` usage.
- README: CLI section covers listen conversion and listen format checks; split “data conversion” vs “format check” and both invocation styles.

### Fixed
- `check-words-format.py` skips `<!-- ... -->` blocks so sample formats are not parsed as content (fixes false reports like “Unit 2 has no words”).
- `convert-words.js` skips HTML comment blocks; no longer writes WORDS.md header samples into `words.json`.
- `convert-readings.js` skips comment blocks and drops empty reading entries (no patterns / knowledge / dialogue), so READINGS.md samples do not pollute `readings.json`.

## [3.5] - 2026-02-01

### Added
- Support for multiple voice-clone file IDs in configuration.
- Description field per voice in the voice dropdown.
- Dynamic voice dropdown from server configuration.

### Changed
- Voice dropdown label from *clone (name)* to **timbre (name)**.
- Speech page: label *Select article* → **Select book**.
- Clearer default placeholder options in dropdowns.
- Default voice mode is **system**, not clone.

### Fixed
- Voice cache cleared when switching clone voices.
- Playback resets when changing voice mode.
- Voice switching clears audio cache and playback state reliably.

## [3.4] - 2026-01-31

### Added
- Mobile layout improvements for the speech (listen) page.
- Breakpoints at 768px, 480px, and 360px for speech styles.
- Speech selector styles for tablet and phone.
- Speech card grid for small screens.

### Fixed
- Voice clone: switching chapters no longer plays the previous chapter’s audio.
- Auto-play when changing chapters on the speech page.
- `stopSpeech()` clears all playback-related state.
- `playSpeechWithSystem()` avoids bad resume after cancel.
- Clone mode state does not resurrect stale content.

### Added
- Chinese descriptions for learning content (words and readings).

### Changed
- Project display name set to **English Study Elf - Remember?**
- Feature blurbs emphasize sentence and reading modules.
- Clearer UI copy.

### Fixed
- Reading page bottom control bar on small screens.
- Layout in iPad Chrome app mode and desktop Chrome.

## [3.2] - 2026-01-25

### Added
- iPad Chrome app mode: dynamic viewport height (`dvh` / `svh`).
- Safe-area handling on iPad.
- Scroll behavior tweaks for iPad.
- Bottom bar kept clear of home indicator overlap.

### Changed
- Sentence practice answer display formatting.

### Fixed
- Web Speech API error reporting.
- Safer Web Speech handling with try/catch and `visibilitychange`.

## [3.1] - 2026-01-25

### Added
- Sentence practice with book/unit selection.
- Sentence dictation flow.
- Wrong-sentence review.
- Review from wrong-sentence notebook.

### Changed
- Sentence practice UI and interaction polish.

## [3.0] - 2026-01-24

### Added
- Card layout for wrong words and wrong sentences.
- Pagination for wrong-item lists.
- Favorite control on flashcard back.

### Changed
- Wrong-book notebook UI redesigned.
- General interaction improvements.
- Renamed wrong-word notebook → **mistake notebook** (wrong words + wrong sentences).

### Fixed
- Wrong-sentence recording reliability.

## [2.9] - 2026-01-24

### Added
- Record wrong sentences separately from wrong words.
- Split wrong words vs wrong sentences in the notebook.

### Changed
- Renamed wrong-word notebook → **mistake notebook**.

## [2.8] - 2026-01-20

### Added
- Data upload safety checks.
- File type validation.
- Content safety scan.
- Dangerous-pattern detection (script tags, iframes, inline event handlers).

## [2.7] - 2026-01-20

### Changed
- Tool page mobile layout.
- Responsive tool page styles.

## [2.6] - 2026-01-20

### Added
- Tools page: Markdown ↔ JSON conversion.
- Format checking in the tool flow.
- Upload JSON for immediate in-app use.

## [2.5] - 2026-01-20

### Added
- Reading module: list and detail.
- Playback for lines.
- Knowledge points and key sentence patterns.

## [2.4] - 2026-01-18

### Changed
- Broader mobile responsive pass.
- Flashcard, word list, favorites, wrong-book layouts on phones.

## [2.3] - 2026-01-18

### Added
- Service health check (`/api/health`).
- Full-screen error overlay when the backend is unreachable.

## [2.2] - 2026-01-18

### Added
- Daily joke via Chuck Norris API (later removed in 3.7).

## [2.1] - 2026-01-18

### Added
- Independent wordbook picker for flashcard sessions.

## [2.0] - 2026-01-18

### Added
- Python Flask backend.
- AI assistant via MiniMax proxy.
- Rate limiting (20 requests/hour default).
- Gunicorn deployment notes.

### Changed
- Architecture: static HTML → Flask-served app.

## [1.0] - 2026-01-18

### Added
- Initial release: flashcards, word list, search, GB/US pronunciation, favorites, progress, basic responsive layout.

