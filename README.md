# Hindi Flashcards

Hindi flashcards for kids, with an English | Hindi | Chinese (Simplified) side-by-side mode.

- `web/` — the app (vanilla HTML/CSS/JS, no build step). All content is in `web/data/cards.json`.
- `android/` — a WebView wrapper. The build copies `web/` into `app/src/main/assets/www`, so the APK runs offline.

## Run the web app locally

```bash
python3 -m http.server 8000 --directory web
```

Then open http://localhost:8000.

## Build the APK

Needs JDK 17 and the Android SDK (`ANDROID_HOME`, or `sdk.dir` in `android/local.properties`).

```bash
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (signed with the debug key, so it can be sideloaded).

## Adding cards

Add an entry to `cards` in `web/data/cards.json`. Required: `id` (unique), `deck`, `hi`, `roman`, `en`.
Optional: `zh`, `py` (pinyin), `hint`, `ex` (`{hi, roman, en}` example word), `color` (hex swatch), `digit`.
Sentence cards can use `{name}`, `{city}`, `{age}`, `{grade}` (filled from Settings) and `hi_f` / `roman_f` for the girl form.

After changing web files, bump `VERSION` in `web/sw.js` so installed copies pick up the change.

## Deploys

- `.github/workflows/pages.yml` deploys `web/` to GitHub Pages on every push to `main`.
- `.github/workflows/android.yml` builds the APK on every push (download it from the run's artifacts). Push a tag like `v1.0` to attach it to a GitHub Release.
