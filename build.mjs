#!/usr/bin/env node
/**
 * HD2's Diary — one-command build.
 *
 *   1. runs Eleventy inside ./diary-src  (source)  ->  ./diary-src/_site
 *   2. copies that output over this repository's root, which is what GitHub
 *      Pages serves at https://hyangdan2.github.io/diary/
 *
 * The published pages therefore keep the exact same URLs as before
 * (/diary/, /diary/posts/…, /diary/categories/…, /diary/assets/…):
 * the repo root *is* the /diary/ folder.
 *
 * Usage:  node build.mjs          (or: npm run build from the repo root)
 */
import { spawnSync } from "node:child_process";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const srcDir = join(root, "diary-src");
const outDir = join(srcDir, "_site");

/** Everything in the repo root that is generated and may be replaced. */
const GENERATED = ["index.html", "posts", "categories", "en", "assets"];

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`\n✖ ${command} ${args.join(" ")} failed (exit ${result.status ?? result.signal})`);
    process.exit(result.status ?? 1);
  }
}

/** Same as run(), but reports the exit code instead of exiting. */
function tryRun(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  return result.status === 0;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(join(srcDir, "node_modules")))) {
  console.log("• diary-src/node_modules is missing — installing dependencies…");
  // npm ci is exact, but it refuses a lockfile that pins an optional package for
  // another OS (fsevents is darwin-only). Fall back to a plain install that leaves
  // the committed lockfile untouched.
  if (!tryRun("npm", ["ci", "--no-audit", "--no-fund"], srcDir)) {
    console.log("• npm ci could not run here — falling back to npm install…");
    run("npm", ["install", "--no-package-lock", "--no-audit", "--no-fund"], srcDir);
  }
}

// Eleventy writes its output but never deletes a page whose source is gone, so a
// removed post would survive in _site/ and be copied back out below. Start clean.
await rm(outDir, { recursive: true, force: true });

console.log("• building diary-src with Eleventy…");
run("npm", ["run", "build"], srcDir);

if (!(await exists(join(outDir, "index.html")))) {
  console.error(`✖ build produced no index.html in ${outDir}`);
  process.exit(1);
}

console.log("• cleaning previously published output…");
for (const entry of GENERATED) {
  await rm(join(root, entry), { recursive: true, force: true });
}

console.log("• publishing _site/ into the repository root…");
await mkdir(root, { recursive: true });
for (const entry of await readdir(outDir)) {
  await cp(join(outDir, entry), join(root, entry), { recursive: true });
}

const pages = (await readdir(join(root, "posts"), { withFileTypes: true })).filter((d) => d.isDirectory()).length;
const categories = (await readdir(join(root, "categories"), { withFileTypes: true })).filter((d) => d.isDirectory()).length;
console.log(`\n✔ done — ${pages} posts, ${categories} category pages published at the repo root`);
console.log("  https://hyangdan2.github.io/diary/");
