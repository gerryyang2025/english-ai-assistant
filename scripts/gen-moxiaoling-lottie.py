#!/usr/bin/env python3
"""生成墨小灵面部 Lottie JSON（眨眼 + 口型），供 lottie-web 播放。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_IDLE = ROOT / "lottie" / "moxiaoling-idle.json"
OUT_TALK = ROOT / "lottie" / "moxiaoling-talk.json"

W = H = 200
FR = 30


def kf_scale_blink():
    """周期性眨眼：约每 3s 一次。"""
    return {
        "a": 1,
        "ix": 6,
        "k": [
            {"t": 0, "s": [100, 100, 100], "i": {"x": [0.4], "y": [1]}, "o": {"x": [0.6], "y": [0]}},
            {"t": 84, "s": [100, 100, 100], "i": {"x": [0.4], "y": [1]}, "o": {"x": [0.6], "y": [0]}},
            {"t": 88, "s": [100, 14, 100], "i": {"x": [0.4], "y": [1]}, "o": {"x": [0.6], "y": [0]}},
            {"t": 92, "s": [100, 100, 100], "i": {"x": [0.4], "y": [1]}, "o": {"x": [0.6], "y": [0]}},
            {"t": 120, "s": [100, 100, 100]},
        ],
    }


def kf_mouth_talk(op: int):
    """说话口型：竖向缩放循环。"""
    k = []
    step = 10
    t = 0
    toggle = True
    while t < op:
        sy = 55 if toggle else 100
        toggle = not toggle
        k.append(
            {
                "t": t,
                "s": [100, sy, 100],
                "i": {"x": [0.45], "y": [1]},
                "o": {"x": [0.55], "y": [0]},
            }
        )
        t += step
    k.append({"t": op, "s": [100, 100, 100]})
    return {"a": 1, "ix": 6, "k": k}


def ellipse_group(w, h, rgb):
    return [
        {
            "ty": "gr",
            "it": [
                {
                    "ty": "el",
                    "p": {"a": 0, "k": [0, 0]},
                    "s": {"a": 0, "k": [w, h]},
                    "nm": "Ellipse",
                },
                {
                    "ty": "fl",
                    "c": {"a": 0, "k": [rgb[0], rgb[1], rgb[2], 1]},
                    "o": {"a": 0, "k": 100},
                    "nm": "Fill",
                },
                {
                    "ty": "tr",
                    "p": {"a": 0, "k": [0, 0]},
                    "a": {"a": 0, "k": [0, 0]},
                    "s": {"a": 0, "k": [100, 100]},
                    "r": {"a": 0, "k": 0},
                    "o": {"a": 0, "k": 100},
                    "nm": "Transform",
                },
            ],
            "nm": "Group",
            "np": 3,
            "cix": 2,
            "bm": 0,
            "ix": 1,
            "mn": "ADBE Vector Group",
            "hd": False,
        }
    ]


def shape_layer(ind, nm, pos, scale_ks, shapes, op):
    return {
        "ddd": 0,
        "ind": ind,
        "ty": 4,
        "nm": nm,
        "sr": 1,
        "ks": {
            "o": {"a": 0, "k": 100, "ix": 11},
            "r": {"a": 0, "k": 0, "ix": 10},
            "p": {"a": 0, "k": [pos[0], pos[1], 0], "ix": 2},
            "a": {"a": 0, "k": [0, 0, 0], "ix": 1},
            "s": scale_ks,
        },
        "ao": 0,
        "shapes": shapes,
        "ip": 0,
        "op": op,
        "st": 0,
        "bm": 0,
    }


def build_comp(op, mouth_scale_ks, blink: bool):
    eye_rgb = [0.16, 0.24, 0.4]
    mouth_rgb = [0.28, 0.36, 0.52]
    blink_ks = kf_scale_blink() if blink else {"a": 0, "k": [100, 100, 100], "ix": 6}
    layers = [
        shape_layer(1, "mouth", [100, 138], mouth_scale_ks, ellipse_group(42, 14, mouth_rgb), op),
        shape_layer(2, "eye R", [132, 94], blink_ks, ellipse_group(13, 16, eye_rgb), op),
        shape_layer(3, "eye L", [68, 94], blink_ks, ellipse_group(13, 16, eye_rgb), op),
    ]
    return {
        "v": "5.7.0",
        "fr": FR,
        "ip": 0,
        "op": op,
        "w": W,
        "h": H,
        "nm": "moxiaoling-face",
        "ddd": 0,
        "assets": [],
        "layers": layers,
        "markers": [],
    }


def main():
    OUT_IDLE.parent.mkdir(parents=True, exist_ok=True)
    op_idle = 120
    op_talk = 60
    idle = build_comp(op_idle, {"a": 0, "k": [100, 100, 100], "ix": 6}, blink=True)
    talk = build_comp(op_talk, kf_mouth_talk(op_talk), blink=False)
    OUT_IDLE.write_text(json.dumps(idle, separators=(",", ":")), encoding="utf-8")
    OUT_TALK.write_text(json.dumps(talk, separators=(",", ":")), encoding="utf-8")
    print("Wrote", OUT_IDLE, OUT_TALK)


if __name__ == "__main__":
    main()
