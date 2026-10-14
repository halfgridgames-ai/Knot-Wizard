#!/usr/bin/env python3
"""Draws the Knot Wizard icon (a wizard hat over a tangled rope on forest green) as
web/icon-512.png, icon-192.png and apple-touch-icon.png, plus a 1024x500 Play feature
graphic in store/. Run from the repo root: python3 tools/make-icon.py  (needs Pillow)."""
import math, os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 4  # supersample

def rope(d, pts, w, col, dark, light):
    d.line(pts, fill=dark, width=w + 6 * S, joint='curve')
    d.line(pts, fill=col, width=w, joint='curve')
    # highlight dashes
    for i in range(len(pts) - 1):
        (x1, y1), (x2, y2) = pts[i], pts[i + 1]
        L = math.hypot(x2 - x1, y2 - y1)
        for t in range(0, int(L), 26 * S):
            a, b = t / L, min(1, (t + 12 * S) / L)
            d.line([(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a), (x1 + (x2 - x1) * b, y1 + (y2 - y1) * b)], fill=light, width=max(2, w // 3))

def pin(d, x, y, r):
    d.ellipse((x - r, y - r + 4 * S, x + r, y + r + 4 * S), fill=(30, 50, 30, 70))
    d.ellipse((x - r, y - r, x + r, y + r), fill=(124, 74, 34), outline=(94, 56, 24), width=3 * S)
    d.ellipse((x - r * 0.75, y - r * 0.75, x + r * 0.25, y + r * 0.25), fill=(192, 131, 71))
    d.ellipse((x - r * 0.5, y - r * 0.55, x - r * 0.1, y - r * 0.15), fill=(246, 215, 164))

def icon(size):
    big = size * S
    img = Image.new('RGBA', (big, big), (28, 58, 46, 255))
    d = ImageDraw.Draw(img)
    # felt board
    m = int(big * 0.07)
    d.rounded_rectangle((m, m, big - m, big - m), radius=int(big * 0.16), fill=(230, 238, 214), outline=(211, 224, 191), width=6 * S)
    # ropes
    u = big / 100
    rope(d, [(22 * u, 72 * u), (78 * u, 30 * u)], int(7 * u), (239, 122, 90), (150, 60, 40), (255, 190, 170))
    rope(d, [(22 * u, 30 * u), (78 * u, 72 * u)], int(7 * u), (47, 156, 150), (20, 85, 80), (170, 230, 225))
    rope(d, [(50 * u, 22 * u), (50 * u, 80 * u)], int(7 * u), (138, 108, 209), (70, 45, 130), (210, 195, 245))
    for x, y in [(22, 72), (78, 30), (22, 30), (78, 72), (50, 22), (50, 80)]:
        pin(d, x * u, y * u, 6.5 * u)
    # knot marker
    d.ellipse((44 * u, 45 * u, 56 * u, 57 * u), fill=(228, 86, 110))
    d.line([(47 * u, 48 * u), (53 * u, 54 * u)], fill='white', width=int(1.6 * u)); d.line([(53 * u, 48 * u), (47 * u, 54 * u)], fill='white', width=int(1.6 * u))
    # wizard hat, bottom right
    hx, hy = 72 * u, 90 * u
    d.ellipse((hx - 22 * u, hy - 6 * u, hx + 22 * u, hy + 6 * u), fill=(67, 47, 138))
    d.polygon([(hx, hy - 42 * u), (hx + 17 * u, hy), (hx - 17 * u, hy)], fill=(106, 79, 196))
    d.polygon([(hx, hy - 42 * u), (hx + 17 * u, hy), (hx + 7 * u, hy)], fill=(67, 47, 138))
    for sx, sy, r in [(hx - 5 * u, hy - 22 * u, 2.2 * u), (hx + 3 * u, hy - 12 * u, 1.8 * u), (hx - 1 * u, hy - 32 * u, 1.3 * u)]:
        d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=(245, 184, 61))
    return img.resize((size, size), Image.LANCZOS)

def feature():
    W, H = 1024, 500
    img = Image.new('RGB', (W * 2, H * 2), (28, 58, 46))
    d = ImageDraw.Draw(img)
    ic = icon(380)
    img.paste(ic, (110, 310), ic)
    # title drawn as chunky text with the default font is ugly; use rope letters? Keep it simple: big label via PIL default is tiny.
    try:
        from PIL import ImageFont
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 150)
        f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 56)
    except Exception:
        f = f2 = None
    d.text((560, 330), 'Knot Wizard', fill=(245, 184, 61), font=f)
    d.text((566, 530), 'Drag the pins. Untie every knot.', fill=(168, 195, 179), font=f2)
    return img.resize((W, H), Image.LANCZOS)

os.makedirs(os.path.join(ROOT, 'web'), exist_ok=True)
os.makedirs(os.path.join(ROOT, 'store'), exist_ok=True)
icon(512).save(os.path.join(ROOT, 'web', 'icon-512.png'))
icon(192).save(os.path.join(ROOT, 'web', 'icon-192.png'))
icon(180).convert('RGB').save(os.path.join(ROOT, 'web', 'apple-touch-icon.png'))
feature().save(os.path.join(ROOT, 'store', 'feature-graphic-1024x500.png'))
print('icons written')
