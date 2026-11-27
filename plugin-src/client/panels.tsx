// Browser half — management panels (bridge + persona).

import * as React from "react";
import { Api, type Config, type LogLine, type SessionBinding } from "./api";

const h = React.createElement;

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const CSS = `
.wc-root{display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary);width:100%;max-width:760px}
.wc-root *{box-sizing:border-box;min-width:0}
.wc-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;background:var(--dsw-alias-bg-layer-2)}
.wc-card h3{margin:0;font-size:14px;font-weight:600}
.wc-hint{font-size:12px;color:var(--dsw-alias-label-tertiary);margin:0}
.wc-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wc-field{display:flex;flex-direction:column;gap:4px}
.wc-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.wc-input,.wc-select,.wc-textarea{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;width:100%}
.wc-textarea{min-height:140px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.6}
.wc-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}
.wc-btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}
.wc-btn:disabled{opacity:.5;cursor:default}
.wc-btn-primary{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
.wc-btn-danger{border-color:var(--dsw-alias-state-error-primary,#f85149);color:var(--dsw-alias-state-error-primary,#f85149)}
.wc-badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);border-radius:999px;padding:1px 10px;font-size:11px}
.wc-badge-running{border-color:var(--dsw-alias-state-success-primary,#2da44e);color:var(--dsw-alias-state-success-primary,#2da44e)}
.wc-badge-error{border-color:var(--dsw-alias-state-error-primary,#f85149);color:var(--dsw-alias-state-error-primary,#f85149)}
.wc-check{display:inline-flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}
.wc-check input{accent-color:var(--dsw-alias-state-business-primary)}
.wc-log{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:8px;padding:8px 10px;font-family:ui-monospace,Consolas,monospace;font-size:11px;line-height:1.5;height:220px;overflow:auto;white-space:pre-wrap;word-break:break-all}
.wc-log .error{color:var(--dsw-alias-state-error-primary,#f85149)}
.wc-log .warn{color:#d29922}
.wc-persona-card{display:flex;align-items:center;gap:10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px 12px}
.wc-persona-name{font-weight:600;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wc-persona-preview{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wc-error{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}
.wc-success{font-size:12px;color:var(--dsw-alias-state-success-primary,#2da44e)}
.wc-sessions{display:flex;flex-direction:column;gap:6px}
.wc-session-row{display:flex;align-items:center;gap:8px;font-size:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px}
.wc-session-peer{font-family:ui-monospace,Consolas,monospace;font-weight:600}
.wc-session-id{color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,Consolas,monospace;font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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

function usePoll(cb: () => void, ms: number, active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    cb();
    const timer = setInterval(cb, ms);
    return () => clearInterval(timer);
  }, [cb, ms, active]);
}

// ---------------------------------------------------------------------------
// Bridge panel
// ---------------------------------------------------------------------------
export function BridgePanel(props: { api: Api }) {
  const { api } = props;
  const [status, setStatus] = React.useState<"stopped" | "starting" | "running" | "error">("stopped");
  const [lastError, setLastError] = React.useState("");
  const [config, setConfig] = React.useState<Config | null>(null);
  const [logs, setLogs] = React.useState<LogLine[]>([]);
  const [lastSeq, setLastSeq] = React.useState(-1);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [depsInstalling, setDepsInstalling] = React.useState(false);
  const [depsInfo, setDepsInfo] = React.useState<any>(null);
  const [updateResult, setUpdateResult] = React.useState<any>(null);
  const [sessions, setSessions] = React.useState<SessionBinding[]>([]);
  const logBox = React.useRef<HTMLDivElement | null>(null);

  const refreshStatus = React.useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s.status);
      setLastError(s.lastError);
      setConfig(s.config);
      setDepsInstalling(s.depsInstalling);
    } catch {
      /* ignore transient errors */
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
      /* ignore */
    }
  }, [api, lastSeq]);

  React.useEffect(() => {
    void refreshStatus();
    void api.listSessions().then(setSessions).catch(() => undefined);
  }, [api, refreshStatus]);

  usePoll(refreshStatus, 2000, true);
  usePoll(refreshLogs, 1000, status === "running" || status === "starting");

  React.useEffect(() => {
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [logs]);

  if (!config) return h("div", { className: "wc-root" }, h("p", { className: "wc-hint" }, "加载中…"));

  const run = (fn: () => Promise<any>) => {
    setBusy(true);
    setNotice(null);
    return fn()
      .then((result) => {
        setNotice({ kind: "success", text: result?.message ?? "完成" });
        void refreshStatus();
      })
      .catch((e) => setNotice({ kind: "error", text: String(e?.message ?? e) }))
      .finally(() => setBusy(false));
  };

  const patch = (p: Partial<Config>) => {
    return api.setConfig(p).then((next) => {
      setConfig(next);
    });
  };

  const statusBadge =
    status === "running"
      ? h("span", { className: "wc-badge wc-badge-running" }, "运行中")
      : status === "starting"
        ? h("span", { className: "wc-badge" }, "启动中")
        : status === "error"
          ? h("span", { className: "wc-badge wc-badge-error" }, "错误")
          : h("span", { className: "wc-badge" }, "已停止");

  return h(
    "div",
    { className: "wc-root" },
    // -- status / control --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "桥接状态"),
      h("div", { className: "wc-row" }, statusBadge, lastError ? h("span", { className: "wc-error" }, lastError) : null),
      h(
        "div",
        { className: "wc-row" },
        h(
          "button",
          { className: "wc-btn wc-btn-primary", disabled: busy || status === "running" || status === "starting", onClick: () => run(() => api.start()) },
          "启动桥接",
        ),
        h("button", { className: "wc-btn", disabled: busy || status === "stopped", onClick: () => run(() => api.stop()) }, "停止桥接"),
        h(
          "button",
          { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.checkDeps()).then(() => api.checkDeps().then(setDepsInfo)) },
          "检查依赖",
        ),
        h(
          "button",
          { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.installDeps()) },
          depsInstalling ? "安装中…" : "安装依赖",
        ),
        notice ? h("span", { className: notice.kind === "error" ? "wc-error" : "wc-success" }, notice.text) : null,
      ),
      depsInfo
        ? h("p", { className: "wc-hint" }, `Python: ${depsInfo.python || "—"} ｜ wechatauto: ${depsInfo.wechatautoVersion || "未安装"}`)
        : null,
    ),

    // -- reply settings --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "回复设置"),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.enabled, onChange: (e: any) => patch({ enabled: e.target.checked }) }),
        h("span", null, "启用自动回复")),
      h("label", { className: "wc-field" },
        h("span", { className: "wc-label" }, "发送通道"),
        h("select", { className: "wc-select", value: config.sendMode, onChange: (e: any) => patch({ sendMode: e.target.value }) },
          h("option", { value: "auto" }, "自动（后台失败回退前台）"),
          h("option", { value: "front" }, "前台 UIA"),
          h("option", { value: "bg" }, "后台 PostMessage"))),
      h("label", { className: "wc-field" },
        h("span", { className: "wc-label" }, "机器人昵称（用于点名/判断 @）"),
        h("input", { className: "wc-input", value: config.botName, placeholder: "小鲸", onChange: (e: any) => patch({ botName: e.target.value }) })),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.private.enabled, onChange: (e: any) => patch({ private: { ...config.private, enabled: e.target.checked } } as any) }),
        h("span", null, "私聊回复")),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.group.enabled, onChange: (e: any) => patch({ group: { ...config.group, enabled: e.target.checked } } as any) }),
        h("span", null, "群聊回复")),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.group.requireAt, onChange: (e: any) => patch({ group: { ...config.group, requireAt: e.target.checked } } as any) }),
        h("span", null, "群聊需 @ / 点名才回复")),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.humanize.splitLongReply, onChange: (e: any) => patch({ humanize: { ...config.humanize, splitLongReply: e.target.checked } } as any) }),
        h("span", null, "长回复拆成多条短气泡")),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.humanize.stripTrailingPunct, onChange: (e: any) => patch({ humanize: { ...config.humanize, stripTrailingPunct: e.target.checked } } as any) }),
        h("span", null, "去掉句尾标点")),
      h("label", { className: "wc-check" },
        h("input", { type: "checkbox", checked: config.humanize.dedupeRepeat, onChange: (e: any) => patch({ humanize: { ...config.humanize, dedupeRepeat: e.target.checked } } as any) }),
        h("span", null, "反鹦鹉学舌去重")),
    ),

    // -- update --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "更新"),
      h("div", { className: "wc-row" },
        h("button", { className: "wc-btn", disabled: busy, onClick: () => run(() => api.checkUpdate().then((r) => { setUpdateResult(r); })) }, "检查更新"),
        updateResult ? h("span", { className: updateResult.hasUpdate ? "wc-error" : "wc-success" }, updateResult.message) : null),
      updateResult ? h("p", { className: "wc-hint" }, `当前 ${updateResult.currentVersion} ｜ 最新 ${updateResult.latestVersion ?? "—"}`) : null,
    ),

    // -- sessions --
    h(
      "div",
      { className: "wc-card" },
      h("h3", null, `会话绑定（${sessions.length}）`),
      sessions.length === 0
        ? h("p", { className: "wc-hint" }, "还没有微信对端绑定到 DSH 会话。收到消息后会自动建立绑定。")
        : h("div", { className: "wc-sessions" },
            sessions.map((s) =>
              h("div", { className: "wc-session-row", key: s.peer },
                h("span", { className: "wc-session-peer" }, s.peer),
                h("span", { className: "wc-session-id" }, s.binding.sessionId),
                h("button", { className: "wc-btn wc-btn-danger", onClick: () => api.unbindSession(s.peer).then(setSessions) }, "解绑"),
              ),
            ),
          ),
    ),

    // -- logs --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-row" },
        h("h3", null, "实时日志"),
        h("button", { className: "wc-btn", onClick: () => setLogs([]) }, "清空")),
      h("div", { className: "wc-log", ref: logBox },
        logs.map((l) =>
          h("div", { className: l.level === "error" ? "error" : l.level === "warn" ? "warn" : "", key: l.seq },
            `[${new Date(l.time).toLocaleTimeString()}] ${l.text}`),
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Persona panel
// ---------------------------------------------------------------------------
export function PersonaPanel(props: { api: Api }) {
  const { api } = props;
  const [config, setConfig] = React.useState<Config | null>(null);
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setConfig(await api.getConfig());
    } catch {
      /* ignore */
    }
  }, [api]);
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!config) return h("div", { className: "wc-root" }, h("p", { className: "wc-hint" }, "加载中…"));

  const persona = config.persona;
  const cards = persona.cards ?? {};
  const names = Object.keys(cards).sort();

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("人设名不能为空");
      return;
    }
    if (!content.trim()) {
      setError("人设内容不能为空");
      return;
    }
    setError(null);
    api.savePersona(trimmed, content).then(() => {
      setNotice(`已保存「${trimmed}」`);
      setName("");
      setContent("");
      setEditing(null);
      void refresh();
    });
  };

  const startEdit = (n: string) => {
    setEditing(n);
    setName(n);
    setContent(cards[n] ?? "");
    setNotice(null);
  };

  return h(
    "div",
    { className: "wc-root" },
    h("p", { className: "wc-hint" }, "人设卡内容会作为系统提示词注入到微信对端对应的 DSH 会话。切换人设后对新会话生效；已有会话在重启后生效。"),

    h(
      "div",
      { className: "wc-card" },
      h("h3", null, editing ? `编辑人设「${editing}」` : "新建人设"),
      h("label", { className: "wc-field" },
        h("span", { className: "wc-label" }, "名称"),
        h("input", { className: "wc-input", value: name, placeholder: "小鲸", onChange: (e: any) => setName(e.target.value) })),
      h("label", { className: "wc-field" },
        h("span", { className: "wc-label" }, "内容（Markdown）"),
        h("textarea", { className: "wc-textarea", value: content, onChange: (e: any) => setContent(e.target.value) })),
      h("div", { className: "wc-row" },
        h("button", { className: "wc-btn wc-btn-primary", onClick: save }, "保存"),
        editing ? h("button", { className: "wc-btn", onClick: () => { setEditing(null); setName(""); setContent(""); } }, "取消编辑") : null,
        notice ? h("span", { className: "wc-success" }, notice) : null,
        error ? h("span", { className: "wc-error" }, error) : null),
    ),

    h(
      "div",
      { className: "wc-card" },
      h("h3", null, "人设卡"),
      names.length === 0
        ? h("p", { className: "wc-hint" }, "还没有人设卡，先在上面新建一个。")
        : h(
            "div",
            { className: "wc-sessions" },
            names.map((n) =>
              h("div", { className: "wc-persona-card", key: n },
                h("span", { className: "wc-persona-name" }, n),
                persona.active === n ? h("span", { className: "wc-badge wc-badge-running" }, "当前") : null,
                h("span", { className: "wc-persona-preview" }, (cards[n] ?? "").split("\n").filter(Boolean)[0] ?? ""),
                persona.active === n
                  ? null
                  : h("button", { className: "wc-btn", onClick: () => api.setActivePersona(n).then(refresh) }, "启用"),
                h("button", { className: "wc-btn", onClick: () => startEdit(n) }, "编辑"),
                h("button", { className: "wc-btn wc-btn-danger", onClick: () => { if (window.confirm(`删除人设「${n}」？`)) api.deletePersona(n).then(refresh); } }, "删除"),
              ),
            ),
          ),
    ),
  );
}
