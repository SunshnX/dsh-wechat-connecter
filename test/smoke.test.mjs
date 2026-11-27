import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("host bundle exports the DSH plugin contract", async () => {
  const mod = await import("../lib/index.js");
  assert.equal(typeof mod.name, "string");
  assert.ok(mod.name.length > 0);
  assert.ok(Array.isArray(mod.inject));
  assert.equal(typeof mod.apply, "function");
  assert.ok(mod.Config, "Config schema should be exported");
});

test("client bundle registers via ModuleLoader", () => {
  const src = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
  assert.ok(src.includes("__ModuleLoader__.load"));
  assert.ok(src.includes("settings.section"));
  assert.ok(src.includes("dsh-wechat-connecter/management"));
});
