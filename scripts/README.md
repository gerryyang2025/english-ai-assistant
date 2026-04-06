# 数据脚本（`scripts/`）

在**仓库根目录**执行下列命令。默认 Markdown 源文件在 `data/`（与 `data/*.json` 同目录）。

也可通过根目录 **`optools.sh`** 封装调用（从任意当前目录执行均可，脚本会自动 `cd` 到仓库根）。环境检查：`./optools.sh check-env`；初始化依赖：`./optools.sh init` 或 `install`（见仓库 `README.md`）。

| 等价于 | `optools.sh` 命令 |
|--------|-------------------|
| `python3 scripts/check-words-format.py` | `./optools.sh check-words` |
| `python3 scripts/check-readings-format.py` | `./optools.sh check-readings` |
| `python3 scripts/check-listen-format.py` | `./optools.sh check-listen` |
| `node scripts/convert-words.js` | `./optools.sh convert-words` |
| `node scripts/convert-readings.js` | `./optools.sh convert-readings` |
| `node scripts/convert-listen.js` | `./optools.sh convert-listen` |

检查类命令可附加可选文件路径，例如：`./optools.sh check-words data/WORDS.md`

## 转换（Node.js）

| 命令 | 作用 |
|------|------|
| `node scripts/convert-words.js` | `data/WORDS.md` → `data/words.json` |
| `node scripts/convert-readings.js` | `data/READINGS.md` → `data/readings.json` |
| `node scripts/convert-listen.js` | `data/LISTEN.md` → `data/listen.json` |

## 格式检查（Python）

| 命令 | 作用 |
|------|------|
| `python3 scripts/check-words-format.py` | 校验 `data/WORDS.md` |
| `python3 scripts/check-readings-format.py` | 校验 `data/READINGS.md` |
| `python3 scripts/check-listen-format.py` | 校验 `data/LISTEN.md` |

也可传入绝对路径或相对根目录的路径作为参数，检查指定文件。

根目录仅保留 **`optools.sh`** 作为服务安装与启停入口；与本目录脚本职责分离。
