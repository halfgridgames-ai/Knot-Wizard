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
