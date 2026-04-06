# English Learning — Moxiaoling

A full-featured learning platform for English learners: vocabulary, sentence practice, reading with audio, AI assistant, and more.

## Core features

| Module | Features |
|--------|----------|
| **Vocabulary** | Units, pagination, search, EN ↔ CN |
| **Flashcards** | Book/unit selection, three test modes, mastery tracking |
| **Sentence practice** | Dictation, smart tokenization, TTS |
| **Reading** | Passages, key points, TTS |
| **Audiobooks** | Chapters, voice selection, playback speed |
| **Mistakes** | Wrong words/sentences, review |
| **Moxiaoling / AI** | Home Lottie character + word usage, grammar Q&A |
| **Progress** | Daily stats, progress, streak |

## Project layout

```
english-ai-assistant/
├── optools.sh              # Entry: env check, deps, start/stop (only root helper script)
├── requirements.txt        # Python deps for server (used by optools.sh install)
├── index.html              # Main page
├── server.py               # Flask backend
├── api_config.py           # API config (gitignored)
├── api_config.example.py   # Config template
├── scripts/                # Convert & format checks (see scripts/README.md)
├── css/                    # Styles
├── js/app.js               # Frontend logic
├── images/                 # Static images (optional)
├── lottie/                 # Home Moxiaoling Lottie (random variant per refresh; optional ?mascot= / localStorage; see lottie/README.md)
├── data/                   # Data: generated JSON + Markdown sources
│   ├── words.json
│   ├── readings.json
│   ├── listen.json
│   ├── WORDS.md            # Vocabulary source (edit → convert)
│   ├── READINGS.md         # Reading source
│   └── LISTEN.md           # Audiobook source
```

## Quick start

```bash
# Optional: inspect Python/node/venv and data files (read-only)
./optools.sh check-env

# Create venv and install Python deps (idempotent; same as ./optools.sh init)
./optools.sh install

# Start the server
./optools.sh start

# On this machine: http://localhost:8082
# From another device on the same network, use this computer's LAN IP (shown after start/status), not localhost.
```

## Server commands

| Command | Description |
|---------|-------------|
| `./optools.sh check-env` | Check Python, Node, venv, imports, `requirements.txt`, data JSON (no changes) |
| `./optools.sh init` | Create `venv/` and install from `requirements.txt` (same as `install`) |
| `./optools.sh install` | Idempotent install; use `install --force` to reinstall packages |
| `./optools.sh start` | Start server (Gunicorn) |
| `./optools.sh stop` | Stop server |
| `./optools.sh restart` | Restart server |
| `./optools.sh status` | Server process + `api_config.py` presence |

## API configuration

`api_config.py` is **not** in the repository (it is listed in `.gitignore` so secrets are never committed). Copy the example once on your machine:

```bash
cp api_config.example.py api_config.py
# Edit api_config.py and set your MiniMax API key
./optools.sh restart
```

### Voice clone voices

```python
MINIMAX_VOICE_CLONE_VOICES = [
    {
        'file_id': 123456789012345,
        'description': 'gerry (default)'
    },
    {
        'file_id': 987654321098765,
        'description': 'Teacher Li'
    }
]
```

## Data updates

Converters and checks skip `<!-- ... -->` blocks in sources (e.g. format examples) and only parse body content.

### Web tools

In the nav bar, open **Tools** to upload Markdown or JSON and apply changes immediately. The audiobook tab generates **`listen.json`** with the same `{ "books": [ … ] }` structure as `data/listen.json` (matching `convert-listens.js`), so you can replace the file under `data/` after download.

### Command line

From the repo root (see `scripts/README.md`):

```bash
./optools.sh convert-words
./optools.sh convert-readings
./optools.sh convert-listens
./optools.sh check-words
./optools.sh check-readings
./optools.sh check-listens
# ./optools.sh check-words /path/to/WORDS.md   # default: data/WORDS.md
```

## Tech stack

- **Frontend**: HTML5 + CSS3 + JavaScript ([lottie-web](https://github.com/airbnb/lottie-web) on CDN for face blink / mouth overlay)
- **Backend**: Python Flask
- **AI**: MiniMax API
- **Storage**: Browser localStorage

## Design

Architecture, modules, and implementation notes: [DESIGN.md](./DESIGN.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).


## References

* https://github.com/gerryyang2025/ChinaTextbook
