#!/usr/bin/env python3
"""Beepin Docx local server (stdlib only).

Serves the static app and proxies AI requests so API keys never touch
the browser, logs, or error messages.

Endpoints:
  GET  /api/status            -> {gemini:bool}
  POST /api/keys   {provider, key} -> {ok:true}            (memory only)
  DELETE /api/keys?provider=x -> {ok:true}
  POST /api/models  {provider, key?} -> {models:[{id}], cached:bool}
       (ids come from the key's own catalogue, ranked newest-stable first)
  POST /api/test  {provider, key?, model?, stream?} -> {ok, model, models[], verified, tried[], ms}
       (one call: verify key + find a model that answers + list models; never stored.
        A busy / retired / silent model is routed past automatically; stream:true answers
        in newline-delimited progress events, then {"event":"done", ...})
  POST /api/ai {provider, model?, messages, maxTokens?, vision?, key?}
       -> {text, provider, model, requested, switched, tried[]} | {error, code}
       (model is a hint: a retired / quota-limited / silent model is swapped for the
        next working one automatically; the key is never stored)
"""
import hashlib
import json
import queue
import re
import threading
import time
import urllib.request
import urllib.error
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE = __file__.rsplit("/", 1)[0].rsplit("\\", 1)[0] or "."

KEYS = {}            # provider -> key; memory only, never persisted
MODELS_CACHE = {}    # key fingerprint -> (timestamp, [ids]); TTL below
CACHE_TTL = 300
LAST_GOOD = {}       # last model that actually succeeded
DEAD = {}            # provider -> ids this key cannot call (retired / gated)
# Route order: the models that work best for this app are probed first whenever the key
# can see them; everything else follows the auto-ranking. Edit this tuple to change it.
PREFERRED_MODELS = ("gemini-3.5-flash",)
# Bootstrap only: used when the catalogue is unknown (first run, discovery failure).
BOOTSTRAP_MODELS = PREFERRED_MODELS + ("gemini-flash-latest",)
MAX_ATTEMPTS = 3     # generate: try this many models before giving up
TEST_CANDIDATES = 6  # Test probes at most this many models before giving up
RECENT_KEYS = []     # last few keys used, so typed keys never leak into errors
# generateContent models that cannot answer text — never worth probing
NON_TEXT = ("image", "embedding", "embed", "tts", "audio", "live", "computer-use")
UPSTREAM_TIMEOUT = 110
DISCOVERY_TIMEOUT = 15
TEST_PING_TIMEOUT = 12  # a text ping answers in ~1s; never hold the UI longer than this
TEST_BUDGET = 30        # whole Test run, including every hop, is capped here


def remember_key(key):
    """Keep recently used keys around only so error text can be scrubbed."""
    if not key:
        return
    with threading.Lock():
        if key not in RECENT_KEYS:
            RECENT_KEYS.append(key)
            del RECENT_KEYS[:-8]


def scrub(msg):
    for k in list(KEYS.values()) + list(RECENT_KEYS):
        if k and len(k) > 6 and k in msg:
            msg = msg.replace(k, "[api-key]")
    return msg


def jsend(handler, code, obj):
    body = json.dumps(obj).encode()
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def upost(url, payload, headers, timeout):
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode())


def uget(url, headers, timeout):
    req = urllib.request.Request(url, headers=headers or {}, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode())


def upstream_error(provider, exc):
    if isinstance(exc, urllib.error.HTTPError):
        try:
            detail = json.loads(exc.read().decode())
            msg = (detail.get("error") or {}).get("message", "") or str(detail)[:200]
        except Exception:
            msg = exc.reason if isinstance(exc.reason, str) else "request failed"
        return {"error": scrub(str(msg))[:300], "code": f"UPSTREAM_{exc.code}", "status": exc.code}
    if isinstance(exc, TimeoutError) or "timed out" in str(exc).lower():
        return {"error": f"{provider} timed out", "code": "TIMEOUT", "status": None}
    return {"error": scrub(f"{provider} unreachable: {exc}")[:200], "code": "NETWORK", "status": None}


