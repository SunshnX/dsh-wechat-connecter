// plugin-src/host/index.ts
import { randomUUID } from "crypto";
import { mkdirSync as mkdirSync4 } from "fs";
import { createRequire as createRequire2 } from "module";
import { isAbsolute, join as join7, resolve } from "path";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome as resolveDshHome2 } from "@deepseek-ai/dsh-home-paths";

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
    workspace: "",
    scheduledDelivery: true,
    autoRenameTitle: true,
    memory: { enabled: true, inject: true, layered: true, injectMaxChars: 8e3, maxBytes: 1024 * 1024, order: 0.5 },
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
      bubbleGapMs: 400,
      typingDelay: true,
      typingDelayPerCharMs: 60,
      typingDelayMaxMs: 1e4
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
    memory: { ...base.memory, ...isObj(u.memory) ? u.memory : {} },
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
  try {
    const name2 = config?.persona?.active;
    if (!name2) return "";
    return config?.persona?.cards?.[name2] ?? "";
  } catch {
    return "";
  }
}
var PERSONA_SECTION_NAME = "deployment:persona-prefix";
var PERSONA_SECTION_ORDER = 0;

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
  return text.replace(/[。.]+$/u, "");
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
  return new Promise((resolve2) => {
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
      resolve2({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve2({ code: null, stdout, stderr: String(error) });
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
  return new Promise((resolve2) => {
    const child = spawn2(
      python,
      ["-m", "pip", "install", "--upgrade", `wechatauto-replica==${WECHATAUTO_VERSION}`],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    child.stdout.on("data", (d) => onLog(d.toString().trimEnd()));
    child.stderr.on("data", (d) => onLog(d.toString().trimEnd()));
    child.on("error", (error) => {
      onLog(`[deps] \u5B89\u88C5\u5931\u8D25: ${error}`);
      resolve2({ ok: false, python, message: String(error) });
    });
    child.on("close", (code) => {
      const ok = code === 0;
      onLog(`[deps] pip install ${ok ? "\u5B8C\u6210" : `\u5931\u8D25\uFF08\u9000\u51FA\u7801 ${code}\uFF09`}`);
      resolve2({
        ok,
        python,
        message: ok ? "\u4F9D\u8D56\u5B89\u88C5\u5B8C\u6210\u3002" : `pip install \u9000\u51FA\u7801 ${code}\u3002`
      });
    });
  });
}

// plugin-src/host/memory.ts
import { appendFileSync, mkdirSync as mkdirSync3, statSync as statSync2, readFileSync as readFileSync3, writeFileSync as writeFileSync3 } from "fs";
import { dirname as dirname4, join as join6 } from "path";
import { createRequire } from "module";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

// plugin-src/host/memory-layout.js
import { readdirSync as readdirSync2 } from "fs";
import { basename, join as join5 } from "path";
function safeMemoryName(value, fallback = "memory") {
  return String(value ?? "").replace(/[\\/:*?"<>|]/g, "_").replace(/[. ]+$/g, "").slice(0, 64) || fallback;
}
function topicDescriptor(key, text) {
  let firstTitle;
  let firstBody;
  let latestEntry;
  let fence;
  let inComment = false;
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const value = line.trim();
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)?.[1];
      if (closing?.startsWith(fence)) fence = void 0;
      continue;
    }
    if (inComment || value.startsWith("<!--")) {
      inComment = !value.includes("-->");
      continue;
    }
    fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence || !value) continue;
    const heading = /^ {0,3}(#{1,6})[ \t]+(\S.*)$/.exec(line.trimEnd());
    if (heading) {
      const [, marks, title2] = heading;
      firstTitle ??= title2;
      if (marks.length === 2 && /^\d{4}-\d{2}-\d{2}(?=$|\s|[—–])/.test(title2)) {
        latestEntry = { title: title2, body: void 0 };
      }
      continue;
    }
    firstBody ??= value;
    if (latestEntry) latestEntry.body ??= value;
  }
  const title = (latestEntry?.title ?? firstTitle ?? key).slice(0, 80);
  const summaryLine = latestEntry ? latestEntry.body : firstBody;
  const summary = summaryLine ? summaryLine.trim().replace(/^[-*>]\s*/, "").replace(/\s+/g, " ").slice(0, 240) : "\uFF08\u65E0\u6458\u8981 / no summary\uFF09";
  return { key, title, summary };
}
function normalizeMemoryTopic(value) {
  const topic = String(value ?? "").trim();
  if (!topic) return "";
  const key = safeMemoryName(topic, "topic");
  return /^(core|core\.md)$/i.test(key) ? "" : key;
}
var TOPIC_INDEX_HEADING = "## \u4E3B\u9898\u8BB0\u5FC6\u7D22\u5F15 / Topic memory index";
function renderTopicIndex(topics) {
  if (!topics.length) return "";
  const rows = topics.map(({ key, title, summary }) => `- \`${key}\` \u2014 ${title}${summary === title ? "" : `\uFF1A${summary}`}`);
  return [
    TOPIC_INDEX_HEADING,
    "\u7528 memory_read \u7684 topic \u53C2\u6570\u6309\u9700\u8BFB\u53D6\u5168\u6587 / Use memory_read(topic) for full text.",
    "",
    ...rows
  ].join("\n");
}
function stripTopicIndex(text) {
  const value = String(text ?? "");
  if (!value.includes(TOPIC_INDEX_HEADING)) return { text: value, stripped: "" };
  let fence;
  let offset = 0;
  while (offset <= value.length) {
    const newline = value.indexOf("\n", offset);
    const end = newline === -1 ? value.length : newline;
    const line = value.slice(offset, end).replace(/\r$/, "");
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line)?.[1];
      if (closing?.startsWith(fence)) fence = void 0;
    } else {
      const opened = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (opened) fence = opened;
      else if (line.trim() === TOPIC_INDEX_HEADING) {
        return {
          text: value.slice(0, offset).replace(/[\s\uFEFF]+$/, ""),
          stripped: value.slice(offset)
        };
      }
    }
    if (newline === -1) break;
    offset = newline + 1;
  }
  return { text: value, stripped: "" };
}
function retainMemoryEnds(text, cap) {
  const value = String(text ?? "");
  const limit = Math.max(0, Math.floor(cap));
  if (value.length <= limit) return value;
  if (!limit) return "";
  const separator = "\n\u2026\n";
  if (limit <= separator.length) return value.slice(-limit);
  const contentCap = limit - separator.length;
  const headLength = Math.ceil(contentCap / 2);
  const tailLength = contentCap - headLength;
  return value.slice(0, headLength) + separator + (tailLength ? value.slice(-tailLength) : "");
}
function createMemoryLayout(root, readText) {
  const memoryRoot = () => typeof root === "function" ? root() : root;
  const keyOf = (scope) => safeMemoryName(scope, "global");
  const legacyFile = (scope) => join5(memoryRoot(), `${keyOf(scope)}.md`);
  const scopeDir = (scope) => join5(memoryRoot(), keyOf(scope));
  const coreFile = (scope) => join5(scopeDir(scope), "core.md");
  const topicsDir = (scope) => join5(scopeDir(scope), "topics");
  const topicFile = (scope, topic) => join5(topicsDir(scope), `${safeMemoryName(topic, "topic")}.md`);
  const listTopics = (scope) => {
    try {
      return readdirSync2(topicsDir(scope), { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).sort((a, b) => a.name.localeCompare(b.name, "en")).flatMap((entry) => {
        const file = join5(topicsDir(scope), entry.name);
        const text = readText(file);
        if (text === null) return [];
        const key = basename(entry.name, ".md");
        return [{ ...topicDescriptor(key, text), file }];
      });
    } catch {
      return [];
    }
  };
  const readLayeredScope = (scope) => {
    const primary = coreFile(scope);
    const legacy = legacyFile(scope);
    const primaryText = readText(primary);
    const legacyText = primaryText === null ? readText(legacy) : null;
    const topics = listTopics(scope);
    const body = stripTopicIndex(primaryText ?? legacyText ?? "");
    return {
      exists: primaryText !== null || legacyText !== null || topics.length > 0,
      text: body.text,
      embeddedIndex: body.stripped,
      source: scope,
      file: primaryText !== null ? primary : legacyText !== null ? legacy : primary,
      topics,
      index: renderTopicIndex(topics),
      inheritedLegacy: primaryText === null && legacyText !== null
    };
  };
  const readChain = (scopes, { layered = false, topic = "" } = {}) => {
    topic = normalizeMemoryTopic(topic);
    const chain = [...new Set(scopes)];
    if (!layered) {
      for (const scope3 of chain) {
        const file = legacyFile(scope3);
        const text = readText(file);
        if (text !== null) return { exists: true, text, source: scope3, file, topics: [], index: "" };
      }
      const scope2 = chain[0] ?? "global";
      return { exists: false, text: "", source: scope2, file: legacyFile(scope2), topics: [], index: "" };
    }
    if (topic) {
      const key = safeMemoryName(topic, "topic");
      for (const scope3 of chain) {
        const file = topicFile(scope3, key);
        const text = readText(file);
        if (text !== null) return { exists: true, text, source: scope3, file, topic: key, topics: [], index: "" };
      }
      const scope2 = chain[0] ?? "global";
      return { exists: false, text: "", source: scope2, file: topicFile(scope2, key), topic: key, topics: [], index: "" };
    }
    for (const scope2 of chain) {
      const value = readLayeredScope(scope2);
      if (value.exists) return value;
    }
    const scope = chain[0] ?? "global";
    return readLayeredScope(scope);
  };
  const writeTarget = (scope, { layered = false, topic = "" } = {}) => {
    topic = normalizeMemoryTopic(topic);
    if (!layered) return { file: legacyFile(scope), legacySeed: null, topic: "" };
    if (topic) {
      const key = safeMemoryName(topic, "topic");
      return { file: topicFile(scope, key), legacySeed: null, topic: key };
    }
    return { file: coreFile(scope), legacySeed: legacyFile(scope), topic: "" };
  };
  return { coreFile, legacyFile, listTopics, readChain, readLayeredScope, scopeDir, topicFile, writeTarget };
}

// plugin-src/host/memory.ts
var require2 = createRequire(import.meta.url);
var DEFAULT_MEMORY_CONFIG = {
  enabled: true,
  inject: true,
  layered: true,
  injectMaxChars: 8e3,
  maxBytes: 1024 * 1024,
  order: 0.5
};
function scopeOf(agent) {
  try {
    const header = agent?.session?.header;
    return "global";
  } catch {
    return "global";
  }
}
function installMemory(ctx, getConfig, logger = {}) {
  const say = (s) => logger.info?.(s);
  const warn = (s) => logger.warn?.(s);
  let defineTool = null;
  try {
    defineTool = require2("@deepseek-ai/dsh-tools").defineTool;
  } catch (error) {
    warn(`[memory] dsh-tools \u4E0D\u53EF\u7528\uFF0C\u8BB0\u5FC6\u5DE5\u5177\u672A\u6CE8\u518C: ${String(error)}`);
  }
  const memoryDir = () => join6(resolveDshHome(), "dsh-wechat-connecter", "memory");
  const fileCache = /* @__PURE__ */ new Map();
  const readCached = (file) => {
    try {
      const st = statSync2(file);
      const hit = fileCache.get(file);
      if (hit && hit.mtimeMs === st.mtimeMs) return hit.text;
      const text = readFileSync3(file, "utf8");
      fileCache.set(file, { mtimeMs: st.mtimeMs, text });
      return text;
    } catch {
      return null;
    }
  };
  const layout = createMemoryLayout(memoryDir, readCached);
  const cfg = () => ({ ...DEFAULT_MEMORY_CONFIG, ...getConfig() ?? {} });
  const layered = () => cfg().layered !== false;
  const byteLen = (s) => Buffer.byteLength(s, "utf8");
  const ensureParent = (f) => {
    mkdirSync3(dirname4(f), { recursive: true });
  };
  const scopes = () => ["global"];
  const target = (topic = "") => layout.writeTarget("global", { layered: layered(), topic });
  const readChain = (topic = "") => layout.readChain(scopes(), { layered: layered(), topic });
  const sectionDisposer = ctx.systemPrompt?.section?.({
    name: "soul:memory",
    order: cfg().order,
    text: (_assembly) => {
      const c = cfg();
      if (!c.enabled || !c.inject) return "";
      try {
        const { text, index } = readChain();
        if (!text && !index) return "";
        const rendered = [text, index].filter(Boolean).join("\n\n");
        const cap = c.injectMaxChars;
        if (rendered.length <= cap) return rendered;
        return retainMemoryEnds(rendered, cap) + "\n\n> \u90E8\u5206\u8BB0\u5FC6\u672A\u6CE8\u5165\uFF0C\u8BF7\u7528 memory_read \u8BFB\u53D6\u5168\u6587 / part omitted; use memory_read.";
      } catch (error) {
        warn(`[memory] \u6CE8\u5165\u5931\u8D25: ${String(error)}`);
        return "";
      }
    },
    interpolate: false
  });
  const toolDisposers = [];
  const register = (opts) => {
    try {
      const d = ctx.tools.register(defineTool(opts));
      if (typeof d === "function") toolDisposers.push(d);
    } catch (error) {
      warn(`[memory] \u6CE8\u518C\u5DE5\u5177 ${opts.name} \u5931\u8D25: ${String(error)}`);
    }
  };
  if (defineTool && ctx.tools?.register) {
    const renderText = (text) => [{ type: "text", text }];
    register({
      name: "memory_read",
      description: "\u8BFB\u53D6\u957F\u671F\u8BB0\u5FC6\u3002\u4E0D\u5E26 topic \u8BFB\u53D6\u6838\u5FC3\u8BB0\u5FC6\u4E0E\u4E3B\u9898\u7D22\u5F15\uFF1B\u5E26 topic \u8BFB\u53D6\u8BE5\u4E3B\u9898\u5168\u6587\u3002",
      parameters: { topic: { type: "string", description: "\u53EF\u9009\u4E3B\u9898 key\uFF08\u5982 work\u3001family\uFF09" } },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            exists: { type: "boolean" },
            content: { type: "string" },
            index: { type: "string" },
            scope: { type: "string" },
            topic: { type: "string" }
          }
        },
        render: (_args, value) => [
          { type: "text", text: value.exists ? value.content : "\u8BB0\u5FC6\u4E3A\u7A7A / Memory is empty." }
        ]
      },
      isConcurrencySafe: () => true,
      async execute(args) {
        const t = normalizeMemoryTopic(args?.topic);
        const { exists, text, index } = readChain(t);
        return {
          exists: Boolean(exists),
          content: text ?? "",
          index: index ?? "",
          scope: scopeOf(null),
          topic: t
        };
      }
    });
    register({
      name: "memory_append",
      description: "\u5411\u957F\u671F\u8BB0\u5FC6\u8FFD\u52A0\u4E00\u6761\u5E26\u65E5\u671F\u7684\u8BB0\u5F55\u3002\u53EF\u6307\u5B9A topic \u5199\u5165\u4E3B\u9898\u6587\u4EF6\u3002",
      parameters: {
        section: { type: "string", required: true, description: "\u5C0F\u8282\u6807\u9898/\u4E3B\u9898\u6982\u8981" },
        content: { type: "string", required: true, description: "\u8981\u8BB0\u4F4F\u7684\u5185\u5BB9\uFF08Markdown\uFF09" },
        topic: { type: "string", description: "\u53EF\u9009\u4E3B\u9898 key" }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            bytes: { type: "integer" },
            topic: { type: "string" }
          }
        },
        render: (_args, value) => renderText(value.ok ? `\u5DF2\u5199\u5165\u8BB0\u5FC6\uFF08${value.bytes} \u5B57\u8282\uFF09` : "\u5199\u5165\u5931\u8D25")
      },
      isConcurrencySafe: () => false,
      async execute(args) {
        if (!cfg().enabled) throw new Error("\u8BB0\u5FC6\u529F\u80FD\u5DF2\u5173\u95ED");
        const content = String(args?.content ?? "").trim();
        if (!content) throw new Error("memory_append: content \u4E0D\u80FD\u4E3A\u7A7A");
        const t = normalizeMemoryTopic(args?.topic);
        const d = /* @__PURE__ */ new Date();
        const p = (n) => String(n).padStart(2, "0");
        const heading = `## ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}${args?.section ? ` \u2014 ${String(args.section).trim()}` : ""}`;
        const block = `
${heading}

${content}
`;
        const dest = target(t);
        const current = readCached(dest.file) ?? "";
        const existing = layered() && !t ? stripTopicIndex(current).text : current;
        if (byteLen(existing + block) > cfg().maxBytes) {
          throw new Error("\u8BB0\u5FC6\u6587\u4EF6\u8D85\u8FC7 maxBytes \u4E0A\u9650\uFF0C\u8BF7\u5148\u7528 memory_rewrite \u6574\u7406");
        }
        ensureParent(dest.file);
        appendFileSync(dest.file, block, "utf8");
        fileCache.delete(dest.file);
        say(`\u8BB0\u5FC6\u5DF2\u8FFD\u52A0\uFF1A${dest.file}`);
        return { ok: true, bytes: byteLen(block), topic: t };
      }
    });
    register({
      name: "memory_rewrite",
      description: "\u7528\u65B0\u5185\u5BB9\u6574\u4F53\u66FF\u6362\u8BB0\u5FC6\u6587\u4EF6\uFF08core \u6216\u6307\u5B9A topic\uFF09\uFF0C\u7528\u4E8E\u6574\u7406\u5408\u5E76\u3002",
      parameters: {
        content: { type: "string", required: true, description: "\u65B0\u7684\u5B8C\u6574 Markdown \u6B63\u6587" },
        topic: { type: "string", description: "\u53EF\u9009\u4E3B\u9898 key\uFF1B\u4E0D\u5E26\u5219\u66FF\u6362 core" }
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" }, bytes: { type: "integer" }, topic: { type: "string" } }
        },
        render: (_args, value) => renderText(value.ok ? `\u5DF2\u91CD\u5199\u8BB0\u5FC6\uFF08${value.bytes} \u5B57\u8282\uFF09` : "\u91CD\u5199\u5931\u8D25")
      },
      isConcurrencySafe: () => false,
      async execute(args) {
        if (!cfg().enabled) throw new Error("\u8BB0\u5FC6\u529F\u80FD\u5DF2\u5173\u95ED");
        const t = normalizeMemoryTopic(args?.topic);
        const body = layered() && !t ? stripTopicIndex(String(args?.content ?? "")).text : String(args?.content ?? "");
        if (byteLen(body) > cfg().maxBytes) throw new Error("\u5185\u5BB9\u8D85\u8FC7 maxBytes \u4E0A\u9650");
        const dest = target(t);
        ensureParent(dest.file);
        writeFileSync3(dest.file, body, "utf8");
        fileCache.delete(dest.file);
        say(`\u8BB0\u5FC6\u5DF2\u91CD\u5199\uFF1A${dest.file}`);
        return { ok: true, bytes: byteLen(body), topic: t };
      }
    });
  }
  return {
    close() {
      try {
        sectionDisposer?.();
      } catch {
      }
      for (const d of toolDisposers) {
        try {
          d();
        } catch {
        }
      }
    },
    /** 供 RPC 查询记忆目录与大小。 */
    info() {
      return { dir: memoryDir(), layered: layered() };
    }
  };
}

