// plugin-src/host/index.ts
import { randomUUID } from "crypto";
import { mkdirSync as mkdirSync3 } from "fs";
import { createRequire } from "module";
import { join as join5 } from "path";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

// plugin-src/host/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
var DEFAULT_PERSONA_CARD = `# \u89D2\u8272
\u4F60\u662F\u4E00\u4E2A\u901A\u8FC7\u5FAE\u4FE1\u4E0E\u670B\u53CB\u804A\u5929\u7684 AI \u52A9\u624B\u300C\u5C0F\u9CB8\u300D\u3002\u4F60\u81EA\u7136\u3001\u771F\u8BDA\u3001\u6709\u793C\u8C8C\uFF0C\u8BF4\u8BDD\u8F7B\u677E\u53E3\u8BED\u5316\uFF0C\u5076\u5C14\u5E26\u4E00\u70B9\u4FCF\u76AE\u3002

# \u8BF4\u8BDD\u98CE\u683C
- \u7528\u7B80\u77ED\u7684\u53E3\u8BED\u53E5\u5B50\u56DE\u590D\uFF0C\u50CF\u771F\u4EBA\u53D1\u5FAE\u4FE1\u4E00\u6837\u3002
- \u4E0D\u8981\u957F\u7BC7\u5927\u8BBA\uFF0C\u4E0D\u8981\u7528 markdown \u6807\u9898\u3001\u5217\u8868\u6216\u4EE3\u7801\u5757\u3002
- \u9002\u5F53\u4F7F\u7528\u8BED\u6C14\u8BCD\u548C\u8868\u60C5\uFF0C\u4F46\u4E0D\u8981\u6BCF\u53E5\u90FD\u52A0\u3002
- \u79F0\u547C\u5BF9\u65B9\u65F6\u7528\u300C\u4F60\u300D\uFF0C\u4E0D\u8981\u7528\u300C\u7528\u6237\u300D\u3002

# \u884C\u4E3A\u51C6\u5219
- \u5C0A\u91CD\u9690\u79C1\uFF0C\u4E0D\u4E3B\u52A8\u6253\u542C\u5BF9\u65B9\u4E2A\u4EBA\u4FE1\u606F\u3002
- \u9047\u5230\u4E0D\u77E5\u9053\u7684\u4E8B\u60C5\u5766\u8BDA\u8BF4\u660E\uFF0C\u4E0D\u8981\u7F16\u9020\u3002
- \u5BF9\u65B9\u60C5\u7EEA\u4F4E\u843D\u65F6\u5148\u5B89\u629A\uFF0C\u518D\u7ED9\u5EFA\u8BAE\u3002
- \u4E0D\u4F20\u64AD\u8C23\u8A00\uFF0C\u4E0D\u8F93\u51FA\u8FDD\u6CD5\u8FDD\u89C4\u5185\u5BB9\u3002`;
function defaultConfig() {
  return {
    enabled: false,
    autoStart: false,
    sendMode: "auto",
    pythonPath: "",
    pollInterval: 0.5,
    botName: "",
    model: { provider: "", model: "" },
    private: {
      enabled: true,
      replyStrategy: "always",
      triggerWords: []
    },
    group: {
      enabled: true,
      requireAt: true,
      triggerWords: [],
      topicContinuation: false
    },
    humanize: {
      splitLongReply: true,
      maxBubbleChars: 120,
      stripTrailingPunct: true,
      dedupeRepeat: true,
      bubbleGapMs: 400
    },
    persona: {
      active: "\u5C0F\u9CB8",
      cards: {
        \u5C0F\u9CB8: DEFAULT_PERSONA_CARD
      }
    },
    github: {
      repo: "SunshnX/dsh-wechat-connecter",
      checkUpdate: false
    }
  };
}
function normalizeConfig(input) {
  const base = defaultConfig();
  if (input == null || typeof input !== "object") return base;
  const u = input;
  const merged = {
    ...base,
    ...u,
    model: { ...base.model, ...isObj(u.model) ? u.model : {} },
    private: { ...base.private, ...isObj(u.private) ? u.private : {} },
    group: { ...base.group, ...isObj(u.group) ? u.group : {} },
    humanize: { ...base.humanize, ...isObj(u.humanize) ? u.humanize : {} },
    persona: { ...base.persona, ...isObj(u.persona) ? u.persona : {} },
    github: { ...base.github, ...isObj(u.github) ? u.github : {} }
  };
  if (merged.sendMode !== "front" && merged.sendMode !== "bg" && merged.sendMode !== "auto") {
    merged.sendMode = "auto";
  }
  if (merged.private.replyStrategy !== "always" && merged.private.replyStrategy !== "mention") {
    merged.private.replyStrategy = "always";
  }
  return merged;
}
function isObj(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function createConfigStore(baseDir) {
  const configPath = join(baseDir, "config.json");
  mkdirSync(dirname(configPath), { recursive: true });
  const load = () => {
    try {
      if (existsSync(configPath)) {
        const raw = readFileSync(configPath, "utf8");
        return normalizeConfig(JSON.parse(raw));
      }
    } catch (error) {
      console.error("[dsh-wechat-connecter] failed to read config:", error);
    }
    return defaultConfig();
  };
  let config = load();
  const store = {
    get config() {
      return config;
    },
    configPath,
    reload() {
      config = load();
      return config;
    },
    save(next) {
      config = normalizeConfig(next);
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
      return config;
    },
    patch(patch) {
      const next = { ...config, ...patch };
      return store.save(next);
    }
  };
  return store;
}

// plugin-src/host/session-map.ts
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, mkdirSync as mkdirSync2, existsSync as existsSync2 } from "fs";
import { dirname as dirname2, join as join2 } from "path";
function createSessionMapStore(baseDir) {
  const statePath = join2(baseDir, "state.json");
  mkdirSync2(dirname2(statePath), { recursive: true });
  let peers = {};
  let dirty = false;
  const load = () => {
    try {
      if (existsSync2(statePath)) {
        const raw = JSON.parse(readFileSync2(statePath, "utf8"));
        if (raw && typeof raw === "object" && raw.peers && typeof raw.peers === "object") {
          peers = raw.peers;
        }
      }
    } catch (error) {
      console.error("[dsh-wechat-connecter] failed to read state:", error);
    }
  };
  const persist = () => {
    try {
      writeFileSync2(statePath, JSON.stringify({ peers }, null, 2), "utf8");
      dirty = false;
    } catch (error) {
      console.error("[dsh-wechat-connecter] failed to write state:", error);
    }
  };
  load();
  return {
    get(peer) {
      return peers[peer];
    },
    set(peer, binding) {
      peers[peer] = binding;
      dirty = true;
      persist();
    },
    remove(peer) {
      if (peer in peers) {
        delete peers[peer];
        persist();
      }
    },
    list() {
      return Object.entries(peers).map(([peer, binding]) => ({ peer, binding }));
    },
    touch(peer) {
      const binding = peers[peer];
      if (binding) {
        binding.lastSeen = Date.now();
        dirty = true;
      }
    },
    flush() {
      if (dirty) persist();
    }
  };
}