# ----- provider adapters: shared [{role, content, image?}] -> native -----
def gemini_payload(messages, max_tokens):
    system, contents = [], []
    for m in messages:
        role, text = m.get("role", "user"), m.get("content", "")
        if role == "system":
            system.append(text)
        else:
            parts = [{"text": text}] if text else []
            if m.get("image"):
                b64 = m["image"].split(",", 1)[1] if "," in m["image"] else m["image"]
                parts.append({"inline_data": {"mime_type": "image/jpeg", "data": b64}})
            contents.append({"role": "model" if role == "assistant" else "user", "parts": parts})
    body = {"contents": contents or [{"role": "user", "parts": [{"text": "hi"}]}],
            "generationConfig": {"maxOutputTokens": max_tokens or 4096, "temperature": 0.7}}
    if system:
        body["systemInstruction"] = {"parts": [{"text": "\n".join(system)}]}
    return body


def gemini_text(resp):
    cands = resp.get("candidates") or []
    if not cands:
        reason = ((resp.get("promptFeedback") or {}).get("blockReason")) or "empty response"
        return None, {"error": f"Gemini declined: {reason}", "code": "REFUSED"}
    cand = cands[0] or {}
    parts = ((cand.get("content") or {}).get("parts")) or []
    text = "".join(p.get("text", "") for p in parts
                   if isinstance(p, dict) and not p.get("thought") and isinstance(p.get("text", ""), str))
    if text:
        return text, None
    # 200 OK but no answer text — report why instead of a dead-end error
    det = f"finish={cand.get('finishReason') or '?'}"
    ratings = [r for r in (cand.get("safetyRatings") or []) if isinstance(r, dict)]
    if ratings:
        det += " safety=[" + ",".join(
            f"{str(r.get('category', '?')).split('/')[-1]}={r.get('probability', '?')}"
            for r in ratings) + "]"
    if any(isinstance(p, dict) and p.get("thought") for p in parts):
        det += "; answer empty because the model spent its tokens thinking (raise maxTokens)"
    return None, {"error": f"Gemini returned no text ({det})", "code": "BAD_RESPONSE"}


def dead_model(err):
    """A model id this key can no longer call (retired / gated / renamed)."""
    if not isinstance(err, dict):
        return False
    msg = str(err.get("error", "")).lower()
    return err.get("code") == "UPSTREAM_404" or any(
        s in msg for s in ("no longer available", "not found", "not supported",
                           "has been retired", "is not found", "does not have a handler"))


def retry_elsewhere(err):
    """Would a different model plausibly answer? Only then is a retry worth it."""
    if not isinstance(err, dict):
        return False
    code = err.get("code") or ""
    if code in ("NO_KEY", "NETWORK", "CANCELLED"):
        return False
    if code in ("UPSTREAM_400", "UPSTREAM_401", "UPSTREAM_403") and not dead_model(err):
        # a rejected key / bad request is not fixed by another model id
        return False
    return True  # retired, gated, quota, refused, empty answer, timeout: try a sibling


def model_hint(err):
    """Google names the replacement id in retirement errors: 'use models/x'."""
    m = re.search(r"models/([A-Za-z0-9._-]+)", str((err or {}).get("error", "")))
    return m.group(1) if m else ""


def call_provider(model, messages, max_tokens, key=None, timeout=UPSTREAM_TIMEOUT):
    key = key or KEYS.get("gemini")
    if not key:
        return None, {"error": "No gemini key saved", "code": "NO_KEY", "status": None}
    remember_key(key)
    model = (model or "").replace("models/", "").strip()
    try:
        _, resp = upost(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
            gemini_payload(messages, max_tokens), {}, timeout)
        return gemini_text(resp)
    except Exception as exc:  # noqa: BLE001 - normalized below
        return None, upstream_error("gemini", exc)


def fingerprint(key):
    return hashlib.sha256((key or "").encode()).hexdigest()[:16]


def list_models(key, use_cache=True):
    """-> (ids, cached) | (None, error). Cached per key fingerprint, never stored."""
    if not key:
        return None, {"error": "No gemini key saved", "code": "NO_KEY"}
    remember_key(key)
    fp = fingerprint(key)
    now = time.time()
    hit = MODELS_CACHE.get(fp)
    if use_cache and hit and now - hit[0] < CACHE_TTL:
        return hit[1], True
    try:
        _, resp = uget("https://generativelanguage.googleapis.com/v1beta/models?key=" + key,
                       {}, DISCOVERY_TIMEOUT)
        ids = []
        for m in resp.get("models", []):
            if "generateContent" in (m.get("supportedGenerationMethods", [])):
                ids.append(m.get("name", "").replace("models/", ""))
    except Exception as exc:  # noqa: BLE001
        return None, upstream_error("gemini", exc)
    if use_cache:
        MODELS_CACHE[fp] = (now, ids)
        if len(MODELS_CACHE) > 8:  # typed keys rotate; keep the cache small
            for old in sorted(MODELS_CACHE, key=lambda k: MODELS_CACHE[k][0])[:-8]:
                MODELS_CACHE.pop(old, None)
    return ids, False


