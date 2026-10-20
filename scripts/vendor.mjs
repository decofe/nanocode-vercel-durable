import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const source = process.env.NANOCODE_WASM_DIR ?? "../nanocode-wasm";
const git = (...args) => execFileSync("git", ["-C", source, ...args], { encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error(`${source} has uncommitted changes: commit them before vendoring its revision`);
execFileSync("npm", ["--prefix", source, "run", "build"], { stdio: "inherit" });
const target = "vendor/nanocode-wasm";
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const file of readdirSync(join(source, "src")).filter(file => file.endsWith(".ts"))) copyFileSync(join(source, "src", file), join(target, file));
for (const file of ["LICENSE-MIT", "LICENSE-APACHE"]) copyFileSync(join(source, file), join(target, file));
copyFileSync(join(source, "dist/nanocode_wasm.wasm"), join(target, "nanocode_wasm.wasm"));
const wasm = readFileSync(join(target, "nanocode_wasm.wasm"));
writeFileSync("wasm-revision.json", JSON.stringify({
  repository: "https://github.com/gakonst/nanocode-wasm",
  revision: git("rev-parse", "HEAD"),
  sdk: JSON.parse(readFileSync(join(source, "sdk-revision.json"), "utf8")),
  wasm_bytes: wasm.byteLength,
  wasm_sha256: createHash("sha256").update(wasm).digest("hex"),
}, null, 2) + "\n");
