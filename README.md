# Docxzal — AI Question Paper → Clean Word + PDF

**Design:** warm-neutral editorial minimalism — “Bone & Ink” light and “Midnight Slate” dark, no brand hue, Poppins, hairline borders and a floating frosted-glass dock with centered mode tabs, a shrink-on-scroll capsule and a reading-progress bar. The day/night toggle uses a circular View-Transitions reveal; Photo-to-AI is an expandable section. There is no model picker: the model is chosen and swapped automatically from the key's live catalogue.

**Brand:** the monochrome paper + check mark (small in the header, inverted in dark mode) is shared by the web page, favicon, Android launcher and splash. A short logo intro plays once per tab; click the Docxzal logo to replay it (`?intro=1` also forces it).

Paste messy output from Gemini / ChatGPT → clean **A4 preview** → **proper .docx with native editable Word equations** + **PDF**.

Author: **Bipin Rizal** — https://github.com/Bipin223

## Run
`python server.py` → http://localhost:8000 (stdlib only, no install). The server proxies AI calls; keys typed in the page stay in the browser field and go only to your local proxy, are never written to disk, logs, or error messages.

### Hosted on GitHub Pages (no server)
Pages serves files only, so `POST /api/*` is a `405` there. The page detects that once (`/api/status` not answering JSON) and switches to talking to Gemini directly with `x-goog-api-key` — Google's REST API allows browser CORS, so Test and Generate work on the static site with the key you type in. Nothing is stored in either mode; the key lives in the field for the open page only.

## AI architecture
- `askAI({provider, model, messages, signal})` is the single frontend entry → `POST /api/ai`
- `POST /api/test` does the whole job in one call: it proves the key, finds a model that actually answers, and returns every text model the key can see. `stream: true` answers in newline-delimited progress events, so the card shows each hop live — "Checking the key with gemini-4-argon…", "gemini-4-argon is busy · routing to gemini-3.8-flash…" — and only reports an error when the key itself is rejected. A busy / retired / quota-limited / silent model is never surfaced as an error; the whole run is capped by one 30s budget
- **No model picker**: the server ranks the key's own catalogue — `PREFERRED_MODELS` in `server.py` (gemini-3.5-flash, including `-001`/`-latest` variants) goes first, then the newest stable general model — and `/api/ai` automatically falls back to the next working model on a retired id, a per-model quota error, a refusal, an empty answer or a timeout — up to 3 attempts. A rejected key is never retried (that's not a model problem)
- Retirement errors name a replacement (`use models/x`); that id is jumped to immediately and dead ids are remembered per key so later calls skip them
- **Nothing is saved**: there is no Save or Discover button. The key lives in the page field, rides along per request, and is never written to disk. Test/Cancel is the only action; Clear wipes the field
- Provider settings: masked key input (explicit show/clear clicks) and Test & find a model. A thinking model whose probe runs out of tokens is retried with a bigger budget before it is considered busy
- Answers show "Answered by Gemini · model · auto-switched from X" when a substitution happened
- Success normalizes to `{text, provider, model, requested, switched, tried}`; errors to `{error, code}` with credentials scrubbed

## Author photo
Save the author photo as `author.jpg` next to `index.html` (fallback shows BR initials).

## Deploy to GitHub Pages
Push to repo → Settings → Pages → `main` / root, or use `.github/workflows/pages.yml`.

## Android app (Capacitor)
The phone app is a self-contained Capacitor build: all JS, CSS, fonts and libraries are bundled inside the APK, so preview and exports work offline. AI calls go **directly** to Gemini (there is no Python proxy on a phone), and exports open Android's native save/share sheet instead of a browser download.

**Requirements:** Node 20+, Android SDK platform 36 + build-tools 35, and **JDK 21**. Newer JDKs (25/26) fail with `Unsupported class file major version 69`; Gradle 8.14.3 cannot run on them.

