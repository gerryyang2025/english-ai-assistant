# English Learning — Moxiaoling — Design Document

This document combines **product scope**, **architecture**, and **implementation patterns** for the SPA in this repo. For setup and CLI, see [README.md](./README.md). For releases, see [CHANGELOG.md](./CHANGELOG.md).

---

## 1. Overview

### 1.1 Goals

Deliver a browser-based English learning experience: vocabulary practice (dictation, flashcards), sentence work, reading, audiobooks, grammar study, AI assistance via a backend proxy, and progress stored in the client.

### 1.2 Design principles

- **Clarity**: Simple navigation; one `index.html` shell with client-side page switching.
- **Structured content**: Materials organized by textbook books and units where applicable.
- **Multi-modal learning**: Visual (flashcards, UI), listening (Web Speech API, optional MiniMax voice clone), interaction (dictation, quizzes).
- **Local-first progress**: User progress persists in `localStorage`; static JSON under `data/` ships with the app.

---

## 2. Feature catalog (as implemented)

1. **Word dictation (`单词` / `page-words`)** — Book and unit selection; spell English from Chinese prompts; progress, feedback, skip; wrong words can join the mistake notebook.

2. **Flashcards (`闪卡`)** — Separate book selector; multi-unit selection; EN→CN / CN→EN / mixed; flip card; UK/US (Web Speech API); **Got it / Not yet / Review later**; summary; wrong words to mistake notebook.

3. **Sentence practice (`语句`)** — Book/unit, tokenized dictation, TTS, results, wrong-sentence notebook; review reuses the same flow.

4. **Grammar (`语法`)** — Hub from `GRAMMAR_TYPES` in `js/app.js`. **Tenses** loads `content/grammar-tenses-magic.html` (lessons + quiz + stats). Other types are placeholders until content exists.

5. **Reading (`阅读`)** — Paginated list, detail with dialogue and knowledge (Markdown), sentence playback (Web Speech API), reading progress in `localStorage`.

6. **Audiobooks (`听书`)** — `data/LISTEN.md` → `data/listen.json`; book/chapter selection; **system** vs **MiniMax voice clone** (`/api/status`, `/api/voice-clone`); speed control; responsive layout.

7. **Home** — **Word of the Day** from `words.json` using **UTC+8 (Beijing)** calendar date; phonetics, gloss, example, optional tip; UK/US; **Ask Moxiaoling** prefills Q&A. **Moxiaoling** panel: **Lottie-only** mascot (`lottie-web`), idle/thinking/happy; optional variant via `?mascot=` / `localStorage` (`lottie/README.md`). **AI Q&A**: `POST /api/chat` with `enable_web_search` (on by default); Markdown (`marked.js`). **Today stats** (local).

8. **Mistakes (`错题本`)** — Wrong words and sentences, pagination, links into review.

9. **Favorites (`收藏`)** — Words starred from flashcards.

10. **Progress (`学习进度`)** — Aggregates from the persisted progress model.

11. **Tools (`工具`)** — Convert `data/WORDS.md` / `data/READINGS.md` / `data/LISTEN.md` to JSON; upload JSON for in-memory reload; previews; server-side validation where uploads hit the API.

12. **Health check** — On `http:` / `https:`, `GET /api/health` with **3s** timeout; failure shows a blocking overlay. **`file://`** skips the check (no same-origin `/api`).

13. **Backend** (`server.py`) — `POST /api/chat`, `GET /api/health`, `GET /api/status`, `POST /api/voice-clone`; static `index.html` and assets.

14. **Data pipeline** — Converters/checkers skip `<!-- ... -->` in Markdown. Use `./optools.sh` → `scripts/` (`convert-*`, `check-*`). See `scripts/README.md`.

15. **Upload safety** — Extension/size/content checks in `server.py` for tool uploads.

### 2.1 At-a-glance matrix

| Area | Role |
|------|------|
| Words page | Word **dictation** (not a separate full word-browse grid with search) |
| Flashcards / favorites | Primary vocabulary study and starred lists |
| Sentences | Dictation + wrong-sentence flows |
| Grammar | Hub + injected HTML per type |
| Reading / speech | List → detail / player |
| AI | Home Q&A only; key stays server-side |

---

## 3. Architecture

### 3.1 Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | HTML5, CSS3, vanilla JS; [lottie-web](https://github.com/airbnb/lottie-web) (CDN) for mascot |
| Backend | Python 3, Flask |
| AI | MiniMax (`api_config.py`, not exposed to the browser) |
| Storage | `data/*.json` + `localStorage` |
| Production | Gunicorn via `./optools.sh start` (see README) |

### 3.2 Shape

- **Frontend**: Mostly static files; `js/app.js` holds state, routing, and module logic.
- **Backend**: Thin API layer (chat, status, health, voice clone); no heavy domain DB.
- **Privacy**: Learning history stays on the client unless you add sync later.

### 3.3 Target browsers

Primary: **Chrome** (desktop and mobile). **iPad** Chrome / WebKit: safe areas, `dvh`/`svh`, touch targets, scroll behavior.

---

## 4. Voice (audiobooks)

```
Client
├── AppState.speechCloneVoices       ← GET /api/status
├── AppState.speechCloneSelectedVoice / speechVoiceMode ('system' | 'clone')
├── AppState.speechCloneAudioCache   ← Map (content hash → audio URL), cleared when clone voice changes
└── Playback: Web Speech API vs fetched clone audio URL

Server
├── GET /api/status  → voice_clone.voices, configured flag, rate_limit, api_configured
└── POST /api/voice-clone  → { text, file_id? } → { audio_url }
```

