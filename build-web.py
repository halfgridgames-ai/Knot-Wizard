# Builds the installable GitHub Pages version (web/) from the single-file game (index.html).
import hashlib, pathlib, shutil
root = pathlib.Path(__file__).parent
src = (root / 'index.html').read_text()
assert 'cdnjs' not in src   # the game has no script libraries; fonts come from Google Fonts and are cached by sw.js
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#1c3a2e">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Knot Wizard">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
'''
body_split = src.index('</style>') + len('</style>')
out = head + src[:body_split] + '\n</head>\n<body>\n' + src[body_split:] + '''
<script>if ('serviceWorker' in navigator && !window.Capacitor) addEventListener('load', () => navigator.serviceWorker.register('sw.js'));</script>
</body>
</html>
'''
(root / 'web').mkdir(exist_ok=True)
(root / 'web' / 'index.html').write_text(out)
shutil.copy(root / 'privacy.html', root / 'web' / 'privacy.html')   # privacy policy page for the Play listing
ver = hashlib.sha1((out + (root / 'web' / 'manifest.webmanifest').read_text()).encode()).hexdigest()[:10]
sw = (root / 'sw-template.js').read_text().replace('__VERSION__', ver)
(root / 'web' / 'sw.js').write_text(sw)
print('built web/ version', ver)

# Store assets page (web/store.html) so the Play graphics can be saved from a phone.
shutil.copytree(root / 'store', root / 'web' / 'store', dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.md'))
shutil.copy(root / 'web' / 'icon-512.png', root / 'web' / 'store' / 'icon-512.png')
items = [('App icon (512×512)', 'store/icon-512.png'), ('Feature graphic (1024×500)', 'store/feature-graphic-1024x500.png')]
items += [(f'Phone screenshot {p.stem}', 'store/screenshots/' + p.name) for p in sorted((root / 'store' / 'screenshots').glob('*.png'))]
cards = '\n'.join(f'<figure><img src="{u}" alt="{t}"><figcaption>{t} <a href="{u}" download>Download</a></figcaption></figure>' for t, u in items)
(root / 'web' / 'store.html').write_text(f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Knot Wizard store assets</title>
<style>body{{margin:0;padding:16px;background:#1c3a2e;color:#f3ead2;font:16px/1.4 system-ui,sans-serif}}
h1{{font-size:22px;color:#f5b83d}}p{{opacity:.85}}figure{{margin:0 0 28px}}img{{display:block;max-width:100%;border-radius:8px}}
figcaption{{margin-top:8px;display:flex;justify-content:space-between;gap:8px}}a{{color:#f5b83d;font-weight:700}}</style></head>
<body><h1>Knot Wizard store assets</h1><p>Press and hold an image, then choose Save or Download image. Or tap Download.</p>
{cards}
</body></html>
''')
