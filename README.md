# Knot Wizard

A rope-untangling puzzle game by Halfgrid Games. Drag the wooden pins until no rope crosses another.

150 levels in 5 worlds (Forest, Castle: locked pins, Docks: stretchy ropes, Clouds: tied pins, Void: spinning board), generated from fixed seeds so every player gets the same levels. Each world has its own music loop, synthesised in the browser, so the game ships no audio files.

- `index.html`: the whole game, one file. Open it in a browser to play.
- `build-web.py`: builds the installable web version into `web/` (GitHub Pages publishes it on every push to `main`).
- `android-app/`: the Android app (Capacitor 8), built by GitHub Actions. See `android-app/README.md` for signing and release steps.
- `privacy.html`: the privacy policy, published at `/privacy.html` on the Pages site.
- `store/`: Play Store listing text and the feature graphic.
- `tools/make-icon.py`: redraws the icon and feature graphic.
- `tools/record-clips.js`: records 1080x1920 gameplay clips with music for TikTok, Reels and Shorts (`node tools/record-clips.js clips/`), or the soundtrack as mp3s (`--soundtrack`). Needs Playwright and ffmpeg.

Ads use Google's test ids and purchases are free test purchases until the real ids are swapped in (see `android-app/README.md`, "Before launch").
