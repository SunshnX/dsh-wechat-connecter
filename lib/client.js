window.__ModuleLoader__.load({
  id: "dsh-wechat-connecter",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// plugin-src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var React2 = __toESM(require("react"), 1);

// plugin-src/client/api.ts
var RPC_ENDPOINT = "dsh-wechat-connecter/management";
var Api = class {
  constructor(connection) {
    this.connection = connection;
  }
  async call(method, payload = {}) {
    const result = await this.connection.rpc.call("/api", RPC_ENDPOINT, { method, payload });
    if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
      throw new Error("RPC \u54CD\u5E94\u683C\u5F0F\u9519\u8BEF");
    }
    if (result.ok !== true) {
      const error = result.error;
      throw new Error(error?.message ?? error?.code ?? "RPC \u8C03\u7528\u5931\u8D25");
    }
    return result.value;
  }
  status() {
    return this.call("bridge.status");
  }
  start() {
    return this.call("bridge.start");
  }
  stop() {
    return this.call("bridge.stop");
  }
  logs(afterSeq) {
    return this.call("bridge.logs", { afterSeq });
  }
  checkDeps() {
    return this.call("bridge.deps.check");
  }
  installDeps() {
    return this.call("bridge.deps.install");
  }
  getConfig() {
    return this.call("config.get");
  }
  setConfig(patch) {
    return this.call("config.set", { patch });
  }
  savePersona(name, content) {
    return this.call("persona.save", { name, content });
  }
  deletePersona(name) {
    return this.call("persona.delete", { name });
  }
  setActivePersona(name) {
    return this.call("persona.setActive", { name });
  }
  listSessions() {
    return this.call("sessions.list");
  }
  unbindSession(peer) {
    return this.call("sessions.unbind", { peer });
  }
  checkUpdate() {
    return this.call("update.check");
  }
  listModels() {
    return this.call("model.list");
  }
};

// plugin-src/client/panels.tsx
var React = __toESM(require("react"), 1);
var h = React.createElement;
var logCache = { logs: [], lastSeq: -1 };
function mergeLogs(existing, incoming) {
  const bySeq = /* @__PURE__ */ new Map();
  for (const l of existing) bySeq.set(l.seq, l);
  for (const l of incoming) bySeq.set(l.seq, l);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq).slice(-500);
}
var CSS = `
.wc-root{display:flex;flex-direction:column;gap:16px;font-size:13px;color:var(--dsw-alias-label-primary,#e6e6e6);width:100%;max-width:760px}
.wc-root *{box-sizing:border-box;min-width:0}
.wc-card{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.02))}
.wc-card-title{display:flex;align-items:center;gap:8px;margin:0;font-size:14px;font-weight:600;padding-bottom:10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(255,255,255,.06))}
.wc-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a8a);margin:0;line-height:1.6}
.wc-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wc-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wc-autoscroll{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-secondary,#c9c9c9);cursor:pointer}

.wc-btn{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e6e6e6);border-radius:8px;padding:7px 16px;font:inherit;font-size:13px;line-height:1.4;cursor:pointer;transition:all .15s}
.wc-btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary,#3964fe)}
.wc-btn:disabled{opacity:.45;cursor:default}
.wc-btn-primary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
.wc-btn-primary:hover:not(:disabled){opacity:.9}
.wc-btn-danger{border-color:transparent;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a8a);padding:5px 10px}
.wc-btn-danger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.08)}

.wc-badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:2px 10px;border-radius:999px;line-height:1.6}
.wc-badge::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}
.wc-badge-stopped{color:var(--dsw-alias-label-tertiary,#8a8a8a);background:rgba(138,138,138,.12)}
.wc-badge-starting{color:#4a9eff;background:rgba(74,158,255,.12)}
.wc-badge-running{color:var(--dsw-alias-state-success-primary,#3fb950);background:rgba(63,185,80,.12)}
.wc-badge-error{color:var(--dsw-alias-state-error-primary,#f85149);background:rgba(248,81,73,.12)}

/* \u5F00\u5173 */
.wc-switch{position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0;cursor:pointer}
.wc-switch input{opacity:0;width:0;height:0}
.wc-slider{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:999px;transition:.2s}
.wc-slider::before{content:"";position:absolute;height:16px;width:16px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.2s}
.wc-switch input:checked + .wc-slider{background:var(--dsw-alias-state-business-primary,#3964fe);border-color:var(--dsw-alias-state-business-primary,#3964fe)}
.wc-switch input:checked + .wc-slider::before{transform:translateX(16px)}

/* \u8BBE\u7F6E\u884C */
.wc-setting{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:7px 0}
.wc-setting-info{display:flex;flex-direction:column;gap:2px}
.wc-setting-title{font-size:13px;line-height:1.5}
.wc-setting-desc{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);line-height:1.5}

/* \u8868\u5355\u5B57\u6BB5 */
.wc-field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:180px}
.wc-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#c9c9c9)}
.wc-input,.wc-select,.wc-textarea{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e6e6e6);border-radius:8px;padding:7px 11px;font:inherit;font-size:13px;width:100%;transition:border-color .15s}
.wc-input:focus,.wc-select:focus,.wc-textarea:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#3964fe)}
.wc-select{appearance:none;cursor:pointer}
.wc-textarea{min-height:150px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.7}

/* \u65E5\u5FD7 */
.wc-log{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:#0d1117;border-radius:10px;padding:10px 12px;font-family:ui-monospace,"SF Mono",Consolas,monospace;font-size:12px;line-height:1.6;height:280px;overflow:auto;white-space:pre-wrap;word-break:break-all}
.wc-log-line{display:block}
.wc-log-time{color:#6e7681;margin-right:8px}
.wc-log .error{color:#ff7b72}
.wc-log .warn{color:#d29922}

/* \u4F1A\u8BDD\u7ED1\u5B9A */
.wc-sessions{display:flex;flex-direction:column;gap:8px}
.wc-session-row{display:flex;align-items:center;gap:10px;font-size:12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:8px;padding:8px 12px}
.wc-session-peer{font-family:ui-monospace,Consolas,monospace;font-weight:600}
.wc-session-id{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-family:ui-monospace,Consolas,monospace;font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* \u4EBA\u8BBE\u5361 */
.wc-persona-card{display:flex;align-items:center;gap:12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:10px;padding:10px 14px}
.wc-persona-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.wc-persona-title{display:flex;align-items:center;gap:8px}
.wc-persona-name{font-weight:600;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wc-persona-preview{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wc-persona-actions{display:flex;align-items:center;gap:4px;flex-shrink:0}

.wc-error{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}
.wc-success{font-size:12px;color:var(--dsw-alias-state-success-primary,#3fb950)}
`;
function injectCss() {
  const tagId = "dsh-wechat-connecter/main.css";
  if (typeof document !== "undefined" && !document.querySelector(`style[data-plugin-css="${tagId}"]`)) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-wechat-connecter";
    tag.dataset.pluginCss = tagId;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }
}
injectCss();
function usePoll(cb, ms) {
  React.useEffect(() => {
    cb();
    const timer = setInterval(cb, ms);
    return () => clearInterval(timer);
  }, [cb, ms]);
}
function Switch(props) {
  return h(
    "label",
    { className: "wc-switch" },
    h("input", { type: "checkbox", checked: props.checked, onChange: (e) => props.onChange(e.target.checked) }),
    h("span", { className: "wc-slider" })
  );
}
function SettingRow(props) {
  return h(
    "div",
    { className: "wc-setting" },
    h(
      "div",
      { className: "wc-setting-info" },
      h("div", { className: "wc-setting-title" }, props.title),
      props.desc ? h("div", { className: "wc-setting-desc" }, props.desc) : null
    ),
    h(Switch, { checked: props.checked, onChange: props.onChange })
  );
}
function fmtTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function firstLine(md) {
  const line = (md ?? "").split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
  return line ? line.trim().slice(0, 60) : "";
}
function WechatPanel(props) {
  const { api } = props;
  const [status, setStatus] = React.useState("stopped");
  const [lastError, setLastError] = React.useState("");
  const [config, setConfig] = React.useState(null);
  const [logs, setLogs] = React.useState(logCache.logs);
  const lastSeqRef = React.useRef(logCache.lastSeq);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(null);
  const [depsInstalling, setDepsInstalling] = React.useState(false);
  const [depsInfo, setDepsInfo] = React.useState(null);
  const [updateResult, setUpdateResult] = React.useState(null);
  const [sessions, setSessions] = React.useState([]);
  const [models, setModels] = React.useState(null);
  const logBox = React.useRef(null);
  const [personaName, setPersonaName] = React.useState("");
  const [personaContent, setPersonaContent] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [personaNotice, setPersonaNotice] = React.useState(null);
  const [personaError, setPersonaError] = React.useState(null);
  const refreshStatus = React.useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s.status);
      setLastError(s.lastError);
      setConfig(s.config);
      setDepsInstalling(s.depsInstalling);
    } catch {
    }
  }, [api]);
  const refreshLogs = React.useCallback(async () => {
    try {
      const r = await api.logs(lastSeqRef.current);
      if (r.logs.length > 0) {
        const merged = mergeLogs(logCache.logs, r.logs);
        logCache.logs = merged;
        logCache.lastSeq = r.lastSeq;
        lastSeqRef.current = r.lastSeq;
        setLogs(merged);
      }
    } catch {
    }
  }, [api]);
  React.useEffect(() => {
    void refreshStatus();
    void api.listSessions().then(setSessions).catch(() => void 0);
    void api.listModels().then(setModels).catch(() => void 0);
  }, [api, refreshStatus]);
  usePoll(refreshStatus, 2e3);
  usePoll(refreshLogs, 1e3);
  React.useEffect(() => {
    const box = logBox.current;
    if (box && autoScroll) {
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
      });
    }
  }, [logs, autoScroll]);
  if (!config) return h("div", { className: "wc-root" }, h("p", { className: "wc-hint" }, "\u52A0\u8F7D\u4E2D\u2026"));
  const run = (fn) => {
    setBusy(true);
    setNotice(null);
    return fn().then((result) => {
      setNotice({ kind: "success", text: result?.message ?? "\u5B8C\u6210" });
      void refreshStatus();
    }).catch((e) => setNotice({ kind: "error", text: String(e?.message ?? e) })).finally(() => setBusy(false));
  };
  const patch = (p) => api.setConfig(p).then(setConfig);
  const badge = status === "running" ? h("span", { className: "wc-badge wc-badge-running" }, "\u8FD0\u884C\u4E2D") : status === "starting" ? h("span", { className: "wc-badge wc-badge-starting" }, "\u542F\u52A8\u4E2D") : status === "error" ? h("span", { className: "wc-badge wc-badge-error" }, "\u9519\u8BEF") : h("span", { className: "wc-badge wc-badge-stopped" }, "\u5DF2\u505C\u6B62");
  const modelValue = config.model?.provider && config.model?.model ? `${config.model.provider}/${config.model.model}` : "";
  const followLabel = models?.current?.provider ? `\u8DDF\u968F\u9ED8\u8BA4\uFF08${models.current.provider} / ${models.current.model}\uFF09` : "\u8DDF\u968F\u9ED8\u8BA4\uFF08\u5DE5\u4F5C\u533A\uFF09";
  const onModelChange = (v) => {
    if (!v) return patch({ model: { provider: "", model: "" } });
    const idx = v.indexOf("/");
    const provider = v.slice(0, idx);
    const model = v.slice(idx + 1);
    return patch({ model: { provider, model } });
  };
  const persona = config.persona ?? {};
  const cards = persona.cards ?? {};
  const cardNames = Object.keys(cards).sort();
  const savePersona = () => {
    const trimmed = personaName.trim();
    if (!trimmed) return setPersonaError("\u4EBA\u8BBE\u540D\u4E0D\u80FD\u4E3A\u7A7A");
    if (!personaContent.trim()) return setPersonaError("\u4EBA\u8BBE\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
    setPersonaError(null);
    api.savePersona(trimmed, personaContent).then(() => {
      setPersonaNotice(`\u5DF2\u4FDD\u5B58\u300C${trimmed}\u300D`);
      setPersonaName("");
      setPersonaContent("");
      setEditing(null);
      void refreshStatus();
    });
  };
  const startEdit = (n) => {
    setEditing(n);
    setPersonaName(n);
    setPersonaContent(cards[n] ?? "");
    setPersonaNotice(null);
  };
  return h(
    "div",
    { className: "wc-root" },
    // -- 桥接状态 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "\u6865\u63A5\u72B6\u6001"),
      h("div", { className: "wc-row" }, badge, lastError ? h("span", { className: "wc-error" }, lastError) : null),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn wc-btn-primary", disabled: busy || status === "running" || status === "starting", onClick: () => run(() => api.start()) }, "\u542F\u52A8\u6865\u63A5"),
        h("button", { className: "wc-btn", disabled: busy || status === "stopped", onClick: () => run(() => api.stop()) }, "\u505C\u6B62\u6865\u63A5"),
        h("button", { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.checkDeps().then(setDepsInfo)) }, "\u68C0\u67E5\u4F9D\u8D56"),
        h("button", { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.installDeps()) }, depsInstalling ? "\u5B89\u88C5\u4E2D\u2026" : "\u5B89\u88C5\u4F9D\u8D56"),
        notice ? h("span", { className: notice.kind === "error" ? "wc-error" : "wc-success" }, notice.text) : null
      ),
      depsInfo ? h("p", { className: "wc-hint" }, `Python: ${depsInfo.python || "\u2014"} \uFF5C wechatauto: ${depsInfo.wechatautoVersion || "\u672A\u5B89\u88C5"}`) : null
    ),
    // -- 回复设置 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "\u56DE\u590D\u8BBE\u7F6E"),
      h(SettingRow, { title: "\u542F\u52A8 DSH \u81EA\u52A8\u542F\u52A8\u6865\u63A5", desc: "\u6253\u5F00 DSH \u540E\u81EA\u52A8\u62C9\u8D77 Python \u6865\u63A5\u8FDB\u7A0B", checked: config.autoStart, onChange: (v) => patch({ autoStart: v }) }),
      h(SettingRow, { title: "\u542F\u7528\u81EA\u52A8\u56DE\u590D", desc: "\u5173\u95ED\u540E\u63D2\u4EF6\u53EA\u6536\u4E0D\u53D1", checked: config.enabled, onChange: (v) => patch({ enabled: v }) }),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u6A21\u578B"),
        h(
          "select",
          { className: "wc-select", value: modelValue, onChange: (e) => onModelChange(e.target.value) },
          h("option", { value: "" }, followLabel),
          ...(models?.groups ?? []).map(
            (g) => h(
              "optgroup",
              { label: g.name, key: g.id },
              ...g.models.map((m) => h("option", { value: `${g.id}/${m.id}`, key: m.id }, m.name))
            )
          )
        )
      ),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u53D1\u9001\u901A\u9053"),
        h(
          "select",
          { className: "wc-select", value: config.sendMode, onChange: (e) => patch({ sendMode: e.target.value }) },
          h("option", { value: "auto" }, "\u81EA\u52A8\uFF08\u540E\u53F0\u5931\u8D25\u56DE\u9000\u524D\u53F0\uFF09"),
          h("option", { value: "front" }, "\u524D\u53F0 UIA"),
          h("option", { value: "bg" }, "\u540E\u53F0 PostMessage")
        )
      ),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u673A\u5668\u4EBA\u6635\u79F0\uFF08\u7528\u4E8E\u5224\u65AD @ / \u70B9\u540D\uFF09"),
        h("input", { className: "wc-input", value: config.botName, placeholder: "\u5C0F\u9CB8", onChange: (e) => patch({ botName: e.target.value }) })
      ),
      h(SettingRow, { title: "\u79C1\u804A\u56DE\u590D", checked: config.private.enabled, onChange: (v) => patch({ private: { ...config.private, enabled: v } }) }),
      h(SettingRow, { title: "\u7FA4\u804A\u56DE\u590D", checked: config.group.enabled, onChange: (v) => patch({ group: { ...config.group, enabled: v } }) }),
      h(SettingRow, { title: "\u7FA4\u804A\u9700 @ / \u70B9\u540D\u624D\u56DE\u590D", checked: config.group.requireAt, onChange: (v) => patch({ group: { ...config.group, requireAt: v } }) }),
      h(SettingRow, { title: "\u957F\u56DE\u590D\u62C6\u6210\u591A\u6761\u77ED\u6C14\u6CE1", desc: "\u50CF\u771F\u4EBA\u53D1\u5FAE\u4FE1\u4E00\u6837\u5206\u6BB5", checked: config.humanize.splitLongReply, onChange: (v) => patch({ humanize: { ...config.humanize, splitLongReply: v } }) }),
      h(SettingRow, { title: "\u53BB\u6389\u53E5\u5C3E\u6807\u70B9", checked: config.humanize.stripTrailingPunct, onChange: (v) => patch({ humanize: { ...config.humanize, stripTrailingPunct: v } }) }),
      h(SettingRow, { title: "\u53CD\u9E66\u9E49\u5B66\u820C\u53BB\u91CD", desc: "\u4E0D\u91CD\u590D\u5BF9\u65B9\u539F\u8BDD", checked: config.humanize.dedupeRepeat, onChange: (v) => patch({ humanize: { ...config.humanize, dedupeRepeat: v } }) })
    ),
    // -- 更新 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "\u66F4\u65B0"),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn", disabled: busy, onClick: () => run(() => api.checkUpdate().then((r) => setUpdateResult(r))) }, "\u68C0\u67E5\u66F4\u65B0"),
        updateResult ? h("span", { className: updateResult.hasUpdate ? "wc-error" : "wc-success" }, updateResult.message) : null
      ),
      updateResult ? h("p", { className: "wc-hint" }, `\u5F53\u524D ${updateResult.currentVersion} \uFF5C \u6700\u65B0 ${updateResult.latestVersion ?? "\u2014"}${updateResult.url ? ` \uFF5C ${updateResult.url}` : ""}`) : null
    ),
    // -- 会话绑定 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, `\u4F1A\u8BDD\u7ED1\u5B9A\uFF08${sessions.length}\uFF09`),
      sessions.length === 0 ? h("p", { className: "wc-hint" }, "\u8FD8\u6CA1\u6709\u5FAE\u4FE1\u5BF9\u7AEF\u7ED1\u5B9A\u5230 DSH \u4F1A\u8BDD\u3002\u6536\u5230\u6D88\u606F\u540E\u4F1A\u81EA\u52A8\u5EFA\u7ACB\u7ED1\u5B9A\u3002") : h(
        "div",
        { className: "wc-sessions" },
        sessions.map(
          (s) => h(
            "div",
            { className: "wc-session-row", key: s.peer },
            h("span", { className: "wc-session-peer" }, s.peer),
            h("span", { className: "wc-session-id" }, s.binding.sessionId),
            h("button", { className: "wc-btn wc-btn-danger", onClick: () => api.unbindSession(s.peer).then(setSessions) }, "\u89E3\u7ED1")
          )
        )
      )
    ),
    // -- 人设管理 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "\u4EBA\u8BBE\u7BA1\u7406"),
      h("p", { className: "wc-hint" }, "\u4EBA\u8BBE\u5361\u5185\u5BB9\u4F1A\u4F5C\u4E3A\u7CFB\u7EDF\u63D0\u793A\u8BCD\u6CE8\u5165\u5230\u5FAE\u4FE1\u5BF9\u7AEF\u5BF9\u5E94\u7684 DSH \u4F1A\u8BDD\u3002\u5207\u6362\u4EBA\u8BBE\u540E\u5BF9\u65B0\u4F1A\u8BDD\u751F\u6548\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u5728\u91CD\u542F\u540E\u751F\u6548\u3002"),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, editing ? `\u7F16\u8F91\u4EBA\u8BBE\u300C${editing}\u300D\u2014 \u540D\u79F0` : "\u65B0\u5EFA\u4EBA\u8BBE \u2014 \u540D\u79F0"),
        h("input", { className: "wc-input", value: personaName, placeholder: "\u5C0F\u9CB8", onChange: (e) => setPersonaName(e.target.value) })
      ),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u5185\u5BB9\uFF08Markdown\uFF09"),
        h("textarea", { className: "wc-textarea", value: personaContent, onChange: (e) => setPersonaContent(e.target.value) })
      ),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn wc-btn-primary", onClick: savePersona }, "\u4FDD\u5B58\u4EBA\u8BBE"),
        editing ? h("button", { className: "wc-btn", onClick: () => {
          setEditing(null);
          setPersonaName("");
          setPersonaContent("");
        } }, "\u53D6\u6D88\u7F16\u8F91") : null,
        personaNotice ? h("span", { className: "wc-success" }, personaNotice) : null,
        personaError ? h("span", { className: "wc-error" }, personaError) : null
      ),
      cardNames.length === 0 ? h("p", { className: "wc-hint" }, "\u8FD8\u6CA1\u6709\u4EBA\u8BBE\u5361\uFF0C\u5148\u5728\u4E0A\u9762\u65B0\u5EFA\u4E00\u4E2A\u3002") : h(
        "div",
        { className: "wc-sessions" },
        cardNames.map(
          (n) => h(
            "div",
            { className: "wc-persona-card", key: n },
            h(
              "div",
              { className: "wc-persona-main" },
              h(
                "div",
                { className: "wc-persona-title" },
                h("span", { className: "wc-persona-name" }, n),
                persona.active === n ? h("span", { className: "wc-badge wc-badge-running" }, "\u5F53\u524D") : null
              ),
              h("div", { className: "wc-persona-preview" }, firstLine(cards[n]))
            ),
            h(
              "div",
              { className: "wc-persona-actions" },
              persona.active === n ? null : h("button", { className: "wc-btn", onClick: () => api.setActivePersona(n).then(refreshStatus) }, "\u542F\u7528"),
              h("button", { className: "wc-btn", onClick: () => startEdit(n) }, "\u7F16\u8F91"),
              h("button", { className: "wc-btn wc-btn-danger", onClick: () => {
                if (window.confirm(`\u5220\u9664\u4EBA\u8BBE\u300C${n}\u300D\uFF1F`)) api.deletePersona(n).then(refreshStatus);
              } }, "\u5220\u9664")
            )
          )
        )
      )
    ),
    // -- 实时日志 --
    h(
      "div",
      { className: "wc-card" },
      h(
        "div",
        { className: "wc-card-title", style: { justifyContent: "space-between" } },
        "\u5B9E\u65F6\u65E5\u5FD7",
        h(
          "div",
          { className: "wc-actions" },
          h(
            "label",
            { className: "wc-autoscroll", title: "\u65B0\u65E5\u5FD7\u81EA\u52A8\u6EDA\u52A8\u5230\u5E95\u90E8" },
            h("span", null, "\u81EA\u52A8\u6EDA\u52A8"),
            h(Switch, { checked: autoScroll, onChange: setAutoScroll })
          ),
          h("button", { className: "wc-btn", onClick: () => {
            logCache.logs = [];
            setLogs([]);
          } }, "\u6E05\u7A7A")
        )
      ),
      h(
        "div",
        { className: "wc-log", ref: logBox },
        logs.length === 0 ? h("span", { className: "wc-log-line", style: { color: "#6e7681" } }, "\u6682\u65E0\u65E5\u5FD7\u3002\u542F\u52A8\u6865\u63A5\u540E\u4F1A\u5728\u8FD9\u91CC\u5B9E\u65F6\u663E\u793A\u3002") : logs.map(
          (l) => h(
            "div",
            { className: "wc-log-line" + (l.level === "error" ? " error" : l.level === "warn" ? " warn" : ""), key: l.seq },
            h("span", { className: "wc-log-time" }, `[${fmtTime(l.time)}]`),
            l.text
          )
        )
      )
    )
  );
}

// plugin-src/client/index.tsx
var h2 = React2.createElement;
var inject = ["slots", "connection", "locale"];
function apply(ctx) {
  const api = new Api(ctx.connection);
  const localeNs = "dshWechatConnecter";
  try {
    ctx.locale?.register?.(localeNs, {
      zh: { title: "wechat-connecter" },
      en: { title: "wechat-connecter" }
    });
  } catch {
  }
  ctx.slots.inject("settings.section", () => {
    const unregister = ctx.slots.register(
      {
        name: "settings.section",
        id: "dsh-wechat-connecter",
        order: 30,
        label: () => "wechat-connecter",
        locale: localeNs
      },
      () => h2(WechatPanel, { api })
    );
    return () => unregister();
  });
}

    return module.exports;
  }
});
