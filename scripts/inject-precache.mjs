// Après `vite build` : liste tous les fichiers de dist/ et les injecte dans dist/sw.js pour le mode hors-ligne.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const DIST = path.resolve("dist");
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
  const full = path.join(d, f.name);
  if (f.isDirectory()) walk(full);
  else if (f.name !== "sw.js" && !f.name.endsWith(".map")) files.push(path.relative(DIST, full).split(path.sep).join("/"));
} })(DIST);
files.sort();
const h = crypto.createHash("sha1");
for (const f of files) { h.update(f); h.update(fs.readFileSync(path.join(DIST, f))); }
const version = h.digest("hex").slice(0, 10);
const list = ["./", ...files.map((f) => "./" + f)];
const swPath = path.join(DIST, "sw.js");
fs.writeFileSync(swPath, `self.__PRECACHE__=${JSON.stringify(list)};self.__VERSION__="${version}";\n` + fs.readFileSync(swPath, "utf8"));
console.log(`precache: ${list.length} fichiers, version ${version}`);
