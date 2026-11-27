import { defineConfig } from "tsup";

// Host half: bundle the plugin entry into a single ESM file.
// All @deepseek-ai/* packages are provided by the DSH host at runtime,
// so they stay external. Node built-ins are always external.
export default defineConfig({
  entry: { index: "plugin-src/host/index.ts" },
  outDir: "lib",
  format: ["esm"],
  platform: "node",
  target: "node22",
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  dts: false,
  clean: false,
  external: [/^@deepseek-ai\//, /^node:/],
  outExtension: () => ({ js: ".js" }),
});
