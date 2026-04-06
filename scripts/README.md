# Scripts (`scripts/`)

Run these from the **repository root**. Default Markdown inputs live under **`data/`** (next to `data/*.json`).

You can also invoke the same commands via **`./optools.sh`** from any working directory (the script `cd`s to the repo root). Environment setup: `./optools.sh check-env`; install deps: `./optools.sh init` or `install` (see root **`README.md`**).

| Direct command | `optools.sh` shortcut |
|----------------|----------------------|
| `python3 scripts/check-words-format.py` | `./optools.sh check-words` |
| `python3 scripts/check-readings-format.py` | `./optools.sh check-readings` |
| `python3 scripts/check-listen-format.py` | `./optools.sh check-listen` |
| `node scripts/convert-words.js` | `./optools.sh convert-words` |
| `node scripts/convert-readings.js` | `./optools.sh convert-readings` |
| `node scripts/convert-listen.js` | `./optools.sh convert-listens` |

Optional path argument for check commands, e.g. `./optools.sh check-words data/WORDS.md`.

## Conversion (Node.js)

| Command | Input → output |
|---------|------------------|
| `node scripts/convert-words.js` | `data/WORDS.md` → `data/words.json` |
| `node scripts/convert-readings.js` | `data/READINGS.md` → `data/readings.json` |
| `node scripts/convert-listen.js` | `data/LISTEN.md` → `data/listen.json` |

## Format checks (Python)

| Command | Checks |
|---------|--------|
| `python3 scripts/check-words-format.py` | `data/WORDS.md` |
| `python3 scripts/check-readings-format.py` | `data/READINGS.md` |
| `python3 scripts/check-listen-format.py` | `data/LISTEN.md` |

You may pass an absolute path or a path relative to the repo root.

The repo root only exposes **`optools.sh`** for service install/start/stop; this directory holds data tooling only.