def is_preferred(mid):
    """Exact id or a variant of it (…-001, …-latest) — never a bare prefix of another family."""
    s = (mid or "").lower().replace("models/", "").strip()
    return any(s == p or s.startswith(p + "-") for p in PREFERRED_MODELS)


def model_rank(mid):
    """Preference first, then newest stable general model; lower sorts better."""
    s = (mid or "").lower()
    preferred = 0 if is_preferred(s) else 1
    ver = re.search(r"(\d+(?:\.\d+)?)", s)
    version = float(ver.group(1)) if ver else 0.0
    unstable = 1 if any(t in s for t in ("preview", "exp", "experimental", "thinking", "vision")) else 0
    lite = 1 if "lite" in s else 0
    family = 0 if "flash" in s else (1 if "pro" in s else 2)
    return (preferred, unstable, lite, -version, family, len(s), s)


def text_models(ids):
    """Text-capable models this key can see, best first — ordered by the live catalogue."""
    usable = [i for i in (ids or []) if i and not any(s in i.lower() for s in NON_TEXT)]
    return sorted(dict.fromkeys(usable), key=model_rank)


def candidate_chain(key, asked):
    """Preferred / asked model first, then the key's own best models as backups."""
    ids, _ = list_models(key, use_cache=True)
    ranked = text_models(ids)
    chain = []

    def add(m):
        m = (m or "").replace("models/", "").strip()
        if m and m not in chain and m not in DEAD.get("gemini", set()):
            chain.append(m)

    # there is no user model picker: a preferred model the key can see wins over the
    # app's remembered one, so every call starts on the model that works best here.
    for m in ranked:
        if is_preferred(m):
            add(m)
    add(asked)
    add(LAST_GOOD.get("gemini"))
    for m in ranked:
        add(m)
    if not ids:  # no catalogue: guess from the preferred ids instead
        for m in BOOTSTRAP_MODELS:
            add(m)
    return chain


def ping_model(key, model, timeout=TEST_PING_TIMEOUT):
    """Tiny text call: can this model answer at all? Thinking models get a second try."""
    ask = [{"role": "user", "content": "Reply with exactly: ok"}]
    text, err = call_provider(model, ask, 256, key=key, timeout=timeout)
    if text is None and "spent its tokens thinking" in str((err or {}).get("error", "")):
        # The model is fine — our probe was just too small for its thinking budget.
        text, err = call_provider(model, ask, 2048, key=key, timeout=timeout)
    return text, err


def short_reason(err):
    """One short phrase for a failed probe; raw upstream text never reaches the card."""
    if not isinstance(err, dict):
        return "didn't answer"
    code = str(err.get("code") or "")
    msg = str(err.get("error") or "").lower()
    if dead_model(err) or "retired" in msg:
        return "retired"
    if code == "UPSTREAM_429" or any(
            s in msg for s in ("quota", "rate limit", "resource_exhausted", "exhausted")):
        return "limit reached"
    if code == "TIMEOUT":
        return "timed out"
    if code == "REFUSED":
        return "declined"
    if code == "BAD_RESPONSE":
        return "no usable answer"
    if code in ("UPSTREAM_500", "UPSTREAM_502", "UPSTREAM_503", "UPSTREAM_504"):
        return "overloaded"
    if code in ("UPSTREAM_400", "UPSTREAM_401", "UPSTREAM_403"):
        return "key rejected"
    return "didn't answer"