---

## 5. Frontend patterns

### 5.1 `AppState` (core fields)

The global object in `js/app.js` holds loaded corpora, UI sessions, and speech-related fields. Illustrative subset:

```javascript
const AppState = {
    wordData: [], readings: [], speechData: [],
    currentReading: null, currentSpeech: null, currentSpeechChapter: null,
    flashcardWordBook: null, flashcardSelectedUnits: [],
    userProgress: null,              // persisted learning progress
    sentencesSession: null,
    speechPlaybackSpeed: 1.0,
    speechVoiceMode: 'system',
    speechCloneVoices: [],
    speechCloneSelectedVoice: null,
    speechCloneAudioCache: new Map(),
    currentGrammarTypeId: null,
    // …see app.js for full list
};
```

### 5.2 SPA navigation

- Sections are `.page` nodes; the active view gets class `active`.
- `switchPage(pageName)` toggles visibility and runs module init (e.g. `renderHomePage`, `showSpeechPage`).

### 5.3 Speech UI

- Voice dropdown: keep a **system** option; append clone voices from `/api/status` with labels from `description`.
- When switching clone **file_id**, clear `speechCloneAudioCache` so stale audio is not replayed.

---

## 6. Data flow & contracts

### 6.1 High-level flow

```
Load /api/health (if http(s)) → load words / readings / listen JSON → render home
→ user navigates → read/write localStorage
→ AI: POST /api/chat (rate limit) → Markdown answer
→ Clone TTS: GET /api/status → POST /api/voice-clone as needed
```

### 6.2 Information architecture

```
Home
├── Words → dictation → result
├── Sentences → practice → result
├── Grammar → hub → detail
├── Readings → list → detail
├── Speech → list → detail / player
├── Flashcards → setup → test → result
├── Wrong book | Favorites | Progress | Tools
```

### 6.3 Word JSON shape

Multi-book: `id`, `name`, `units[]`; words have stable `id`, `word`, `meaning`, optional `phonetic`, `example`, `translation`, `memoryTip`, `category`. Authoring source: `data/WORDS.md` + converters.

### 6.4 AI chat

- **POST /api/chat** body: `{ "question": string, "enable_web_search"?: boolean }`.
- Response: `{ "answer": string }` (Markdown) or `{ "error": string }`.
- **Rate limit**: `RATE_LIMIT` in `api_config.py` (hourly + cooldown; optional daily/minute when enabled).

---

## 7. Operations

**`./optools.sh`**: `check-env` (read-only diagnostics), `init` / `install` (`requirements.txt`, skip if imports already OK unless `--force`), `start`, `stop`, `restart`, `status`, and passthrough for `scripts/` convert/check commands. Default bind documented in README (e.g. port `8082`).

---

## 8. UI & responsive design

### 8.1 Visual

- Primary blues and neutrals; green/red for correct/incorrect; flashcard back often uses a purple gradient; Moxiaoling uses greens/teals aligned with the hero.
- Card flip and progress animations; touch-friendly controls on flashcards.

### 8.2 Breakpoints (typical)

| Range | Notes |
|-------|--------|
| Default | Desktop, content often max-width constrained |
| ~768px–1024px | Tablet / iPad-oriented tweaks |
| ≤768px / ≤480px / ≤360px | Progressive tightening for phones |

### 8.3 iPad-oriented details

- `viewport-fit=cover`, safe-area insets, `100dvh` / `100svh` where needed.
- Bottom bars and players avoid overlap with home indicator.

---

## 9. Implementation guidelines

- **Passing data in HTML**: Prefer indices or ids; avoid huge inline strings; use `AppState` and loaded corpora for lookups.
- **Keyboard**: In practice modes, prevent default on Space where it would scroll the page; arrow keys handled per module when needed.
- **Wrong-item review**: Keep stable word/sentence **ids** from source data for deduplication and notebook consistency.

---

## 10. Repository layout

```
english-ai-assistant/
├── optools.sh
├── requirements.txt
├── index.html
├── server.py
├── api_config.py / api_config.example.py
├── js/app.js
├── css/                 # main, readings, speech, grammar, grammar-tenses-fun
├── content/             # grammar fragments (e.g. grammar-tenses-magic.html)
├── lottie/
├── tools/update-tool.html   # optional legacy; main tools UI lives in index.html
├── scripts/
├── data/
│   ├── words.json, readings.json, listen.json
│   └── WORDS.md, READINGS.md, LISTEN.md   # Markdown sources
├── README.md, CHANGELOG.md, DESIGN.md
└── venv/                # local, gitignored
```

---

## Appendix A — References

- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Flask](https://flask.palletsprojects.com/)
- [Gunicorn](https://docs.gunicorn.org/)
- [MiniMax platform](https://platform.minimaxi.com/)

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| Flashcard | Question on one side, answer on the other; user marks recall |
| TTS | Text-to-speech |
| Voice clone | MiniMax cloned voice via `/api/voice-clone` |
| WSGI | Python web server interface; Gunicorn is a WSGI server |
| CORS | API responses set permissive headers where needed |
| AbortController | Cancels `fetch` after the health-check timeout |
