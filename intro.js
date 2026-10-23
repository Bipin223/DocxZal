/* Docxzal logo intro — plays once per browser tab, then from the logo. */
(function () {
  "use strict";
  const layer = document.getElementById("introLayer");
  if (!layer) return;

  const template = layer.outerHTML;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const force = new URLSearchParams(location.search).has("intro");
  let seen = false;
  try { seen = sessionStorage.getItem("bd_intro_seen_v1") === "1"; } catch {}

  function play(node) {
    if (!node) return;
    let finished = false;
    let removeTimer = 0;
    let autoTimer = 0;
    let hardTimer = 0;

    function onKey(e) {
      if (e.key === "Escape") finish();
    }

    function cleanup() {
      clearTimeout(autoTimer);
      clearTimeout(hardTimer);
      clearTimeout(removeTimer);
      document.removeEventListener("keydown", onKey);
    }

    function finish() {
      if (finished) return;
      finished = true;
      cleanup();
      node.classList.add("is-leaving");
      removeTimer = setTimeout(() => node.remove(), 520);
    }

    node.addEventListener("click", finish);
    document.addEventListener("keydown", onKey);
    autoTimer = setTimeout(finish, 1650);
    hardTimer = setTimeout(() => { cleanup(); node.remove(); }, 2500);
  }

  if (reduce || (seen && !force)) {
    layer.remove();
  } else {
    try { sessionStorage.setItem("bd_intro_seen_v1", "1"); } catch {}
    play(layer);
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  ready(() => {
    const brand = document.querySelector(".brand");
    if (!brand) return;
    brand.title = "Replay logo animation";
    brand.setAttribute("role", "button");
    brand.tabIndex = 0;

    function replay() {
      if (reduce) return;
      const holder = document.createElement("div");
      holder.innerHTML = template;
      const fresh = holder.firstElementChild;
      if (!fresh) return;
      document.body.appendChild(fresh);
      play(fresh);
    }

    brand.addEventListener("click", replay);
    brand.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        replay();
      }
    });
  });
})();