// plugin-src/host/persona.ts
function activePersonaText(config) {
  const name2 = config.persona.active;
  if (!name2) return "";
  return config.persona.cards?.[name2] ?? "";
}

// plugin-src/host/reply.ts
function shouldReply(config, meta) {
  if (meta.peerType === "group") {
    if (!config.group.enabled) return false;
    const named = meta.isAt || meta.botName && meta.content.includes(meta.botName) || config.group.triggerWords.some((word) => word && meta.content.includes(word));
    if (named) return true;
    if (config.group.topicContinuation && meta.botParticipatedRecently) return true;
    return false;
  }
  if (!config.private.enabled) return false;
  if (config.private.replyStrategy === "mention") {
    const named = meta.botName && meta.content.includes(meta.botName) || config.private.triggerWords.some((word) => word && meta.content.includes(word));
    return named;
  }
  return true;
}
var SENTENCE_END = /[。！？!?…~～\n]+/;
function stripTrailingPunct(text) {
  return text.replace(/[\s。！？!?…~～.,，、;；:：]+$/u, "");
}
function isOpenPunct(ch) {
  return `\uFF08(\u3010[\u300A\u201C"\u2018'\u300C\u300E`.includes(ch);
}
function isClosePunct(ch) {
  return `\uFF09)\u3011]\u300B\u201D"\u2019'\u300D\u300F`.includes(ch);
}
function splitIntoBubbles(text, maxChars) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const max = Math.max(20, Math.floor(maxChars) || 120);
  const segments = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    current += ch;
    if (isOpenPunct(ch)) depth += 1;
    else if (isClosePunct(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && SENTENCE_END.test(ch)) {
      const seg = current.trim();
      if (seg) segments.push(seg);
      current = "";
    }
  }
  if (current.trim()) segments.push(current.trim());
  const bubbles = [];
  for (const seg of segments) {
    if (seg.length <= max) {
      bubbles.push(seg);
      continue;
    }
    const parts = [];
    let d = 0;
    let cur = "";
    for (const ch of seg) {
      cur += ch;
      if (isOpenPunct(ch)) d += 1;
      else if (isClosePunct(ch)) d = Math.max(0, d - 1);
      if (d === 0 && "\uFF0C,\u3001;\uFF1B".includes(ch) && cur.length >= max * 0.6) {
        parts.push(cur.trim());
        cur = "";
      }
    }
    if (cur.trim()) parts.push(cur.trim());
    for (const part of parts) {
      if (part.length <= max) {
        bubbles.push(part);
      } else {
        for (let i = 0; i < part.length; i += max) {
          bubbles.push(part.slice(i, i + max));
        }
      }
    }
  }
  return bubbles.map((b) => b.trim()).filter(Boolean);
}
function normalizeForCompare(text) {
  return text.replace(/[\s，。！？!?…~～、,.;；:：'"“”‘’()（）【】\[\]]+/gu, "");
}
function humanizeReply(config, replyText, inboundText) {
  const h = config.humanize;
  let text = String(replyText ?? "").trim();
  if (!text) return [];
  if (h.dedupeRepeat) {
    const r = normalizeForCompare(text);
    const u = normalizeForCompare(inboundText);
    if (r && (r === u || u.includes(r) || r.includes(u) && r.length >= Math.min(6, u.length))) {
      if (r.length < 24) return [];
    }
  }
  let bubbles;
  if (h.splitLongReply) {
    bubbles = splitIntoBubbles(text, h.maxBubbleChars);
  } else {
    bubbles = [text];
  }
  if (h.stripTrailingPunct) {
    bubbles = bubbles.map((b) => stripTrailingPunct(b)).filter(Boolean);
  }
  const deduped = [];
  for (const bubble of bubbles) {
    if (deduped.length > 0 && deduped[deduped.length - 1] === bubble) continue;
    deduped.push(bubble);
  }
  return deduped;
}

// plugin-src/host/bridge.ts
import { spawn } from "child_process";
import { join as join3, dirname as dirname3 } from "path";
import { fileURLToPath } from "url";
var __dirname = dirname3(fileURLToPath(import.meta.url));
var MAX_LOG_LINES = 500;
var BridgeProcess = class {
  child = null;
  logs = [];
  logSeq = 0;
  _status = "stopped";
  _lastError = "";
  bridgeDir;
  config;
  onMessage = null;
  onStatusChange = null;
  onLog = null;
  constructor(config, bridgeDir) {
    this.config = config;
    this.bridgeDir = bridgeDir ?? join3(__dirname, "..", "bridge");
  }
  get status() {
    return this._status;
  }
  get lastError() {
    return this._lastError;
  }
  get logLines() {
    return this.logs;
  }
  setStatus(status) {
    if (this._status === status) return;
    this._status = status;
    this.onStatusChange?.(status);
  }
  pushLog(level, text) {
    const line = { seq: this.logSeq++, time: Date.now(), level, text };
    this.logs.push(line);
    if (this.logs.length > MAX_LOG_LINES) this.logs.splice(0, this.logs.length - MAX_LOG_LINES);
    this.onLog?.(line);
  }
  /** Append a log line to the ring buffer from host-side code. */
  log(level, text) {
    this.pushLog(level, text);
  }
  start(pythonPath) {
    if (this.child) return;
    this.setStatus("starting");
    const configJson = JSON.stringify({
      sendMode: this.config.sendMode,
      pollInterval: this.config.pollInterval,
      botName: this.config.botName,
      bridgeDir: this.bridgeDir
    });
    let child;
    try {
      child = spawn(pythonPath, [join3(this.bridgeDir, "main.py"), configJson], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false
      });
    } catch (error) {
      this._lastError = String(error);
      this.setStatus("error");
      this.pushLog("error", `\u542F\u52A8\u6865\u63A5\u5931\u8D25: ${error}`);
      return;
    }
    this.child = child;
    this.pushLog("info", `\u542F\u52A8 Python \u6865\u63A5: ${pythonPath}`);
    child.stdout?.on("data", (data) => this.handleStdout(data.toString()));
    child.stderr?.on("data", (data) => {
      for (const line of data.toString().split(/\r?\n/)) {
        if (line.trim()) this.pushLog("error", line);
      }
    });
    child.on("error", (error) => {
      this._lastError = String(error);
      this.setStatus("error");
      this.pushLog("error", `\u6865\u63A5\u8FDB\u7A0B\u9519\u8BEF: ${error}`);
    });
    child.on("close", (code) => {
      this.pushLog("info", `\u6865\u63A5\u8FDB\u7A0B\u9000\u51FA\uFF08code=${code}\uFF09`);
      this.child = null;
      this.setStatus("stopped");
    });
  }
  handleStdout(chunk) {
    for (const raw of chunk.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      this.handleEvent(line);
    }
  }
  handleEvent(line) {
    try {
      const event = JSON.parse(line);
      if (!event || typeof event.event !== "string") throw new Error("no event");
      switch (event.event) {
        case "ready":
          this.setStatus("running");
          this.pushLog("info", `\u5FAE\u4FE1\u6865\u63A5\u5C31\u7EEA\uFF1A${String(event.account ?? "")}`);
          break;
        case "message":
          this.onMessage?.(event);
          break;
        case "log":
          this.pushLog(
            ["info", "warn", "error", "debug"].includes(String(event.level)) ? event.level : "info",
            String(event.text ?? "")
          );
          break;
        case "status":
          this.pushLog("info", String(event.text ?? ""));
          break;
        default:
          this.pushLog("debug", line);
      }
    } catch {
      this.pushLog("info", line);
    }
  }
  send(command) {
    if (!this.child || !this.child.stdin || !this.child.stdin.writable) return false;
    try {
      this.child.stdin.write(JSON.stringify(command) + "\n");
      return true;
    } catch {
      return false;
    }
  }
  sendText(who, text, mode) {
    return this.send({
      type: "send",
      who,
      text,
      mode: mode ?? this.config.sendMode
    });
  }
  stop() {
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    try {
      this.send({ type: "stop" });
    } catch {
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
      }
    }, 3e3);
    child.once("close", () => clearTimeout(timer));
    try {
      child.kill();
    } catch {
    }
    this.setStatus("stopped");
  }
};

