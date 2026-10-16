#!/usr/bin/env python3
"""Generate Android launcher icons + splash images from ../web/icon-512.png.

Usage (from android-app/):  python3 tools/make-icons.py [path/to/icon.png]
Re-run whenever the game icon changes. Needs Pillow (pip install pillow).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(APP, "..", "web", "icon-512.png")
RES = os.path.join(APP, "android", "app", "src", "main", "res")
BG = (0x1C, 0x3A, 0x2E, 255)  # #1c3a2e, the game background

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
SS = 4  # supersampling factor for smooth mask edges


def mask(size, kind):
    big = size * SS
    m = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(m)
    if kind == "circle":
        d.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:  # rounded square, like Android's legacy icon grid
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.18), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def legacy(src, px, kind):
    # Legacy (pre-Android 8) icons: 48dp canvas, artwork inset ~4% so it is not clipped.
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    inner = round(px * 0.92)
    art = src.resize((inner, inner), Image.LANCZOS)
    art.putalpha(mask(inner, kind))
    off = (px - inner) // 2
    canvas.alpha_composite(art, (off, off))
    return canvas


def main():
    src = Image.open(SRC).convert("RGBA")
    for name, scale in DENSITIES.items():
        d = os.path.join(RES, "mipmap-" + name)
        os.makedirs(d, exist_ok=True)
        px = round(48 * scale)
        legacy(src, px, "square").save(os.path.join(d, "ic_launcher.png"))
        legacy(src, px, "circle").save(os.path.join(d, "ic_launcher_round.png"))
        # Adaptive foreground: 108dp layer, launcher shows the centre 72dp (safe circle 66dp).
        # The art is shrunk to 80dp with a feathered edge so the corner pins stay visible;
        # values/ic_launcher_background.xml matches the icon's dark green edge.
        fg_px = round(108 * scale)
        art_px = round(80 * scale)
        art = src.resize((art_px, art_px), Image.LANCZOS)
        feather = Image.new("L", (art_px, art_px), 0)
        pad = max(2, art_px // 30)
        ImageDraw.Draw(feather).rectangle((pad, pad, art_px - 1 - pad, art_px - 1 - pad), fill=255)
        art.putalpha(feather.filter(ImageFilter.GaussianBlur(pad)))
        fg = Image.new("RGBA", (fg_px, fg_px), (0, 0, 0, 0))
        fg.alpha_composite(art, ((fg_px - art_px) // 2, (fg_px - art_px) // 2))
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))

    # Splash screens (shown while the WebView boots): icon centred on the game background colour.
    for f in os.listdir(RES):
        p = os.path.join(RES, f, "splash.png")
        if f.startswith("drawable") and os.path.exists(p):
            w, h = Image.open(p).size
            img = Image.new("RGBA", (w, h), BG)
            s = round(min(w, h) * 0.35)
            art = src.resize((s, s), Image.LANCZOS)
            art.putalpha(mask(s, "square"))
            img.alpha_composite(art, ((w - s) // 2, (h - s) // 2))
            img.convert("RGB").save(p)
    print("icons written to", RES)


if __name__ == "__main__":
    main()
