// Build the browser half (client card) into lib/client.js.
// react / react-dom are provided by the DSH host renderer at runtime.
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outfile = resolve(root, "lib/client.js");
const loaderId = process.env.DSH_WECHAT_CLIENT_ID ?? "dsh-wechat-connecter";

const result = await build({
  entryPoints: [resolve(root, "plugin-src/client/index.tsx")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["chrome100"],
  external: ["react", "react-dom", "react/jsx-runtime"],
  write: false,
  minify: process.env.NODE_ENV === "production",
  legalComments: "none",
});
const bundled = result.outputFiles?.[0]?.text;
if (!bundled) throw new Error("esbuild did not produce a client bundle");

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(loaderId)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundled}
    return module.exports;
  }
});
`;
await mkdir(dirname(outfile), { recursive: true });
await writeFile(outfile, wrapped, "utf8");
console.log(`Wrote ${outfile}`);