// plugin-src/host/index.ts
var require3 = createRequire2(import.meta.url);
var PLUGIN_VERSION = require3("../package.json").version ?? "0.0.0";
var name = "dsh-wechat-connecter";
var inject = ["connection", "sessionTitle", "systemPrompt", "tools"];
var Config = z.object({
  enabled: z.boolean().default(false),
  autoStart: z.boolean().default(false),
  sendMode: z.union([z.const("front"), z.const("bg"), z.const("auto")]).default("auto"),
  pythonPath: z.string().default(""),
  pollInterval: z.number().default(0.5),
  botName: z.string().default(""),
  workspace: z.string().default(""),
  scheduledDelivery: z.boolean().default(true),
  autoRenameTitle: z.boolean().default(true),
  memory: z.object({
    enabled: z.boolean().default(true),
    inject: z.boolean().default(true),
    layered: z.boolean().default(true),
    injectMaxChars: z.number().default(8e3),
    maxBytes: z.number().default(1024 * 1024),
    order: z.number().default(0.5)
  }).default({
    enabled: true,
    inject: true,
    layered: true,
    injectMaxChars: 8e3,
    maxBytes: 1024 * 1024,
    order: 0.5
  }),
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
    bubbleGapMs: z.number().default(400),
    typingDelay: z.boolean().default(true),
    typingDelayPerCharMs: z.number().default(60),
    typingDelayMaxMs: z.number().default(1e4)
  }).default({
    splitLongReply: true,
    maxBubbleChars: 120,
    stripTrailingPunct: true,
    dedupeRepeat: true,
    bubbleGapMs: 400,
    typingDelay: true,
    typingDelayPerCharMs: 60,
    typingDelayMaxMs: 1e4
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
  const dataDir = join7(resolveDshHome2(), name);
  const defaultWorkspaceDir = join7(dataDir, "workspace");
  mkdirSync4(dataDir, { recursive: true });
  mkdirSync4(defaultWorkspaceDir, { recursive: true });
  const store = createConfigStore(dataDir);
  const sessionMap = createSessionMapStore(dataDir);
  let memoryHandle = null;
  function refreshMemory() {
    try {
      memoryHandle?.close();
      memoryHandle = installMemory(ctx, () => store.config.memory, {
        info: (s) => logger.info?.(s),
        warn: (s) => logger.warn?.(s)
      });
    } catch (error) {
      logger.warn(`[${name}] \u8BB0\u5FC6\u529F\u80FD\u521D\u59CB\u5316\u5931\u8D25\uFF08\u5DF2\u9694\u79BB\uFF09: ${String(error)}`);
      memoryHandle = null;
    }
  }
  refreshMemory();
  function resolveWorkspace() {
    const custom = (store.config.workspace ?? "").trim();
    return custom && isAbsolute(custom) ? resolve(custom) : defaultWorkspaceDir;
  }
  const bridge = new BridgeProcess(store.config);
  const handles = /* @__PURE__ */ new Map();
  const peerQueues = /* @__PURE__ */ new Map();
  const inFlightPeers = /* @__PURE__ */ new Set();
  const lastReplied = /* @__PURE__ */ new Map();
  let depsInstalling = false;
  let depsResult = null;
  const log = (level, text) => bridge.log(level, text);
  const truncate = (text, max = 120) => text.length > max ? `${text.slice(0, max)}\u2026` : text;
  const setup = (agentCtx) => {
    try {
      const text = activePersonaText(store.config);
      if (!text) return;
      const sp = agentCtx?.systemPrompt ?? agentCtx?.get?.("systemPrompt");
      if (!sp || typeof sp.section !== "function") {
        logger.warn(`[${name}] systemPrompt \u670D\u52A1\u4E0D\u53EF\u7528\uFF0C\u8DF3\u8FC7\u4EBA\u8BBE\u6CE8\u5165`);
        return;
      }
      try {
        sp.section({ name: PERSONA_SECTION_NAME, order: PERSONA_SECTION_ORDER, text, interpolate: false });
      } catch (prefixError) {
        logger.warn(`[${name}] \u4EBA\u8BBE\u4E13\u7528\u69FD\u4F4D\u6CE8\u518C\u5931\u8D25\uFF0C\u56DE\u9000\u72EC\u7ACB\u69FD\u4F4D: ${String(prefixError)}`);
        try {
          sp.section({ name: "wechat-persona", order: 1, text, interpolate: false });
        } catch (fallbackError) {
          logger.warn(`[${name}] \u4EBA\u8BBE\u56DE\u9000\u69FD\u4F4D\u4E5F\u5931\u8D25: ${String(fallbackError)}`);
        }
      }
    } catch (error) {
      logger.warn(`[${name}] \u4EBA\u8BBE\u6CE8\u5165\u5F02\u5E38\uFF08\u5DF2\u9694\u79BB\uFF09: ${String(error)}`);
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
  const TITLE_PREFIX = "\u5FAE\u4FE1 \xB7 ";
  function currentSessionTitle(session) {
    try {
      const events = typeof session?.snapshotEvents === "function" ? session.snapshotEvents() : session?.events;
      if (!Array.isArray(events)) return "";
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const ev = events[i];
        if (ev?.type === "session/title" && typeof ev?.data?.title === "string") {
          return ev.data.title;
        }
      }
    } catch {
    }
    return "";
  }
  function applySessionTitle(agent, peer, peerType, displayName) {
    if (!store.config.autoRenameTitle) return;
    try {
      const session = agent?.session;
      if (!session) return;
      const raw = String(displayName || "").trim();
      const label = raw && raw !== peer ? raw : peerType === "group" ? "\u5FAE\u4FE1\u7FA4" : "\u5FAE\u4FE1\u597D\u53CB";
      const title = `${TITLE_PREFIX}${label}`.slice(0, 80);
      if (currentSessionTitle(session) === title) return;
      const titleSvc = ctx.sessionTitle;
      if (titleSvc && typeof titleSvc.rename === "function") {
        titleSvc.rename(session, title);
      } else if (typeof session.append === "function") {
        session.append("session/title", {
          title,
          messageSeqs: [],
          source: { kind: "user" }
        });
      } else {
        return;
      }
      log("info", `\u4F1A\u8BDD\u6807\u9898\uFF1A${title}`);
    } catch (error) {
      logger.warn(`[${name}] \u8BBE\u7F6E\u4F1A\u8BDD\u6807\u9898\u5931\u8D25 (${peer}): ${String(error)}`);
    }
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
    const cwd = resolveWorkspace();
    mkdirSync4(cwd, { recursive: true });
    const handle = await agents.create({
      sessionId,
      meta: { cwd },
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
    return new Promise((resolve2, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve2(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function sendBubbles(peer, replyText, inboundText, tag = "\u56DE\u590D") {
    const bubbles = humanizeReply(store.config, replyText, inboundText);
    for (const bubble of bubbles) {
      if (store.config.humanize.typingDelay) {
        const chars = [...bubble].length;
        const delay = Math.min(
          chars * store.config.humanize.typingDelayPerCharMs,
          store.config.humanize.typingDelayMaxMs
        );
        if (delay > 0) await sleep(delay);
      }
      bridge.sendText(peer, bubble);
      log("info", `${tag} ${peer}\uFF1A${truncate(bubble)}`);
      if (store.config.humanize.bubbleGapMs > 0) await sleep(store.config.humanize.bubbleGapMs);
    }
    lastReplied.set(peer, Date.now());
    sessionMap.touch(peer);
  }
  const scheduleTurns = /* @__PURE__ */ new Map();
  const scheduleAnswers = /* @__PURE__ */ new Map();
  const openTurns = /* @__PURE__ */ new Map();
  function peerOfSession(sessionId) {
    for (const { peer, binding } of sessionMap.list()) {
      if (binding.sessionId === sessionId) return peer;
    }
    return void 0;
  }
  function onSessionEvent(session, event) {
    if (!store.config.scheduledDelivery) return;
    const type = event?.type;
    if (type !== "turn/start" && type !== "user/message" && type !== "assistant/message" && type !== "turn/end") {
      return;
    }
    try {
      const sessionId = String(session?.id ?? "");
      if (!sessionId) return;
      const peer = peerOfSession(sessionId);
      if (!peer) return;
      const data = event?.data ?? {};
      if (type === "turn/start") {
        const turn2 = Number(data?.turn);
        if (Number.isFinite(turn2)) openTurns.set(sessionId, turn2);
        return;
      }
      if (type === "user/message") {
        if (data?.source?.kind !== "schedule") return;
        const turn2 = Number(data?.turn ?? openTurns.get(sessionId));
        if (!Number.isFinite(turn2)) return;
        let set2 = scheduleTurns.get(sessionId);
        if (!set2) {
          set2 = /* @__PURE__ */ new Set();
          scheduleTurns.set(sessionId, set2);
        }
        set2.add(turn2);
        log("info", `\u68C0\u6D4B\u5230\u5B9A\u65F6\u4EFB\u52A1\u89E6\u53D1\uFF08${peer}\uFF09\uFF0C\u7B49\u5F85 agent \u56DE\u590D\u2026`);
        return;
      }
      if (type === "assistant/message") {
        const turn2 = Number(data?.turn);
        if (!scheduleTurns.get(sessionId)?.has(turn2)) return;
        const text2 = (data?.message?.content ?? []).filter((b) => b?.type === "text").map((b) => b.text).join("\n").trim();
        if (text2) scheduleAnswers.set(`${sessionId}:${turn2}`, text2);
        return;
      }
      const turn = Number(data?.turn);
      if (openTurns.get(sessionId) === turn) openTurns.delete(sessionId);
      const set = scheduleTurns.get(sessionId);
      if (!set?.has(turn)) return;
      set.delete(turn);
      if (set.size === 0) scheduleTurns.delete(sessionId);
      const key = `${sessionId}:${turn}`;
      const text = scheduleAnswers.get(key) ?? "";
      scheduleAnswers.delete(key);
      const reason = typeof data?.reason === "string" ? data.reason : data?.reason?.kind;
      if (reason !== "completed" || !text) return;
      void sendBubbles(peer, text, "", "\u5B9A\u65F6\u6295\u9012").catch(
        (error) => logger.warn(`[${name}] \u5B9A\u65F6\u6295\u9012\u5931\u8D25 (${peer}): ${String(error)}`)
      );
    } catch (error) {
      logger.warn(`[${name}] \u5904\u7406 session/event \u5931\u8D25: ${String(error)}`);
    }
  }
  async function processMessage(peer, peerType, msg) {
    try {
      const agent = await getOrCreateAgent(peer, peerType, msg.displayName);
      applySessionTitle(agent, peer, peerType, msg.displayName);
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
      applySessionTitle(agent, peer, peerType, msg.displayName);
      if (assistantCount(agent) <= before) return;
      const replyText = extractLastAssistantText(agent);
      if (!replyText) return;
      await sendBubbles(peer, replyText, msg.content);
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
    inFlightPeers.add(peer);
    const next = prev.then(() => processMessage(peer, peerType, msg)).catch(() => void 0).then(() => {
      if (peerQueues.get(peer) === next) inFlightPeers.delete(peer);
    });
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
          const patch = payload?.patch ?? {};
          if ("workspace" in patch) {
            const w = String(patch.workspace ?? "").trim();
            if (w && !isAbsolute(w)) return fail("workspace-not-absolute", "\u5DE5\u4F5C\u533A\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u6216\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u76EE\u5F55\u3002");
          }
          const next = store.patch(patch);
          if ("memory" in patch) refreshMemory();
          return { ok: true, value: next };
        }
        case "workspace.info": {
          return {
            ok: true,
            value: {
              custom: (store.config.workspace ?? "").trim(),
              effective: resolveWorkspace(),
              default: defaultWorkspaceDir
            }
          };
        }
        case "workspace.set": {
          const w = String(payload?.workspace ?? "").trim();
          if (w && !isAbsolute(w)) return fail("workspace-not-absolute", "\u5DE5\u4F5C\u533A\u5FC5\u987B\u662F\u7EDD\u5BF9\u8DEF\u5F84\uFF0C\u6216\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4\u76EE\u5F55\u3002");
          if (w) {
            try {
              mkdirSync4(resolve(w), { recursive: true });
            } catch (error) {
              return fail("workspace-create-failed", `\u65E0\u6CD5\u521B\u5EFA\u76EE\u5F55 ${w}\uFF1A${String(error)}`);
            }
          }
          store.patch({ workspace: w });
          return {
            ok: true,
            value: {
              custom: w,
              effective: resolveWorkspace(),
              default: defaultWorkspaceDir
            }
          };
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
        case "sessions.clearMemory": {
          const peer = String(payload?.peer ?? "");
          if (!peer) return fail("bad-request", "\u7F3A\u5C11\u5BF9\u7AEF peer\u3002");
          if (inFlightPeers.has(peer)) {
            return fail("peer-busy", "\u8BE5\u5BF9\u8BDD\u6B63\u5728\u751F\u6210\u56DE\u590D\uFF0C\u8BF7\u7B49\u56DE\u590D\u7ED3\u675F\u540E\u518D\u6E05\u7A7A\u3002");
          }
          const binding = sessionMap.get(peer);
          if (!binding) return fail("no-binding", "\u8BE5\u5BF9\u7AEF\u6CA1\u6709\u53EF\u6E05\u7A7A\u7684\u4F1A\u8BDD\u7ED1\u5B9A\u3002");
          const handle = handles.get(peer);
          if (handle) {
            void handle.dispose().catch(() => void 0);
            handles.delete(peer);
          }
          sessionMap.remove(peer);
          const sid = binding.sessionId;
          scheduleTurns.delete(sid);
          openTurns.delete(sid);
          for (const key of [...scheduleAnswers.keys()]) {
            if (key.startsWith(`${sid}:`)) scheduleAnswers.delete(key);
          }
          lastReplied.delete(peer);
          peerQueues.delete(peer);
          log("info", `\u5DF2\u6E05\u7A7A ${peer} \u7684\u4F1A\u8BDD\u8BB0\u5FC6\uFF0C\u4E0B\u6B21\u6D88\u606F\u5C06\u4F7F\u7528\u5168\u65B0\u4F1A\u8BDD`);
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
  try {
    if (typeof ctx.on === "function") {
      const dispose = ctx.on("session/event", onSessionEvent, { global: true });
      if (typeof dispose === "function") {
        const prev = rpcDispose;
        rpcDispose = async () => {
          dispose();
          await prev?.();
        };
      }
      logger.info(`[${name}] \u5B9A\u65F6\u4EFB\u52A1\u6295\u9012\u5DF2\u542F\u7528\uFF08\u76D1\u542C session/event\uFF09`);
    } else {
      logger.warn(`[${name}] ctx.on \u4E0D\u53EF\u7528\uFF0C\u5B9A\u65F6\u4EFB\u52A1\u6295\u9012\u65E0\u6CD5\u542F\u7528\u3002`);
    }
  } catch (error) {
    logger.warn(`[${name}] \u8BA2\u9605 session/event \u5931\u8D25: ${String(error)}`);
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
      peerQueues.clear();
      inFlightPeers.clear();
      sessionMap.flush();
      memoryHandle?.close();
    };
  }, `${name}.lifecycle()`);
}
export {
  Config,
  apply,
  inject,
  name
};
