# Lottie 资源

## `mascot-cat.json`（默认 · 猫咪）

首页墨小灵**默认**使用的纯矢量猫咪（与 [LottieFiles 公开动画](https://app.lottiefiles.com/animation/5d60cb70-f665-48e5-a9b9-2ee6e18dce22) 同源 JSON）。键名 **`default`** 与 **`mascot-cat`** 均指向本文件。

## `mascot-bot2.json`（备选）

矢量机器人形象。通过键名 **`mascot-bot2`** 切换。格式说明见 [Lottie Animation Community](https://lottie.github.io/)。

## `mascot-bot.json`（备选 · 原 bot · `?mascot=blob`）

抱屏/笔记本风格矢量角色。通过键名 **`blob`** 或 URL `?mascot=blob` 使用。

## `mascot-character.json`（备选 · LottieFiles 角色）

来自 [LottieFiles](https://lottiefiles.com/) 公开资源包 `lf20_M9p23l.json`（CDN 抓取后入库）。通过键名 **`lottiefiles`** 切换使用。

## 切换方式（`js/app.js` 中 `MOXIAOLING_LOTTIE_BY_KEY`）

| 方式 | 说明 |
|------|------|
| **URL 参数** | `?mascot=` 指定键名时当次固定使用该形象。不写参数且未设置 localStorage → **默认猫咪**（`mascot-cat`）。 |
| **localStorage** | `moxiaolingLottieVariant` 设为有效键名后刷新 → 固定使用该形象；删除该项后恢复默认猫咪。`'default'` 等价于 `mascot-cat`。 |

新增更多 JSON 时：把文件放进本目录，在 `MOXIAOLING_LOTTIE_BY_KEY` 里增加键与路径即可。
