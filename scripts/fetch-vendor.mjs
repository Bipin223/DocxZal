import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const vendor = join(root, "vendor");
const fonts = join(root, "fonts");

const assets = [
  ["https://cdn.jsdelivr.net/npm/marked@18.1.1/lib/marked.umd.js", "vendor/marked/marked.umd.js"],
  ["https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css", "vendor/katex/katex.min.css"],
  ["https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js", "vendor/katex/katex.min.js"],
  ["https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js", "vendor/katex/contrib/auto-render.min.js"],
  ["https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js", "vendor/docx/index.umd.js"],
  ["https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "vendor/jszip/jszip.min.js"],
  ["https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js", "vendor/pptxgenjs/pptxgen.bundle.js"],
  ["https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js", "vendor/file-saver/FileSaver.min.js"],
  ["https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", "vendor/html2canvas/html2canvas.min.js"],
  ["https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js", "vendor/jspdf/jspdf.umd.min.js"]
];

const poppins = [400, 500, 600, 700];

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function save(path, data) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
}

for (const [url, path] of assets) {
  console.log(`fetch ${url}`);
  save(path, await download(url));
}

const katexCss = await download(assets[1][0]);
const fontPaths = [...katexCss.toString("utf8").matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)].map(m => m[1]);
for (const fontPath of new Set(fontPaths)) {
  const url = `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/${fontPath}`;
  console.log(`fetch ${url}`);
  save(`vendor/katex/${fontPath}`, await download(url));
}

let poppinsCss = "";
for (const weight of poppins) {
  const file = `poppins-latin-${weight}-normal.woff2`;
  const url = `https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.3.0/files/${file}`;
  console.log(`fetch ${url}`);
  save(`fonts/${file}`, await download(url));
  poppinsCss += `@font-face{font-family:Poppins;font-style:normal;font-display:swap;font-weight:${weight};src:url(./${file}) format("woff2")}\n`;
}
save("fonts/poppins.css", poppinsCss);

console.log(`Done. ${fontPaths.length} KaTeX fonts, ${poppins.length} Poppins weights.`);