// plugin-src/host/deps.ts
import { spawn as spawn2 } from "child_process";
import { existsSync as existsSync3, readdirSync, statSync } from "fs";
import { join as join4 } from "path";
import { homedir } from "os";
var WECHATAUTO_VERSION = "1.3.0.2";
function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn2(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => stdout += d.toString());
    child.stderr.on("data", (d) => stderr += d.toString());
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 6e4);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: String(error) });
    });
  });
}
async function probePythonVersion(python) {
  const result = await runProcess(python, ["--version"], { timeoutMs: 15e3 });
  if (result.code !== 0) return null;
  const version = (result.stdout || result.stderr).trim();
  return version || null;
}
function discoverPythonCandidates() {
  const candidates = [];
  const wbRoot = join4(homedir(), ".workbuddy", "binaries", "python", "versions");
  if (existsSync3(wbRoot)) {
    try {
      const versions = readdirSync(wbRoot).map((name2) => ({ name: name2, path: join4(wbRoot, name2) })).filter((entry) => statSync(entry.path).isDirectory()).sort((a, b) => b.name.localeCompare(a.name, void 0, { numeric: true }));
      for (const version of versions) {
        const py = join4(version.path, "python.exe");
        if (existsSync3(py)) candidates.push(py);
      }
    } catch {
    }
  }
  candidates.push("python");
  return candidates;
}
async function resolvePython(config) {
  if (config.pythonPath) {
    const version = await probePythonVersion(config.pythonPath);
    if (version) return { python: config.pythonPath, version };
  }
  for (const candidate of discoverPythonCandidates()) {
    const version = await probePythonVersion(candidate);
    if (version) return { python: candidate, version };
  }
  return null;
}
async function checkDeps(config) {
  const resolved = await resolvePython(config);
  if (!resolved) {
    return {
      ok: false,
      python: "",
      pythonVersion: "",
      wechatautoInstalled: false,
      wechatautoVersion: "",
      message: "\u672A\u627E\u5230\u53EF\u7528\u7684 Python \u89E3\u91CA\u5668\uFF08\u5EFA\u8BAE Python 3.13\uFF09\u3002"
    };
  }
  const { python, version } = resolved;
  const probe = await runProcess(
    python,
    ["-c", `import wechatauto; print(getattr(wechatauto, "__version__", "?"))`],
    { timeoutMs: 3e4 }
  );
  const installed = probe.code === 0;
  const installedVersion = installed ? probe.stdout.trim() || probe.stderr.trim() : "";
  return {
    ok: installed,
    python,
    pythonVersion: version ?? "",
    wechatautoInstalled: installed,
    wechatautoVersion: installedVersion,
    message: installed ? `wechatauto ${installedVersion} \u5DF2\u5B89\u88C5\uFF08Python ${version ?? ""}\uFF09` : "wechatauto \u672A\u5B89\u88C5\u3002"
  };
}
async function installDeps(config, onLog) {
  const resolved = await resolvePython(config);
  if (!resolved) {
    return { ok: false, python: "", message: "\u672A\u627E\u5230\u53EF\u7528\u7684 Python \u89E3\u91CA\u5668\u3002" };
  }
  const { python } = resolved;
  onLog(`[deps] \u4F7F\u7528\u89E3\u91CA\u5668: ${python}`);
  onLog(`[deps] \u5B89\u88C5 wechatauto-replica==${WECHATAUTO_VERSION} \u2026`);
  return new Promise((resolve) => {
    const child = spawn2(
      python,
      ["-m", "pip", "install", "--upgrade", `wechatauto-replica==${WECHATAUTO_VERSION}`],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    child.stdout.on("data", (d) => onLog(d.toString().trimEnd()));
    child.stderr.on("data", (d) => onLog(d.toString().trimEnd()));
    child.on("error", (error) => {
      onLog(`[deps] \u5B89\u88C5\u5931\u8D25: ${error}`);
      resolve({ ok: false, python, message: String(error) });
    });
    child.on("close", (code) => {
      const ok = code === 0;
      onLog(`[deps] pip install ${ok ? "\u5B8C\u6210" : `\u5931\u8D25\uFF08\u9000\u51FA\u7801 ${code}\uFF09`}`);
      resolve({
        ok,
        python,
        message: ok ? "\u4F9D\u8D56\u5B89\u88C5\u5B8C\u6210\u3002" : `pip install \u9000\u51FA\u7801 ${code}\u3002`
      });
    });
  });
}

// plugin-src/host/index.ts
var require2 = createRequire(import.meta.url);
var PLUGIN_VERSION = require2("../package.json").version ?? "0.0.0";
var name = "dsh-wechat-connecter";
var inject = ["connection"];
var Config = z.object({
  enabled: z.boolean().default(false),
  autoStart: z.boolean().default(false),
  sendMode: z.union([z.const("front"), z.const("bg"), z.const("auto")]).default("auto"),
  pythonPath: z.string().default(""),
  pollInterval: z.number().default(0.5),
  botName: z.string().default(""),
  model: z.object({
    provider: z.string().default(""),
    model: z.string().default("")
  }).default({ provider: "", model: "" }),
  private: z.object({
    enabled: z.boolean().default(true),
    replyStrategy: z.union([z.const("always"), z.const("mention")]).default("always"),
    triggerWords: z.array(z.string()).default([])
  }).default({ enabled: true, replyStrategy: "always", triggerWords: [] }),
  group: z.object({
    enabled: z.boolean().default(true),
    requireAt: z.boolean().default(true),
    triggerWords: z.array(z.string()).default([]),
    topicContinuation: z.boolean().default(false)
  }).default({ enabled: true, requireAt: true, triggerWords: [], topicContinuation: false }),
  humanize: z.object({
    splitLongReply: z.boolean().default(true),
    maxBubbleChars: z.number().default(120),
    stripTrailingPunct: z.boolean().default(true),
    dedupeRepeat: z.boolean().default(true),
    bubbleGapMs: z.number().default(400)
  }).default({
    splitLongReply: true,
    maxBubbleChars: 120,
    stripTrailingPunct: true,
    dedupeRepeat: true,
    bubbleGapMs: 400
  }),
  persona: z.object({
    active: z.string().default("\u5C0F\u9CB8"),
    cards: z.dict(z.string(), z.string()).default({})
  }).default({ active: "\u5C0F\u9CB8", cards: {} }),
  github: z.object({
    repo: z.string().default("SunshnX/dsh-wechat-connecter"),
    checkUpdate: z.boolean().default(false)
  }).default({ repo: "SunshnX/dsh-wechat-connecter", checkUpdate: false })
}).volatile();
function apply(ctx, _config) {
  const logger = (ctx.logger ? ctx.logger(name) : null) ?? console;
  const dataDir = join5(resolveDshHome(), name);
  const workspaceDir = join5(dataDir, "workspace");
  mkdirSync3(dataDir, { recursive: true });
  mkdirSync3(workspaceDir, { recursive: true });
  const store = createConfigStore(dataDir);
  const sessionMap = createSessionMapStore(dataDir);
  const bridge = new BridgeProcess(store.config);
  const handles = /* @__PURE__ */ new Map();
  const peerQueues = /* @__PURE__ */ new Map();
  const lastReplied = /* @__PURE__ */ new Map();
  let depsInstalling = false;
  let depsResult = null;
  const log = (level, text) => bridge.log(level, text);
  const truncate = (text, max = 120) => text.length > max ? `${text.slice(0, max)}\u2026` : text;
  const setup = (agentCtx) => {
    const text = activePersonaText(store.config);
    if (!text) return;
    const sp = agentCtx?.systemPrompt ?? agentCtx?.get?.("systemPrompt");
    if (sp && typeof sp.section === "function") {
      sp.section({ name: "wechat-persona", order: 100, text, interpolate: false });
    }
  };
  function agentOptions() {
    const picked = store.config.model;
    if (picked?.provider && picked?.model) {
      return { provider: picked.provider, model: picked.model };
    }
    try {
      const defaults = ctx.get("agentDefaultModel");
      const sel = defaults?.currentSelection?.();
      if (sel && sel.provider && sel.model) {
        return {
          provider: sel.provider,
          model: sel.model,
          ...sel.reasoningEffort === void 0 ? {} : { reasoningEffort: String(sel.reasoningEffort) }
        };
      }
    } catch (error) {
      logger.warn(`[${name}] \u8BFB\u53D6\u9ED8\u8BA4\u6A21\u578B\u5931\u8D25: ${String(error)}`);
    }
    return void 0;
  }
  async function getOrCreateAgent(peer, peerType, displayName) {
    const agents = ctx.get("agents");
    const options = agentOptions();
    const existing = sessionMap.get(peer);
    if (existing) {
      const live = agents.get(existing.sessionId);
      if (live) {
        sessionMap.touch(peer);
        return live;
      }
      try {
        const handle2 = await agents.resume({
          resumeSessionId: existing.sessionId,
          agentOptions: options,
          setup
        });
        handles.set(peer, handle2);
        return handle2.agent;
      } catch (error) {
        logger.warn(`[${name}] resume ${peer} \u5931\u8D25\uFF0C\u5C06\u65B0\u5EFA\u4F1A\u8BDD: ${String(error)}`);
        sessionMap.remove(peer);
      }
    }
    const sessionId = randomUUID();
    const handle = await agents.create({
      sessionId,
      meta: { cwd: workspaceDir },
      agentOptions: options,
      setup
    });
    sessionMap.set(peer, { sessionId, peerType, displayName, lastSeen: Date.now() });
    handles.set(peer, handle);
    return handle.agent;
  }
  function extractLastAssistantText(agent) {
    try {
      const messages = agent.session.deriveMessages?.() ?? [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.role === "assistant") {
          const text = (m.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("\n").trim();
          if (text) return text;
        }
      }
    } catch (error) {
      logger.warn(`[${name}] extract reply failed: ${String(error)}`);
    }
    return "";
  }
  function assistantCount(agent) {
    try {
      const messages = agent.session.deriveMessages?.() ?? [];
      let n = 0;
      for (const m of messages) if (m?.role === "assistant") n += 1;
      return n;
    } catch {
      return 0;
    }
  }
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function processMessage(peer, peerType, msg) {
    try {
      const agent = await getOrCreateAgent(peer, peerType, msg.displayName);
      const inboundText = buildInboundText(peerType, msg);
      const before = assistantCount(agent);
      agent.followup({
        id: randomUUID(),
        role: "user",
        content: [{ type: "text", text: inboundText }],
        source: { kind: "user" }
      });
      try {
        await withTimeout(agent.whenIdle(), 18e4);
      } catch {
        logger.warn(`[${name}] ${peer} \u7B49\u5F85\u56DE\u590D\u8D85\u65F6\uFF0C\u8DF3\u8FC7\u672C\u8F6E\u53D1\u9001`);
        return;
      }
      if (assistantCount(agent) <= before) return;
      const replyText = extractLastAssistantText(agent);
      if (!replyText) return;
      const bubbles = humanizeReply(store.config, replyText, msg.content);
      for (const bubble of bubbles) {
        bridge.sendText(peer, bubble);
        log("info", `\u56DE\u590D ${peer}\uFF1A${truncate(bubble)}`);
        if (store.config.humanize.bubbleGapMs > 0) await sleep(store.config.humanize.bubbleGapMs);
      }
      lastReplied.set(peer, Date.now());
      sessionMap.touch(peer);
    } catch (error) {
      logger.error(`[${name}] \u5904\u7406\u6D88\u606F\u5931\u8D25 (${peer}): ${String(error)}`);
    }
  }
  function buildInboundText(peerType, msg) {
    if (peerType === "group") {
      const sender = msg.senderName || msg.senderId || "\u7FA4\u53CB";
      return `[\u7FA4\u804A\u6D88\u606F] ${sender} \u8BF4\uFF1A${msg.content}`;
    }
    return msg.content;
  }
  function handleInbound(msg) {
    if (!store.config.enabled) return;
    if (msg.peerType === "self" || msg.peerType === "system") return;
    if (!msg.username) return;
    const peerType = msg.peerType === "group" ? "group" : "contact";
    const peer = msg.username;
    const fromLabel = peerType === "group" ? `\u7FA4\u804A ${peer}\uFF08${msg.senderName || msg.senderId || "?"}\uFF09` : `\u79C1\u804A ${peer}`;
    log("info", `\u6536\u5230 ${fromLabel}\uFF1A${truncate(msg.content)}`);
    const meta = {
      peerType,
      content: msg.content ?? "",
      isAt: Boolean(msg.isAt),
      botName: store.config.botName,
      botParticipatedRecently: (lastReplied.get(peer) ?? 0) > Date.now() - 10 * 60 * 1e3
    };
    if (!shouldReply(store.config, meta)) return;
    const prev = peerQueues.get(peer) ?? Promise.resolve();
    const next = prev.then(() => processMessage(peer, peerType, msg)).catch(() => void 0);
    peerQueues.set(peer, next);
  }
  bridge.onMessage = handleInbound;
  async function startBridge() {
    if (bridge.status === "running" || bridge.status === "starting") {
      return { ok: true, message: "\u6865\u63A5\u5DF2\u5728\u8FD0\u884C\u3002" };
    }
    const resolved = await resolvePython(store.config);
    if (!resolved) {
      return { ok: false, message: "\u672A\u627E\u5230\u53EF\u7528\u7684 Python \u89E3\u91CA\u5668\uFF08\u5EFA\u8BAE Python 3.13\uFF09\u3002" };
    }
    const deps = await checkDeps(store.config);
    if (!deps.wechatautoInstalled) {
      logger.warn(`[${name}] \u4F9D\u8D56\u672A\u5B89\u88C5\uFF08${deps.message}\uFF09\uFF0C\u8BF7\u5148\u5B89\u88C5\u4F9D\u8D56\u3002`);
      return { ok: false, message: "wechatauto \u672A\u5B89\u88C5\uFF0C\u8BF7\u5148\u70B9\u51FB\u300C\u5B89\u88C5\u4F9D\u8D56\u300D\u3002", python: resolved.python };
    }
    bridge.start(resolved.python);
    return { ok: true, message: "\u6865\u63A5\u542F\u52A8\u4E2D\u2026", python: resolved.python };
  }
  function stopBridge() {
    bridge.stop();
    return { ok: true, message: "\u6865\u63A5\u5DF2\u505C\u6B62\u3002" };
  }
  const RPC_ENDPOINT = `${name}/management`;
  async function rpcHandle(method, payload) {
    const fail = (code, message) => ({ ok: false, error: { code, message, details: {} } });
    try {
      switch (method) {
        case "bridge.status": {
          return {
            ok: true,
            value: {
              status: bridge.status,
              lastError: bridge.lastError,
              enabled: store.config.enabled,
              depsInstalling,
              depsResult,
              config: store.config
            }
          };
        }
        case "bridge.start": {
          const result = await startBridge();
          return result.ok ? { ok: true, value: result } : fail("start-failed", result.message);
        }
        case "bridge.stop": {
          const result = stopBridge();
          return { ok: true, value: result };
        }
        case "bridge.logs": {
          const after = Number(payload?.afterSeq ?? -1);
          const logs = bridge.logLines.filter((l) => l.seq > after).slice(-200);
          return { ok: true, value: { logs, lastSeq: bridge.logLines.length ? bridge.logLines[bridge.logLines.length - 1].seq : -1 } };
        }
        case "bridge.deps.check": {
          const result = await checkDeps(store.config);
          return { ok: true, value: result };
        }
        case "bridge.deps.install": {
          if (depsInstalling) return { ok: true, value: { running: true, message: "\u4F9D\u8D56\u5B89\u88C5\u8FDB\u884C\u4E2D\u2026" } };
          depsInstalling = true;
          depsResult = null;
          void installDeps(store.config, (line) => log("info", line)).then((result) => {
            depsInstalling = false;
            depsResult = result;
          });
          return { ok: true, value: { running: true, message: "\u4F9D\u8D56\u5B89\u88C5\u5DF2\u5F00\u59CB\u3002" } };
        }
        case "config.get": {
          return { ok: true, value: store.config };
        }
        case "config.set": {
          const next = store.patch(payload?.patch ?? {});
          return { ok: true, value: next };
        }
        case "persona.save": {
          const cardName = String(payload?.name ?? "").trim();
          const content = String(payload?.content ?? "");
          if (!cardName) return fail("bad-request", "\u4EBA\u8BBE\u540D\u4E0D\u80FD\u4E3A\u7A7A\u3002");
          const cards = { ...store.config.persona.cards, [cardName]: content };
          const persona = { ...store.config.persona, cards };
          const next = store.patch({ persona });
          return { ok: true, value: next.persona };
        }
        case "persona.delete": {
          const cardName = String(payload?.name ?? "");
          const cards = { ...store.config.persona.cards };
          delete cards[cardName];
          const persona = { ...store.config.persona, cards };
          if (persona.active === cardName) persona.active = "";
          const next = store.patch({ persona });
          return { ok: true, value: next.persona };
        }
        case "persona.setActive": {
          const cardName = String(payload?.name ?? "");
          const persona = { ...store.config.persona, active: cardName };
          const next = store.patch({ persona });
          return { ok: true, value: next.persona };
        }
        case "sessions.list": {
          return { ok: true, value: sessionMap.list() };
        }
        case "sessions.unbind": {
          const peer = String(payload?.peer ?? "");
          if (peer) {
            sessionMap.remove(peer);
            const handle = handles.get(peer);
            if (handle) {
              void handle.dispose().catch(() => void 0);
              handles.delete(peer);
            }
          }
          return { ok: true, value: sessionMap.list() };
        }
        case "update.check": {
          const value = await checkForUpdate(store.config.github.repo);
          return { ok: true, value };
        }
        case "model.list": {
          const value = await listModels();
          return { ok: true, value };
        }
        default:
          return fail("unknown-method", `\u672A\u77E5\u65B9\u6CD5: ${method}`);
      }
    } catch (error) {
      return fail("internal", String(error));
    }
  }
  async function listModels() {
    const llm = ctx.get("llm");
    const providers = typeof llm?.listProviders === "function" ? llm.listProviders() : [];
    const groups = [];
    for (const p of providers) {
      try {
        const models = await llm.listModels(p.id);
        groups.push({
          id: p.id,
          name: p.name,
          models: (models ?? []).map((m) => ({ id: m.id, name: m.name }))
        });
      } catch {
        groups.push({ id: p.id, name: p.name, models: [] });
      }
    }
    let current = { provider: "", model: "" };
    try {
      const sel = ctx.get("agentDefaultModel")?.currentSelection?.();
      if (sel?.provider && sel?.model) current = { provider: sel.provider, model: sel.model };
    } catch {
    }
    return { groups, current, selected: store.config.model };
  }
  async function checkForUpdate(repo) {
    const version = PLUGIN_VERSION;
    if (!repo || !repo.includes("/")) {
      return { repo, currentVersion: version, latestVersion: null, hasUpdate: false, message: "\u672A\u914D\u7F6E GitHub \u4ED3\u5E93\u3002" };
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "dsh-wechat-connecter" }
      });
      if (!res.ok) {
        return { repo, currentVersion: version, latestVersion: null, hasUpdate: false, message: `GitHub API ${res.status}` };
      }
      const data = await res.json();
      const latest = String(data.tag_name ?? "").replace(/^v/, "");
      const hasUpdate = Boolean(latest) && latest !== version;
      return { repo, currentVersion: version, latestVersion: latest || null, hasUpdate, url: data.html_url, message: hasUpdate ? `\u53D1\u73B0\u65B0\u7248\u672C ${latest}` : "\u5DF2\u662F\u6700\u65B0\u7248\u672C\u3002" };
    } catch (error) {
      return { repo, currentVersion: version, latestVersion: null, hasUpdate: false, message: String(error) };
    }
  }
  let rpcDispose = null;
  try {
    const connection = ctx.connection ?? ctx.get?.("connection");
    if (connection?.fetch && typeof connection.fetch.register === "function") {
      rpcDispose = connection.fetch.register({
        path: `/api/${RPC_ENDPOINT}`,
        methods: ["POST"],
        requestBody: "buffered",
        async fetch(request) {
          if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
          let body;
          try {
            body = await request.json();
          } catch {
            return new Response("body is not JSON", { status: 400 });
          }
          const rpcId = typeof body?.rpcId === "string" ? body.rpcId : "invalid";
          const call = body?.payload;
          const method = call?.method;
          const payload = call?.payload;
          const result = await rpcHandle(method, payload);
          return Response.json({ type: "server-response", rpcId, result });
        }
      });
      logger.info(`[${name}] \u7BA1\u7406 RPC \u5DF2\u6CE8\u518C: /api/${RPC_ENDPOINT}`);
    } else {
      logger.warn(`[${name}] connection.fetch \u4E0D\u53EF\u7528\uFF0C\u7BA1\u7406 UI \u7684 RPC \u5C06\u65E0\u6CD5\u4F7F\u7528\u3002`);
    }
  } catch (error) {
    logger.warn(`[${name}] \u6CE8\u518C\u7BA1\u7406 RPC \u5931\u8D25: ${String(error)}`);
  }
  ctx.effect(() => {
    if (store.config.autoStart) {
      void startBridge();
    }
    return () => {
      bridge.stop();
      void rpcDispose?.();
      for (const handle of handles.values()) {
        void handle.dispose().catch(() => void 0);
      }
      handles.clear();
      sessionMap.flush();
    };
  }, `${name}.lifecycle()`);
}
export {
  Config,
  apply,
  inject,
  name
};
