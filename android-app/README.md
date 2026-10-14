# Knot Wizard for Android

This folder turns the web game into an Android app you can install on a phone and
publish on Google Play. It uses [Capacitor](https://capacitorjs.com) 8, which wraps the
game in a full-screen Android WebView and adds two native plugins:

| Plugin | What it does | How the game reaches it |
| --- | --- | --- |
| `@capacitor-community/admob` 8.2.1 | Google AdMob ads (rewarded, interstitial, consent form) | `Capacitor.Plugins.AdMob` |
| `cordova-plugin-purchase` 13.18.0 | Google Play Billing (in-app purchases) | `window.CdvPurchase` (after `deviceready`) |

App id: `com.halfgridgames.knotwizard` - App name: **Knot Wizard**

## How the build works

You don't need Android Studio. GitHub builds the app for you on every push to `main`
(or when you press **Run workflow** on the Actions tab):

1. `python3 build-web.py` builds the game into `web/`.
2. `npm ci` (in `android-app/`) installs Capacitor and the plugins at the exact
   versions in `package-lock.json`.
3. `sync-web.sh` copies `web/` into `android-app/www/` (leaving out the service worker,
   which an app doesn't need) and runs `npx cap sync android`, which puts the game and
   the plugins into the Android project.
4. Gradle builds a **debug APK** every time. If the signing secrets are set (see below)
   it also builds a **signed release AAB**, the file Google Play wants.

The workflow file is `.github/workflows/android.yml` at the root of the repository.

### Folder guide

```
android-app/
  package.json, package-lock.json   Capacitor + plugin versions (pinned)
  capacitor.config.json             app id, name, background colour, hidden system bars
  sync-web.sh                       copies ../web into www/ and runs "cap sync android"
  tools/make-icons.py               makes the launcher icons + splash from ../web/icon-512.png
  android/                          the native Android project (committed)
  www/, node_modules/               created by the build, not committed
```

## Install the test app on your phone (sideload)

1. On GitHub open **Actions**, then click the latest **Android build** run with a green tick.
2. Scroll down to **Artifacts** and download **knot-wizard-debug-apk**. It downloads as a
   zip; unzip it to get `app-debug.apk`.
3. Copy the APK to your phone (or download it there directly) and open it. Android will ask
   you to allow installing apps from that source (your browser or Files app): allow it.

The debug app shows Google's **test** ads. Real purchases don't work in a sideloaded debug
build. Google Play Billing only works in a copy installed from Google Play, for example
from an internal testing track.

## Release signing: one-time setup

Google Play needs the app bundle signed with your own **upload key**. Create it once,
on any computer with Java installed:

```bash
keytool -genkeypair -v -keystore knot-wizard-upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a password and a few name fields. **Back up the .jks file and the password
somewhere safe.** Never commit them to git (`.gitignore` already blocks `*.jks`). If
you enrol in Play App Signing (the default), Google holds the real app-signing key, and a
lost upload key can be reset through Play Console support.

Then add four secrets on GitHub under **Settings -> Secrets and variables -> Actions ->
New repository secret**:

| Secret | Value |
| --- | --- |
| `KW_KEYSTORE_BASE64` | the keystore as base64: `base64 -w0 knot-wizard-upload.jks` (Linux) or `base64 -i knot-wizard-upload.jks` (macOS), then paste the whole output |
| `KW_KEYSTORE_PASSWORD` | the keystore password |
| `KW_KEY_ALIAS` | `upload` (the `-alias` from the command above) |
| `KW_KEY_PASSWORD` | the key password (the same as the keystore password unless you set a different one) |

The next run also uploads **knot-wizard-release-aab**. Unzip it and upload
`app-release.aab` in Play Console (Testing -> Internal testing -> Create release).

For a local signed build, set the same names as environment variables, with
`KW_KEYSTORE` set to the path of the .jks file, or put them in `~/.gradle/gradle.properties`.
If they are missing, the build still works and only the release output is left unsigned.

## Before launch: swap test ids for real ones

Everything ships with Google's public **test** ids, so you can't accidentally click your
own real ads during testing. Change all of these before publishing:

1. **AdMob app id**: `android/app/src/main/AndroidManifest.xml`, the
   `com.google.android.gms.ads.APPLICATION_ID` meta-data (marked `REPLACE BEFORE LAUNCH`).
   Replace `ca-app-pub-3940256099942544~3347511713` with your app id from the AdMob console
   (Apps -> your app -> App settings). App ids contain a `~`.
2. **Ad unit ids**: in the game's `index.html`, the `AD_UNITS` object (rewarded and
   interstitial). Replace them with the ad unit ids from AdMob (Apps -> Ad units). These
   contain a `/`.
3. **Test mode**: in the game's `index.html`, set `AD_TESTING = false`.
4. **In-app products**: in the game's `index.html`, the `PRODUCTS` list. Each `id` must
   exactly match a product you create in Play Console (Monetize -> Products -> In-app
   products). Make the one-time item (`once: true`) and the hint packs, then activate them.
   Play Console only lets you create products after you upload a first build that includes
   the billing library, so upload one AAB to internal testing first.
5. **Version**: in `android/app/build.gradle`, raise `versionCode` by 1 for every upload to
   Play (1, 2, 3...). Change `versionName` ("1.0.0") to whatever players should see.

After editing `index.html`, push to `main`. The workflow rebuilds `web/` and the app
on its own.

## Other notes

- **Target SDK**: Capacitor 8 targets and compiles against API 36, which is above Google
  Play's current minimum (API 35). Minimum supported Android version: 7.0 (API 24). The
  values live in `android/variables.gradle`.
- **Screen**: the app is full screen (status and navigation bars hidden; swipe from an edge
  to show them briefly), keeps the screen on while open, and is portrait only.
- **Icons**: if the game icon changes, run `python3 tools/make-icons.py` (needs Pillow) and
  commit the files it changes under `android/app/src/main/res/`.
- **Local build** (optional; needs Android Studio or the Android SDK plus Java 21):
  `npm ci && bash sync-web.sh && cd android && ./gradlew assembleDebug`.
- **Upgrading Capacitor**: keep `@capacitor/core`, `@capacitor/cli` and `@capacitor/android`
  on the same version, and check that the AdMob plugin supports that major version.
