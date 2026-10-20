# Docxzal — AI Question Paper → Clean Word + PDF

**Design:** warm minimalist caffeine theme — borderless tonal surfaces, Poppins, Lucide outline icons, gradient separators. Light/dark toggle uses a circular View-Transitions reveal; tabs use center-out underlines + hover wave; Photo-to-AI is an expandable section. There is no model picker: the model is chosen and swapped automatically from the key's live catalogue.

Paste messy output from Gemini / ChatGPT → clean **A4 preview** → **proper .docx with native editable Word equations** + **PDF**.

Author: **Bipin Rizal** — https://github.com/Bipin223

## Run
`python server.py` → http://localhost:8000 (stdlib only, no install). The server proxies AI calls; keys typed in the page stay in the browser field and go only to your local proxy, are never written to disk, logs, or error messages.

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
- Format bar: **B** *I* <u>U</u>, ― horizontal line (exports as a real Word line), ⌫ clear formatting
- Marks show as plain right-margin text `[2 marks]` — no boxes. Formulas are locked while editing so they can't break
- **Exports use your edited version**: `.docx` keeps bold/italic/underline, tables, code, lines, and native equations; `.doc`/PDF mirror the preview

## Export
- **.docx** — real `.docx` (editable equations), **PDF** button, and a **More** menu: Print, **.doc**, **PowerPoint .pptx** (title slide + question slides; math as readable Unicode — PPTX has no equation objects), **Markdown .md**, standalone **.html**
- Fullscreen preview button (⛶) + A−/A+ zoom for a proper full-window read

## Photo → AI (new)
- **Take photo** (in-app camera modal, needs HTTPS/localhost + permission) or **Upload** (works everywhere)
- Photo is downscaled in-browser, then sent to Gemini with your question
- Ask it to extract questions as Markdown + `$LaTeX$`, then **Send to editor** → Clean & Preview → export. Full chat-and-extract loop.
