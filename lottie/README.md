# Lottie 资源

## `mascot-bot.json`（默认 · bot 形象）

首页墨小灵**默认**使用的抱屏/笔记本风格矢量角色（项目提供的 Lottie JSON）。格式说明见 [Lottie Animation Community](https://lottie.github.io/)。

## `mascot-character.json`（备选 · LottieFiles 角色）

来自 [LottieFiles](https://lottiefiles.com/) 公开资源包 `lf20_M9p23l.json`（CDN 抓取后入库）。通过键名 **`lottiefiles`** 切换使用。

## 切换方式（`js/app.js` 中 `MOXIAOLING_LOTTIE_BY_KEY`）

| 方式 | 说明 |
|------|------|
| **URL 参数** | 不写参数即为默认（bot）。`?mascot=lottiefiles` 当次使用 LottieFiles 角色；`?mascot=blob` 与默认相同（兼容旧书签）。 |
| **localStorage** | `localStorage.setItem('moxiaolingLottieVariant', 'lottiefiles')` 后刷新 → 使用备选；删除该项或设为 `'default'` / `'blob'` → bot。 |

新增更多 JSON 时：把文件放进本目录，在 `MOXIAOLING_LOTTIE_BY_KEY` 里增加键与路径即可。
