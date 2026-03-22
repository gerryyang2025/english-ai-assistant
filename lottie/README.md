# Lottie 资源

## 首页行为（无需手动参数）

不写 `?mascot=`、也未设置 `localStorage.moxiaolingLottieVariant` 时，**每次打开或刷新**会从下方已注册的 JSON 中**随机**选一个形象，无需在地址栏或控制台输入任何东西。

## `mascot-cat.json`（猫咪）

纯矢量猫咪（与 [LottieFiles 公开动画](https://app.lottiefiles.com/animation/5d60cb70-f665-48e5-a9b9-2ee6e18dce22) 同源 JSON）。键名 **`default`** 与 **`mascot-cat`** 均指向本文件（用于 URL / localStorage **固定**为猫时使用）。

## `mascot-bot2.json`

矢量机器人形象。键名 **`mascot-bot2`**。格式说明见 [Lottie Animation Community](https://lottie.github.io/)。

## `mascot-bot.json`（原 bot · `?mascot=blob`）

抱屏/笔记本风格矢量角色。键名 **`blob`**。

## `mascot-character.json`（LottieFiles 角色）

来自 [LottieFiles](https://lottiefiles.com/) 公开资源包 `lf20_M9p23l.json`（CDN 抓取后入库）。键名 **`lottiefiles`**。

## `mascot-rabbit.json`（兔子）

纯矢量兔子（合成 `comp_0` / `Rabit 1`，画布 600×600）。键名 **`mascot-rabbit`**。

## 可选：固定某一种（`js/app.js` 中 `MOXIAOLING_LOTTIE_BY_KEY`）

| 方式 | 说明 |
|------|------|
| **URL 参数** | `?mascot=键名` 当次固定，例如 `?mascot=mascot-cat`。一般不用即可保持随机。 |
| **localStorage** | `localStorage.setItem('moxiaolingLottieVariant', '键名')` 后刷新 → 始终该形象；`removeItem` 后恢复随机。`'default'` → 固定猫咪。 |

新增更多 JSON 时：把文件放进本目录，在 `MOXIAOLING_LOTTIE_BY_KEY` 里增加键与路径即可（随机池会自动包含新路径）。