def route_test(key, explicit, emit):
    """Verify the key, then keep routing: the first model that answers wins.

    `emit` receives progress events ({event: try|busy|catalogue, ...}) so a streaming
    caller can show each hop; the return value is the same summary the JSON call gets.
    """
    t0 = time.time()
    budget = t0 + TEST_BUDGET
    results = queue.Queue()
    active = set()

    def probe(m):
        text, err = ping_model(key, m)
        results.put((m, text, err))

    def launch(m, first_one=False):
        active.add(m)
        emit({"event": "try", "model": m, "first": bool(first_one)})
        threading.Thread(target=probe, args=(m,), daemon=True).start()

    # discovery proves the key and ranks its catalogue; it usually answers in ~0.2s,
    # so wait briefly for it to pick the model to probe — but never hang on it.
    box = {}
    disc = threading.Thread(
        target=lambda: box.setdefault("d", list_models(key, use_cache=False)), daemon=True)
    disc.start()
    while disc.is_alive() and time.time() < min(budget, t0 + 3.0):
        time.sleep(0.02)
    ids0, _ = box.get("d", (None, None))
    ranked0 = text_models(ids0 or [])
    # the key's own catalogue is already preference-ordered, so its top entry is the
    # model to start with; without a catalogue, start from the preferred ids anyway
    first = (explicit or (ranked0[0] if ranked0 else "") or LAST_GOOD.get("gemini")
             or BOOTSTRAP_MODELS[0])
    launch(first, True)

    # the probe may answer before the catalogue does: give discovery a moment
    while disc.is_alive() and results.empty() and time.time() < min(budget, t0 + TEST_PING_TIMEOUT):
        time.sleep(0.02)
    if not results.empty():
        disc.join(1.5)  # a fast probe already answered: still fill in the model count
    ids, extra = box.get("d", (None, None))
    ids_err = extra if isinstance(extra, dict) else None
    shown = text_models(ids or [])
    if shown:
        emit({"event": "catalogue", "count": len(shown)})

    order = []

    def backup(m):
        m = (m or "").replace("models/", "").strip()
        if m and m != first and m not in order and m not in DEAD.get("gemini", set()):
            order.append(m)

    backup(LAST_GOOD.get("gemini"))
    for m in shown:
        backup(m)
    if not shown:  # no catalogue: guess from the preferred ids instead
        for m in BOOTSTRAP_MODELS:
            backup(m)

    tried, text, model, err = [], None, None, None
    while True:
        if not active and order and len(tried) < TEST_CANDIDATES and time.time() < budget:
            launch(order.pop(0))
        if not active:
            break
        try:
            m, t, e = results.get(timeout=max(0.05, min(2.0, budget - time.time())))
        except queue.Empty:
            continue
        active.discard(m)
        if t is not None:
            text, model = t, m
            break
        err = e or err
        reason = short_reason(e)
        tried.append({"model": m, "reason": reason})
        if dead_model(e):
            DEAD.setdefault("gemini", set()).add(m)
            hint = model_hint(e)
            if hint and hint != m:
                order.insert(0, hint)
        if not shown and not retry_elsewhere(e):
            break  # no catalogue and no answer: the key itself is the problem
        emit({"event": "busy", "model": m, "reason": reason})

    ms = int((time.time() - t0) * 1000)
    if text is not None:
        LAST_GOOD["gemini"] = model
        return {"ok": True, "provider": "gemini", "model": model, "models": shown,
                "verified": True, "tried": tried, "ms": ms}
    if shown:
        # ListModels answers only for a valid key, so the key is good even when every
        # model is busy this minute; /api/ai keeps routing on its own.
        return {"ok": True, "provider": "gemini", "model": shown[0], "models": shown,
                "verified": False, "note": short_reason(err), "tried": tried, "ms": ms}
    out = dict(err or ids_err or {"error": "Test failed", "code": "BAD_RESPONSE"})
    out.update({"tried": tried, "ms": ms})
    return out


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet: method + path only
        print(f"{self.command} {self.path.split('?')[0]}")

    def _json(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
        except ValueError:
            n = 0
        try:
            return json.loads(self.rfile.read(n).decode() or "{}")
        except Exception:
            return {}

    def do_GET(self):
        if self.path == "/api/status":
            return jsend(self, 200, {"gemini": bool(KEYS.get("gemini"))})
        return super().do_GET()

    def do_DELETE(self):
        from urllib.parse import urlparse, parse_qs
        if urlparse(self.path).path == "/api/keys":
            p = parse_qs(urlparse(self.path).query).get("provider", [""])[0]
            KEYS.pop(p, None)
            LAST_GOOD.pop(p, None)
            DEAD.pop(p, None)
            return jsend(self, 200, {"ok": True})
        return jsend(self, 404, {"error": "not found", "code": "NOT_FOUND"})

    def do_POST(self):
        body = self._json()
        if self.path == "/api/keys":
            p, key = body.get("provider"), (body.get("key") or "").strip()
            if p != "gemini" or not key:
                return jsend(self, 400, {"error": "provider and key required", "code": "BAD_REQUEST"})
            KEYS[p] = key
            DEAD.pop(p, None)
            LAST_GOOD.pop(p, None)
            return jsend(self, 200, {"ok": True})
        if self.path == "/api/settings":
            return jsend(self, 200, {"ok": True})  # kept for compat; single provider now
        if self.path == "/api/models":
            p = body.get("provider", "gemini")
            if p not in ("gemini", "auto"):
                return jsend(self, 400, {"error": "provider must be gemini", "code": "BAD_REQUEST"})
            # a key typed in the page is used for this lookup only — never stored.
            # The catalogue is cached per key fingerprint so repeats are instant.
            typed = (body.get("key") or "").strip()
            ids, extra = list_models(typed or KEYS.get("gemini"))
            if isinstance(extra, dict):  # error
                return jsend(self, 200, extra)
            return jsend(self, 200, {"models": [{"id": i} for i in text_models(ids)],
                                     "cached": bool(extra)})
        if self.path == "/api/test":
            return self._test(body)
        if self.path == "/api/ai":
            return self._ai(body)
        return jsend(self, 404, {"error": "not found", "code": "NOT_FOUND"})

    def _test(self, body):
        """Verify the key, then route to the next model until one answers.

        With `stream: true` this answers in newline-delimited JSON so the card can show
        every hop ("gemini-4-argon busy -> trying gemini-3.8-flash") while it happens,
        and a busy / retired / silent model is never reported as an error. The key is
        used for this call only and is never stored.
        """
        provider = body.get("provider", "gemini")
        if provider not in ("gemini", "auto"):
            return jsend(self, 400, {"error": "provider must be gemini", "code": "BAD_REQUEST"})
        key = (body.get("key") or "").strip() or KEYS.get("gemini")
        if not key:
            return jsend(self, 200, {"error": "Paste a key first — Test doesn't save it",
                                     "code": "NO_KEY"})
        explicit = (body.get("model") or "").replace("models/", "").strip()
        if not body.get("stream"):
            return jsend(self, 200, route_test(key, explicit, lambda ev: None))
        self.send_response(200)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        result = route_test(key, explicit, self._emit_event)
        self._emit_event(dict(result, event="done"))

    def _emit_event(self, ev):
        try:
            self.wfile.write((json.dumps(ev) + "\n").encode())
            self.wfile.flush()
        except Exception:
            pass  # tab closed / Cancel pressed: routing may finish quietly

    def _ai(self, body):
        provider = body.get("provider", "gemini")
        if provider not in ("gemini", "auto"):
            return jsend(self, 400, {"error": "provider must be gemini", "code": "BAD_REQUEST"})
        model = body.get("model")
        messages = body.get("messages") or []
        max_tokens = body.get("maxTokens")
        vision = bool(body.get("vision"))
        if not isinstance(messages, list) or not messages:
            return jsend(self, 400, {"error": "messages required", "code": "BAD_REQUEST"})
        # a key typed in the page rides along per request; it is never stored
        key = (body.get("key") or "").strip() or KEYS.get("gemini")
        asked = (model or "").replace("models/", "").strip() or LAST_GOOD.get("gemini") or \
            BOOTSTRAP_MODELS[0]
        work = candidate_chain(key, asked)
        tried, err = [], None
        while work and len(tried) < MAX_ATTEMPTS:
            m = work.pop(0)
            tried.append(m)
            text, err = call_provider(m, messages, max_tokens, key)
            if text is not None:
                LAST_GOOD["gemini"] = m
                return jsend(self, 200, {"text": text, "provider": "gemini", "model": m,
                                         "requested": asked, "switched": m != asked,
                                         "tried": tried})
            if not retry_elsewhere(err):
                break
            if dead_model(err):
                # remember retired ids so later calls never pay for them again,
                # and jump straight to the replacement Google names.
                DEAD.setdefault("gemini", set()).add(m)
                hint = model_hint(err)
                if hint and hint not in tried:
                    work.insert(0, hint)
        return jsend(self, 200, dict(err or {"error": "No model answered", "code": "NO_MODEL"},
                                      tried=tried))


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", 8000), partial(Handler, directory=BASE))
    print("Docxzal on http://localhost:8000  (keys: memory only, never logged)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
