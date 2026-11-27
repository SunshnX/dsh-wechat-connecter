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
  call(method, payload = {}) {
    return this.connection.rpc.call("/api", RPC_ENDPOINT, { method, payload });
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
};

// plugin-src/client/panels.tsx
var React = __toESM(require("react"), 1);
var h = React.createElement;
function usePoll(cb, ms, active) {
  React.useEffect(() => {
    if (!active) return;
    cb();
    const timer = setInterval(cb, ms);
    return () => clearInterval(timer);
  }, [cb, ms, active]);
}
function BridgePanel(props) {
  const { api } = props;
  const [status, setStatus] = React.useState("stopped");
  const [lastError, setLastError] = React.useState("");
  const [config, setConfig] = React.useState(null);
  const [logs, setLogs] = React.useState([]);
  const [lastSeq, setLastSeq] = React.useState(-1);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(null);
  const [depsInstalling, setDepsInstalling] = React.useState(false);
  const [depsInfo, setDepsInfo] = React.useState(null);
  const [updateResult, setUpdateResult] = React.useState(null);
  const [sessions, setSessions] = React.useState([]);
  const logBox = React.useRef(null);
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
      const r = await api.logs(lastSeq);
      if (r.logs.length > 0) {
        setLogs((prev) => [...prev, ...r.logs].slice(-500));
        setLastSeq(r.lastSeq);
      }
    } catch {
    }
  }, [api, lastSeq]);
  React.useEffect(() => {
    void refreshStatus();
    void api.listSessions().then(setSessions).catch(() => void 0);
  }, [api, refreshStatus]);
  usePoll(refreshStatus, 2e3, true);
  usePoll(refreshLogs, 1e3, status === "running" || status === "starting");
  React.useEffect(() => {
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [logs]);
  if (!config) return h("div", { className: "wc-root" }, h("p", { className: "wc-hint" }, "\u52A0\u8F7D\u4E2D\u2026"));
  const run = (fn) => {
    setBusy(true);
    setNotice(null);
    return fn().then((result) => {
      setNotice({ kind: "success", text: result?.message ?? "\u5B8C\u6210" });
      void refreshStatus();
    }).catch((e) => setNotice({ kind: "error", text: String(e?.message ?? e) })).finally(() => setBusy(false));
  };
  const patch = (p) => {
    return api.setConfig(p).then((next) => {
      setConfig(next);
    });
  };
  const statusBadge = status === "running" ? h("span", { className: "wc-badge wc-badge-running" }, "\u8FD0\u884C\u4E2D") : status === "starting" ? h("span", { className: "wc-badge" }, "\u542F\u52A8\u4E2D") : status === "error" ? h("span", { className: "wc-badge wc-badge-error" }, "\u9519\u8BEF") : h("span", { className: "wc-badge" }, "\u5DF2\u505C\u6B62");
  return h(
    "div",
    { className: "wc-root" },
    // -- status / control --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "\u6865\u63A5\u72B6\u6001"),
      h("div", { className: "wc-row" }, statusBadge, lastError ? h("span", { className: "wc-error" }, lastError) : null),
      h(
        "div",
        { className: "wc-row" },
        h(
          "button",
          { className: "wc-btn wc-btn-primary", disabled: busy || status === "running" || status === "starting", onClick: () => run(() => api.start()) },
          "\u542F\u52A8\u6865\u63A5"
        ),
        h("button", { className: "wc-btn", disabled: busy || status === "stopped", onClick: () => run(() => api.stop()) }, "\u505C\u6B62\u6865\u63A5"),
        h(
          "button",
          { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.checkDeps()).then(() => api.checkDeps().then(setDepsInfo)) },
          "\u68C0\u67E5\u4F9D\u8D56"
        ),
        h(
          "button",
          { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.installDeps()) },
          depsInstalling ? "\u5B89\u88C5\u4E2D\u2026" : "\u5B89\u88C5\u4F9D\u8D56"
        ),
        notice ? h("span", { className: notice.kind === "error" ? "wc-error" : "wc-success" }, notice.text) : null
      ),
      depsInfo ? h("p", { className: "wc-hint" }, `Python: ${depsInfo.python || "\u2014"} \uFF5C wechatauto: ${depsInfo.wechatautoVersion || "\u672A\u5B89\u88C5"}`) : null
    ),
    // -- reply settings --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "\u56DE\u590D\u8BBE\u7F6E"),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.enabled, onChange: (e) => patch({ enabled: e.target.checked }) }),
        h("span", null, "\u542F\u7528\u81EA\u52A8\u56DE\u590D")
      ),
      h(
        "label",
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
        "label",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u673A\u5668\u4EBA\u6635\u79F0\uFF08\u7528\u4E8E\u70B9\u540D/\u5224\u65AD @\uFF09"),
        h("input", { className: "wc-input", value: config.botName, placeholder: "\u5C0F\u9CB8", onChange: (e) => patch({ botName: e.target.value }) })
      ),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.private.enabled, onChange: (e) => patch({ private: { ...config.private, enabled: e.target.checked } }) }),
        h("span", null, "\u79C1\u804A\u56DE\u590D")
      ),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.group.enabled, onChange: (e) => patch({ group: { ...config.group, enabled: e.target.checked } }) }),
        h("span", null, "\u7FA4\u804A\u56DE\u590D")
      ),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.group.requireAt, onChange: (e) => patch({ group: { ...config.group, requireAt: e.target.checked } }) }),
        h("span", null, "\u7FA4\u804A\u9700 @ / \u70B9\u540D\u624D\u56DE\u590D")
      ),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.humanize.splitLongReply, onChange: (e) => patch({ humanize: { ...config.humanize, splitLongReply: e.target.checked } }) }),
        h("span", null, "\u957F\u56DE\u590D\u62C6\u6210\u591A\u6761\u77ED\u6C14\u6CE1")
      ),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.humanize.stripTrailingPunct, onChange: (e) => patch({ humanize: { ...config.humanize, stripTrailingPunct: e.target.checked } }) }),
        h("span", null, "\u53BB\u6389\u53E5\u5C3E\u6807\u70B9")
      ),
      h(
        "label",
        { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.humanize.dedupeRepeat, onChange: (e) => patch({ humanize: { ...config.humanize, dedupeRepeat: e.target.checked } }) }),
        h("span", null, "\u53CD\u9E66\u9E49\u5B66\u820C\u53BB\u91CD")
      )
    ),
    // -- update --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "\u66F4\u65B0"),
      h(
        "div",
        { className: "wc-row" },
        h("button", { className: "wc-btn", disabled: busy, onClick: () => run(() => api.checkUpdate().then((r) => {
          setUpdateResult(r);
        })) }, "\u68C0\u67E5\u66F4\u65B0"),
        updateResult ? h("span", { className: updateResult.hasUpdate ? "wc-error" : "wc-success" }, updateResult.message) : null
      ),
      updateResult ? h("p", { className: "wc-hint" }, `\u5F53\u524D ${updateResult.currentVersion} \uFF5C \u6700\u65B0 ${updateResult.latestVersion ?? "\u2014"}`) : null
    ),
    // -- sessions --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, `\u4F1A\u8BDD\u7ED1\u5B9A\uFF08${sessions.length}\uFF09`),
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
    // -- logs --
    h(
      "div",
      { className: "wc-card" },
      h(
        "div",
        { className: "wc-row" },
        h("h3", null, "\u5B9E\u65F6\u65E5\u5FD7"),
        h("button", { className: "wc-btn", onClick: () => setLogs([]) }, "\u6E05\u7A7A")
      ),
      h(
        "div",
        { className: "wc-log", ref: logBox },
        logs.map(
          (l) => h(
            "div",
            { className: l.level === "error" ? "error" : l.level === "warn" ? "warn" : "", key: l.seq },
            `[${new Date(l.time).toLocaleTimeString()}] ${l.text}`
          )
        )
      )
    )
  );
}
function PersonaPanel(props) {
  const { api } = props;
  const [config, setConfig] = React.useState(null);
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [notice, setNotice] = React.useState(null);
  const [error, setError] = React.useState(null);
  const refresh = React.useCallback(async () => {
    try {
      setConfig(await api.getConfig());
    } catch {
    }
  }, [api]);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);
  if (!config) return h("div", { className: "wc-root" }, h("p", { className: "wc-hint" }, "\u52A0\u8F7D\u4E2D\u2026"));
  const persona = config.persona;
  const cards = persona.cards ?? {};
  const names = Object.keys(cards).sort();
  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("\u4EBA\u8BBE\u540D\u4E0D\u80FD\u4E3A\u7A7A");
      return;
    }
    if (!content.trim()) {
      setError("\u4EBA\u8BBE\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
      return;
    }
    setError(null);
    api.savePersona(trimmed, content).then(() => {
      setNotice(`\u5DF2\u4FDD\u5B58\u300C${trimmed}\u300D`);
      setName("");
      setContent("");
      setEditing(null);
      void refresh();
    });
  };
  const startEdit = (n) => {
    setEditing(n);
    setName(n);
    setContent(cards[n] ?? "");
    setNotice(null);
  };
  return h(
    "div",
    { className: "wc-root" },
    h("p", { className: "wc-hint" }, "\u4EBA\u8BBE\u5361\u5185\u5BB9\u4F1A\u4F5C\u4E3A\u7CFB\u7EDF\u63D0\u793A\u8BCD\u6CE8\u5165\u5230\u5FAE\u4FE1\u5BF9\u7AEF\u5BF9\u5E94\u7684 DSH \u4F1A\u8BDD\u3002\u5207\u6362\u4EBA\u8BBE\u540E\u5BF9\u65B0\u4F1A\u8BDD\u751F\u6548\uFF1B\u5DF2\u6709\u4F1A\u8BDD\u5728\u91CD\u542F\u540E\u751F\u6548\u3002"),
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, editing ? `\u7F16\u8F91\u4EBA\u8BBE\u300C${editing}\u300D` : "\u65B0\u5EFA\u4EBA\u8BBE"),
      h(
        "label",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u540D\u79F0"),
        h("input", { className: "wc-input", value: name, placeholder: "\u5C0F\u9CB8", onChange: (e) => setName(e.target.value) })
      ),
      h(
        "label",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "\u5185\u5BB9\uFF08Markdown\uFF09"),
        h("textarea", { className: "wc-textarea", value: content, onChange: (e) => setContent(e.target.value) })
      ),
      h(
        "div",
        { className: "wc-row" },
        h("button", { className: "wc-btn wc-btn-primary", onClick: save }, "\u4FDD\u5B58"),
        editing ? h("button", { className: "wc-btn", onClick: () => {
          setEditing(null);
          setName("");
          setContent("");
        } }, "\u53D6\u6D88\u7F16\u8F91") : null,
        notice ? h("span", { className: "wc-success" }, notice) : null,
        error ? h("span", { className: "wc-error" }, error) : null
      )
    ),
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "\u4EBA\u8BBE\u5361"),
      names.length === 0 ? h("p", { className: "wc-hint" }, "\u8FD8\u6CA1\u6709\u4EBA\u8BBE\u5361\uFF0C\u5148\u5728\u4E0A\u9762\u65B0\u5EFA\u4E00\u4E2A\u3002") : h(
        "div",
        { className: "wc-sessions" },
        names.map(
          (n) => h(
            "div",
            { className: "wc-persona-card", key: n },
            h("span", { className: "wc-persona-name" }, n),
            persona.active === n ? h("span", { className: "wc-badge wc-badge-running" }, "\u5F53\u524D") : null,
            h("span", { className: "wc-persona-preview" }, (cards[n] ?? "").split("\n").filter(Boolean)[0] ?? ""),
            persona.active === n ? null : h("button", { className: "wc-btn", onClick: () => api.setActivePersona(n).then(refresh) }, "\u542F\u7528"),
            h("button", { className: "wc-btn", onClick: () => startEdit(n) }, "\u7F16\u8F91"),
            h("button", { className: "wc-btn wc-btn-danger", onClick: () => {
              if (window.confirm(`\u5220\u9664\u4EBA\u8BBE\u300C${n}\u300D\uFF1F`)) api.deletePersona(n).then(refresh);
            } }, "\u5220\u9664")
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
  const zh = {
    bridgeTitle: "\u5FAE\u4FE1\u8FDE\u63A5",
    personaTitle: "\u4EBA\u8BBE\u7BA1\u7406"
  };
  const en = {
    bridgeTitle: "WeChat Bridge",
    personaTitle: "Persona"
  };
  const localeNs = "dshWechatConnecter";
  try {
    ctx.locale?.register?.(localeNs, { zh, en });
  } catch {
  }
  const section = (id, order, label, render) => {
    ctx.slots.inject("settings.section", () => {
      const unregister = ctx.slots.register(
        {
          name: "settings.section",
          id,
          order,
          label,
          locale: localeNs
        },
        render
      );
      return () => unregister();
    });
  };
  section("dsh-wechat-connecter-bridge", 30, () => "\u5FAE\u4FE1\u8FDE\u63A5", () => h2(BridgePanel, { api }));
  section("dsh-wechat-connecter-persona", 31, () => "\u4EBA\u8BBE\u7BA1\u7406", () => h2(PersonaPanel, { api }));
}

    return module.exports;
  }
});
