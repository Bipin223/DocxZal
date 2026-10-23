import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, "www");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = ["app.js", "author.jpg", "favicon.svg", "index.html", "intro.js", "native.js", "styles.css"];
for (const file of files) cpSync(join(root, file), join(out, file));

for (const dir of ["fonts", "vendor"]) {
  cpSync(join(root, dir), join(out, dir), { recursive: true });
}

console.log(`Built www/ from ${files.length} files plus fonts/ and vendor/`);
