import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MODULE = Symbol.for("nanocode-vercel-durable//module");

export function nanocodeModule(): Promise<WebAssembly.Module> {
  const scope = globalThis as { [MODULE]?: Promise<WebAssembly.Module> };
  scope[MODULE] ??= readFile(join(process.cwd(), "vendor", "nanocode-wasm", "nanocode_wasm.wasm"))
    .then(bytes => WebAssembly.compile(bytes))
    .catch(error => {
      scope[MODULE] = undefined;
      throw error;
    });
  return scope[MODULE];
}
