# Lottie 资源

首页「墨小灵」主形象由 [lottie-web](https://github.com/airbnb/lottie-web) 播放本目录下的 JSON。**纯矢量**（无外链位图时由各文件自身决定）；交互状态（思考/答毕等）通过播放速率等在 `js/app.js` 里同步，与具体 JSON 键名无关。

## 首页行为（无需手动参数）

不写 `?mascot=`、也未设置 `localStorage.moxiaolingLottieVariant` 时，**每次打开或刷新**会从下方「键名一览」里**所有已注册 JSON 路径去重后的集合**中**随机**选一个，无需在地址栏或控制台输入任何东西。

## 键名一览（速查）

在 `js/app.js` 的 `MOXIAOLING_LOTTIE_BY_KEY` 中注册；**URL** 与 **localStorage** 均使用**左列键名**（区分大小写与连字符）。

| 键名 | 文件 | 备注 |
|------|------|------|
| `default` | `mascot-cat.json` | 与 `mascot-cat` 同文件；localStorage 写 `default` 即固定猫咪 |
| `mascot-cat` | `mascot-cat.json` | 同上 |
| `blob` | `mascot-bot.json` | 抱屏/笔记本风格 bot |
| `lottiefiles` | `mascot-character.json` | LottieFiles 公开包角色 |
| `mascot-bot2` | `mascot-bot2.json` | 另一款矢量机器人 |
| `mascot-cat-dance` | `mascot-cat-dance.json` | 跳舞猫 |
| `mascot-dinosaur-dance` | `mascot-dinosaur-dance.json` | 跳舞恐龙 |
| `mascot-death-dance` | `mascot-death-dance.json` | 死亡之舞（角色 + PRINT 装饰层循环） |
| `mascot-alien-poke-emoji` | `mascot-alien-poke-emoji.json` | 外星人戳脸表情风 |
| `mascot-rabbit` | `mascot-rabbit.json` | 兔子 |
| `mascot-basketball` | `mascot-basketball.json` | 篮球角色 |

**示例**：本次访问固定死亡之舞 → 地址栏加 `?mascot=mascot-death-dance`；长期固定 → 控制台执行 `localStorage.setItem('moxiaolingLottieVariant', 'mascot-death-dance')` 后刷新。

## 如何新增一个形象

1. **放入 JSON**：将导出的 Lottie JSON 文件保存到本目录（如 `lottie/mascot-my.json`），建议用与现有文件一致的命名风格（`mascot-*.json`）。
2. **注册键名**：在 `js/app.js` 的 `MOXIAOLING_LOTTIE_BY_KEY` 对象中增加一行，例如  
   `'mascot-my': 'lottie/mascot-my.json'`  
   随机池 `MOXIAOLING_LOTTIE_RANDOM_PATHS` 由 `Object.values` 去重生成，**无需再改别处**即可参与随机。
3. **写文档（推荐）**：在本 README 的「键名一览」表加一行，并在下方「各文件说明」增加一小节（画布尺寸、`op`、`v`、图层特点等），方便以后维护。
4. **发版说明（可选）**：若对用户可见，在 `CHANGELOG.md` 的 `[Unreleased]` 或新版本下记一条 **Added**。

若 JSON 体积极大或含不兼容特性，需在真机用当前页的 lottie-web 版本试播；部分 AE 效果在 Lottie 中会被忽略或降级。

## 各文件说明

### `mascot-cat.json`（猫咪）

纯矢量猫咪（与 [LottieFiles 公开动画](https://app.lottiefiles.com/animation/5d60cb70-f665-48e5-a9b9-2ee6e18dce22) 同源 JSON）。键名 **`default`** 与 **`mascot-cat`** 均指向本文件。

### `mascot-cat-dance.json`（跳舞猫）

LottieFiles 工具导出的跳舞猫（`nm`：`Comp 1`，画布 512×512，`op` 90，`v` 5.4.4，含 `Dancing_cat_for animations` 等图层）。键名 **`mascot-cat-dance`**。

### `mascot-dinosaur-dance.json`（跳舞恐龙）

矢量恐龙短循环（`nm`：`Bryce - code`，画布 2000×2000，`op` 24，`v` 4.10.2；含 `Shade It!` 等伪效果层，部分播放器可能忽略）。键名 **`mascot-dinosaur-dance`**。

### `mascot-death-dance.json`（死亡之舞）

角色全身跳舞循环，画面中有 **PRINT** 等装饰矢量层与四肢、躯干图层（`nm`：`Comp 1`，画布 **1100×1100**，`fr` 30，`op` **181**，`v` 5.12.2）。键名 **`mascot-death-dance`**。与其它跳舞类资源一样，适合作为随机池里的趣味变体；固定选用见上表。

### `mascot-alien-poke-emoji.json`（外星人戳脸）

表情风格外星人（`nm`：`Alien poking`，画布 500×500，`op` 61，`v` 5.9.6，预合成 `comp_0` / `main`）。键名 **`mascot-alien-poke-emoji`**。

### `mascot-bot2.json`

矢量机器人形象。键名 **`mascot-bot2`**。格式说明见 [Lottie Animation Community](https://lottie.github.io/)。

### `mascot-bot.json`（原 bot · 键名 `blob`）

抱屏/笔记本风格矢量角色。键名 **`blob`**（历史原因未改成 `mascot-bot`）。

### `mascot-character.json`（LottieFiles 角色 · 键名 `lottiefiles`）

来自 [LottieFiles](https://lottiefiles.com/) 公开资源包 `lf20_M9p23l.json`（CDN 抓取后入库）。键名 **`lottiefiles`**。

### `mascot-rabbit.json`（兔子）

纯矢量兔子（合成 `comp_0` / `Rabit 1`，画布 600×600）。键名 **`mascot-rabbit`**。

### `mascot-basketball.json`（篮球角色）

持球角色与篮球动画（`nm`：`D3VRAKX_1`，画布 720×832，`op` 121，含 `ball` / `comp_0` 等预合成）。键名 **`mascot-basketball`**。

## 固定某一种形象

| 方式 | 说明 |
|------|------|
| **URL 参数** | `?mascot=键名` 仅**当次**固定，例如 `?mascot=mascot-death-dance`。去掉参数或换键名即变。 |
| **localStorage** | `localStorage.setItem('moxiaolingLottieVariant', '键名')` 后刷新 → **持久**固定；`localStorage.removeItem('moxiaolingLottieVariant')` 后刷新 → 恢复随机。键名 **`default`** 表示固定猫咪（`mascot-cat.json`）。 |

更多首页交互说明见仓库根目录 `README.md` 与 `CHANGELOG.md`。