Build:
```powershell
npm install
npm run sync                 # build www/ + copy into android/
cd android
$env:JAVA_HOME="$env:LOCALAPPDATA\opencode-jdk21\jdk-21.0.12.1+1"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
.\gradlew.bat assembleDebug
```

APK: `android\app\build\outputs\apk\debug\app-debug.apk`  
Install on a connected phone: `adb install -r android\app\build\outputs\apk\debug\app-debug.apk`

- App id `com.bipinrizal.docxzal`, name **Docxzal**; launcher icon and splash are generated in `android/app/src/main/res/`.
- `www/` is generated — edit the root `app.js` / `index.html` / `styles.css`, then run `npm run sync` again. Never edit `www/` or `android/app/src/main/assets/public/` by hand.
- Re-download the pinned vendor libraries with `npm run vendor` if `vendor/` is missing.
- This is a debug APK (installable by sideloading). For Play Store distribution, create a signed release build in Android Studio.
- Runtime-tested: web preview/exports. Native-only behaviour (share sheet, camera permission, safe-area layout) still needs a check on a physical phone.

## Conversion coverage (the essence)
Every LaTeX construct becomes its proper Word form — verified against the `docx@8.5.0` OMML API, 13/13 engine checks green:
- `\frac`, `\dfrac`, `\binom`, `\sqrt[n]{}` → stacked fractions, n-th roots
- `^` / `_` (incl. `x^{2}`, `A^{-1}`) → true superscripts/subscripts
- `\sum`, `\int` + limits → native ∑ / ∫ with sub/superscripts; `\prod`, `\bigcup`… → proper large operators
- `\sin`, `\log`, `\lim`… → Word functions; `\lim_{x\to0}` keeps its limit
- `\hat`, `\vec`, `\dot`, `\overline`, `\cancel`, `\boxed` → accents/overlays/boxes
- Matrices (`pmatrix`…) → growing brackets; `cases` → clean 2-column layout; `align`/`\\` → separate display equations; `\tag{}` kept
- 100+ symbols: Greek, `× ÷ ± ≤ ≥ ≠ ∞ → ° ∂ ∇ ∀ ∃ …`
- Unknown commands are kept as literal text — nothing is ever silently dropped
- Toggle *Native Word equations* for plain-text fallback

## Edit in place (new)
- The A4 paper itself is editable: click it and type, delete, paste (pasted text is auto-cleaned to plain text)
- Format bar: **B** *I* <u>U</u>, four alignment buttons, ― horizontal line (exports as a real Word line), ⌫ clear formatting
- Marks show as plain right-margin text `[2 marks]` — no boxes. Formulas are locked while editing so they can't break
- **Exports use your edited version**: `.docx` keeps bold/italic/underline, alignment, tables, code, lines, and native equations; `.doc`/PDF mirror the preview

## Text & layout
- **Heading size** and **Body text size**: Small → Normal → Large → Extra large → **Huge** → **Max**
- **Text alignment**: Left / Center / Right / Justify (document default) plus four alignment buttons for selected paragraphs
- Word-default **1″ margins** and header off by default; the header can be switched back on in Paper setup

## Export
- **.docx** — real `.docx` (editable equations), **PDF** button, and a **More** menu: Print, **.doc**, **PowerPoint .pptx** (title slide + question slides; math as readable Unicode — PPTX has no equation objects), **Markdown .md**, standalone **.html**
- PDF keeps exact A4 sheets, splits long tables by rows with a repeated header, keeps inline code tokens intact, and balances the final page
- Fullscreen preview button (⛶) + A−/A+ zoom for a proper full-window read

## Photo → AI (new)
- **Take photo** (in-app camera modal, needs HTTPS/localhost + permission) or **Upload** (works everywhere)
- Photo is downscaled in-browser, then sent to Gemini with your question
- Ask it to extract questions as Markdown + `$LaTeX$`, then **Send to editor** → Clean & Preview → export. Full chat-and-extract loop.
