// Browser half — combined management page (bridge + persona + model).

import * as React from "react";
import { Api, type Config, type LogLine, type ModelListResult, type SessionBinding, type WorkspaceInfo } from "./api";

const h = React.createElement;

// ---------------------------------------------------------------------------
// Module-level log cache: survives tab switches (component unmount/remount),
// so the log feed keeps polling and never blanks out when navigating away.
// ---------------------------------------------------------------------------
const logCache: { logs: LogLine[]; lastSeq: number } = { logs: [], lastSeq: -1 };

function mergeLogs(existing: LogLine[], incoming: LogLine[]): LogLine[] {
  const bySeq = new Map<number, LogLine>();
  for (const l of existing) bySeq.set(l.seq, l);
  for (const l of incoming) bySeq.set(l.seq, l);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq).slice(-500);
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------
const CSS = `
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

/* 开关 */
.wc-switch{position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0;cursor:pointer}
.wc-switch input{opacity:0;width:0;height:0}
.wc-slider{position:absolute;top:0;left:0;right:0;bottom:0;background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));border-radius:999px;transition:.2s}
.wc-slider::before{content:"";position:absolute;height:16px;width:16px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.2s}
.wc-switch input:checked + .wc-slider{background:var(--dsw-alias-state-business-primary,#3964fe);border-color:var(--dsw-alias-state-business-primary,#3964fe)}
.wc-switch input:checked + .wc-slider::before{transform:translateX(16px)}

/* 设置行 */
.wc-setting{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:7px 0}
.wc-setting-info{display:flex;flex-direction:column;gap:2px}
.wc-setting-title{font-size:13px;line-height:1.5}
.wc-setting-desc{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);line-height:1.5}

/* 表单字段 */
.wc-field{display:flex;flex-direction:column;gap:6px;flex:1;min-width:180px}
.wc-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,#c9c9c9)}
.wc-input,.wc-select,.wc-textarea{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e6e6e6);border-radius:8px;padding:7px 11px;font:inherit;font-size:13px;width:100%;transition:border-color .15s}
.wc-input:focus,.wc-select:focus,.wc-textarea:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#3964fe)}
.wc-select{appearance:none;cursor:pointer}
.wc-textarea{min-height:150px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.7}

/* 日志 */
.wc-log{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:#0d1117;border-radius:10px;padding:10px 12px;font-family:ui-monospace,"SF Mono",Consolas,monospace;font-size:12px;line-height:1.6;height:280px;overflow:auto;white-space:pre-wrap;word-break:break-all}
.wc-log-line{display:block}
.wc-log-time{color:#6e7681;margin-right:8px}
.wc-log .error{color:#ff7b72}
.wc-log .warn{color:#d29922}

/* 会话绑定 */
.wc-sessions{display:flex;flex-direction:column;gap:8px}
.wc-session-row{display:flex;align-items:center;gap:10px;font-size:12px;border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:8px;padding:8px 12px}
.wc-session-peer{font-family:ui-monospace,Consolas,monospace;font-weight:600}
.wc-session-id{color:var(--dsw-alias-label-tertiary,#8a8a8a);font-family:ui-monospace,Consolas,monospace;font-size:11px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 人设卡 */
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

function usePoll(cb: () => void, ms: number) {
  React.useEffect(() => {
    cb();
    const timer = setInterval(cb, ms);
    return () => clearInterval(timer);
  }, [cb, ms]);
}

function Switch(props: { checked: boolean; onChange: (v: boolean) => void }) {
  return h(
    "label",
    { className: "wc-switch" },
    h("input", { type: "checkbox", checked: props.checked, onChange: (e: any) => props.onChange(e.target.checked) }),
    h("span", { className: "wc-slider" }),
  );
}

function SettingRow(props: { title: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return h(
    "div",
    { className: "wc-setting" },
    h(
      "div",
      { className: "wc-setting-info" },
      h("div", { className: "wc-setting-title" }, props.title),
      props.desc ? h("div", { className: "wc-setting-desc" }, props.desc) : null,
    ),
    h(Switch, { checked: props.checked, onChange: props.onChange }),
  );
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function firstLine(md: string): string {
  const line = (md ?? "").split("\n").find((l) => l.trim() && !l.trim().startsWith("#"));
  return line ? line.trim().slice(0, 60) : "";
}

// ---------------------------------------------------------------------------
// Combined panel
// ---------------------------------------------------------------------------
export function WechatPanel(props: { api: Api }) {
  const { api } = props;

  // -- bridge state --
  const [status, setStatus] = React.useState<"stopped" | "starting" | "running" | "error">("stopped");
  const [lastError, setLastError] = React.useState("");
  const [config, setConfig] = React.useState<Config | null>(null);
  const [logs, setLogs] = React.useState<LogLine[]>(logCache.logs);
  const lastSeqRef = React.useRef<number>(logCache.lastSeq);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [depsInstalling, setDepsInstalling] = React.useState(false);
  const [depsInfo, setDepsInfo] = React.useState<any>(null);
  const [updateResult, setUpdateResult] = React.useState<any>(null);
  const [sessions, setSessions] = React.useState<SessionBinding[]>([]);
  const [models, setModels] = React.useState<ModelListResult | null>(null);
  const logBox = React.useRef<HTMLDivElement | null>(null);

  // -- workspace state --
  const [workspaceInfo, setWorkspaceInfo] = React.useState<WorkspaceInfo | null>(null);
  const [workspaceInput, setWorkspaceInput] = React.useState("");
  const [workspaceNotice, setWorkspaceNotice] = React.useState<{ kind: "error" | "success"; text: string } | null>(null);

  // -- persona state --
  const [personaName, setPersonaName] = React.useState("");
  const [personaContent, setPersonaContent] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [personaNotice, setPersonaNotice] = React.useState<string | null>(null);
  const [personaError, setPersonaError] = React.useState<string | null>(null);

  const refreshStatus = React.useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s.status);
      setLastError(s.lastError);
      setConfig(s.config);
      setDepsInstalling(s.depsInstalling);
    } catch {
      /* transient */
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
      /* transient */
    }
  }, [api]);

  React.useEffect(() => {
    void refreshStatus();
    void api.listSessions().then(setSessions).catch(() => undefined);
    void api.listModels().then(setModels).catch(() => undefined);
    void api.workspaceInfo().then((info) => {
      setWorkspaceInfo(info);
      setWorkspaceInput(info.custom);
    }).catch(() => undefined);
  }, [api, refreshStatus]);

  usePoll(refreshStatus, 2000);
  usePoll(refreshLogs, 1000);

  React.useEffect(() => {
    const box = logBox.current;
    if (box && autoScroll) {
      // 用 rAF 确保在 DOM 提交后再滚动到底，避免读到旧 scrollHeight。
      requestAnimationFrame(() => {
        box.scrollTop = box.scrollHeight;
      });
    }
  }, [logs, autoScroll]);

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

  const patch = (p: Partial<Config>) => api.setConfig(p).then(setConfig);

  const badge =
    status === "running"
      ? h("span", { className: "wc-badge wc-badge-running" }, "运行中")
      : status === "starting"
        ? h("span", { className: "wc-badge wc-badge-starting" }, "启动中")
        : status === "error"
          ? h("span", { className: "wc-badge wc-badge-error" }, "错误")
          : h("span", { className: "wc-badge wc-badge-stopped" }, "已停止");

  // -- model select --
  const modelValue = config.model?.provider && config.model?.model ? `${config.model.provider}/${config.model.model}` : "";
  const followLabel = models?.current?.provider
    ? `跟随默认（${models.current.provider} / ${models.current.model}）`
    : "跟随默认（工作区）";
  const onModelChange = (v: string) => {
    if (!v) return patch({ model: { provider: "", model: "" } } as any);
    const idx = v.indexOf("/");
    const provider = v.slice(0, idx);
    const model = v.slice(idx + 1);
    return patch({ model: { provider, model } } as any);
  };

  // -- persona --
  const persona = config.persona ?? {};
  const cards = persona.cards ?? {};
  const cardNames = Object.keys(cards).sort();

  // -- workspace --
  const applyWorkspace = () => {
    setWorkspaceNotice(null);
    api.setWorkspace(workspaceInput)
      .then((info) => {
        setWorkspaceInfo(info);
        setWorkspaceInput(info.custom);
        setWorkspaceNotice({ kind: "success", text: `已应用：${info.effective}` });
        void refreshStatus();
      })
      .catch((e) => setWorkspaceNotice({ kind: "error", text: String(e?.message ?? e) }));
  };
  const resetWorkspace = () => {
    setWorkspaceNotice(null);
    api.setWorkspace("")
      .then((info) => {
        setWorkspaceInfo(info);
        setWorkspaceInput("");
        setWorkspaceNotice({ kind: "success", text: "已恢复默认工作区" });
        void refreshStatus();
      })
      .catch((e) => setWorkspaceNotice({ kind: "error", text: String(e?.message ?? e) }));
  };

  const savePersona = () => {
    const trimmed = personaName.trim();
    if (!trimmed) return setPersonaError("人设名不能为空");
    if (!personaContent.trim()) return setPersonaError("人设内容不能为空");
    setPersonaError(null);
    api.savePersona(trimmed, personaContent).then(() => {
      setPersonaNotice(`已保存「${trimmed}」`);
      setPersonaName("");
      setPersonaContent("");
      setEditing(null);
      void refreshStatus();
    });
  };

  const startEdit = (n: string) => {
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
      h("div", { className: "wc-card-title" }, "桥接状态"),
      h("div", { className: "wc-row" }, badge, lastError ? h("span", { className: "wc-error" }, lastError) : null),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn wc-btn-primary", disabled: busy || status === "running" || status === "starting", onClick: () => run(() => api.start()) }, "启动桥接"),
        h("button", { className: "wc-btn", disabled: busy || status === "stopped", onClick: () => run(() => api.stop()) }, "停止桥接"),
        h("button", { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.checkDeps().then(setDepsInfo)) }, "检查依赖"),
        h("button", { className: "wc-btn", disabled: busy || depsInstalling, onClick: () => run(() => api.installDeps()) }, depsInstalling ? "安装中…" : "安装依赖"),
        notice ? h("span", { className: notice.kind === "error" ? "wc-error" : "wc-success" }, notice.text) : null,
      ),
      depsInfo
        ? h("p", { className: "wc-hint" }, `Python: ${depsInfo.python || "—"} ｜ wechatauto: ${depsInfo.wechatautoVersion || "未安装"}`)
        : null,
    ),

    // -- 回复设置 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "回复设置"),
      h(SettingRow, { title: "启动 DSH 自动启动桥接", desc: "打开 DSH 后自动拉起 Python 桥接进程", checked: config.autoStart, onChange: (v) => patch({ autoStart: v }) }),
      h(SettingRow, { title: "启用自动回复", desc: "关闭后插件只收不发", checked: config.enabled, onChange: (v) => patch({ enabled: v }) }),
      h(SettingRow, { title: "定时任务投递", desc: "定时/计划任务在绑定会话里的回复也发到微信", checked: config.scheduledDelivery, onChange: (v) => patch({ scheduledDelivery: v }) }),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "模型"),
        h(
          "select",
          { className: "wc-select", value: modelValue, onChange: (e: any) => onModelChange(e.target.value) },
          h("option", { value: "" }, followLabel),
          ...(models?.groups ?? []).map((g) =>
            h(
              "optgroup",
              { label: g.name, key: g.id },
              ...g.models.map((m) => h("option", { value: `${g.id}/${m.id}`, key: m.id }, m.name)),
            ),
          ),
        ),
      ),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "发送通道"),
        h(
          "select",
          { className: "wc-select", value: config.sendMode, onChange: (e: any) => patch({ sendMode: e.target.value }) },
          h("option", { value: "auto" }, "自动（后台失败回退前台）"),
          h("option", { value: "front" }, "前台 UIA"),
          h("option", { value: "bg" }, "后台 PostMessage"),
        ),
      ),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "机器人昵称（用于判断 @ / 点名）"),
        h("input", { className: "wc-input", value: config.botName, placeholder: "小鲸", onChange: (e: any) => patch({ botName: e.target.value }) }),
      ),
      h(SettingRow, { title: "私聊回复", checked: config.private.enabled, onChange: (v) => patch({ private: { ...config.private, enabled: v } } as any) }),
      h(SettingRow, { title: "群聊回复", checked: config.group.enabled, onChange: (v) => patch({ group: { ...config.group, enabled: v } } as any) }),
      h(SettingRow, { title: "群聊需 @ / 点名才回复", checked: config.group.requireAt, onChange: (v) => patch({ group: { ...config.group, requireAt: v } } as any) }),
      h(SettingRow, { title: "长回复拆成多条短气泡", desc: "像真人发微信一样分段", checked: config.humanize.splitLongReply, onChange: (v) => patch({ humanize: { ...config.humanize, splitLongReply: v } } as any) }),
      h(SettingRow, { title: "仅去掉句尾句号", desc: "其他标点保留", checked: config.humanize.stripTrailingPunct, onChange: (v) => patch({ humanize: { ...config.humanize, stripTrailingPunct: v } } as any) }),
      h(SettingRow, { title: "反鹦鹉学舌去重", desc: "不重复对方原话", checked: config.humanize.dedupeRepeat, onChange: (v) => patch({ humanize: { ...config.humanize, dedupeRepeat: v } } as any) }),
      h(SettingRow, { title: "模拟真人打字延迟", desc: "发送前按字数停顿，模拟真人逐字输入", checked: config.humanize.typingDelay, onChange: (v) => patch({ humanize: { ...config.humanize, typingDelay: v } } as any) }),
      config.humanize.typingDelay
        ? h(
            "div",
            { className: "wc-row" },
            h(
              "div",
              { className: "wc-field" },
              h("span", { className: "wc-label" }, "每字延迟 (ms)"),
              h("input", {
                className: "wc-input",
                type: "number",
                min: 0,
                step: 10,
                value: config.humanize.typingDelayPerCharMs,
                onChange: (e: any) => patch({ humanize: { ...config.humanize, typingDelayPerCharMs: Math.max(0, Number(e.target.value) || 0) } } as any),
              }),
            ),
            h(
              "div",
              { className: "wc-field" },
              h("span", { className: "wc-label" }, "单条上限 (ms)"),
              h("input", {
                className: "wc-input",
                type: "number",
                min: 0,
                step: 500,
                value: config.humanize.typingDelayMaxMs,
                onChange: (e: any) => patch({ humanize: { ...config.humanize, typingDelayMaxMs: Math.max(0, Number(e.target.value) || 0) } } as any),
              }),
            ),
          )
        : null,
      config.humanize.typingDelay
        ? h("p", { className: "wc-hint" }, `例：100 字 ≈ ${Math.min(100 * config.humanize.typingDelayPerCharMs, config.humanize.typingDelayMaxMs) / 1000}s 后发出`)
        : null,
    ),

    // -- 工作区 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "工作区"),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "自定义工作区目录（绝对路径，留空 = 默认）"),
        h("input", {
          className: "wc-input",
          value: workspaceInput,
          placeholder: workspaceInfo?.default ?? "",
          spellCheck: false,
          onChange: (e: any) => setWorkspaceInput(e.target.value),
          onKeyDown: (e: any) => { if (e.key === "Enter") applyWorkspace(); },
        }),
      ),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn wc-btn-primary", onClick: applyWorkspace }, "应用"),
        h("button", { className: "wc-btn", onClick: resetWorkspace }, "恢复默认"),
        workspaceNotice ? h("span", { className: workspaceNotice.kind === "error" ? "wc-error" : "wc-success" }, workspaceNotice.text) : null,
      ),
      h(
        "p",
        { className: "wc-hint" },
        `当前生效：${workspaceInfo?.effective ?? "…"}` +
        (workspaceInfo?.custom ? "" : `（默认）`) +
        ` ｜ 微信对端新建会话会在此目录下运行；修改只影响之后新建的会话，已有会话保持原目录。`,
      ),
    ),

    // -- 更新 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "更新"),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn", disabled: busy, onClick: () => run(() => api.checkUpdate().then((r) => setUpdateResult(r))) }, "检查更新"),
        updateResult ? h("span", { className: updateResult.hasUpdate ? "wc-error" : "wc-success" }, updateResult.message) : null,
      ),
      updateResult
        ? h("p", { className: "wc-hint" }, `当前 ${updateResult.currentVersion} ｜ 最新 ${updateResult.latestVersion ?? "—"}${updateResult.url ? ` ｜ ${updateResult.url}` : ""}`)
        : null,
    ),

    // -- 会话绑定 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, `会话绑定（${sessions.length}）`),
      sessions.length === 0
        ? h("p", { className: "wc-hint" }, "还没有微信对端绑定到 DSH 会话。收到消息后会自动建立绑定。")
        : h(
            "div",
            { className: "wc-sessions" },
            sessions.map((s) =>
              h(
                "div",
                { className: "wc-session-row", key: s.peer },
                h("span", { className: "wc-session-peer" }, s.peer),
                h("span", { className: "wc-session-id" }, s.binding.sessionId),
                h("button", {
                  className: "wc-btn wc-btn-danger",
                  title: "清空后，下次该对端发消息会用全新会话，之前的聊天记忆不再保留",
                  onClick: () => {
                    if (window.confirm(`清空与「${s.peer}」的对话记忆？\n\n该对端下次发消息会开启全新会话，之前的上下文将不再保留。`)) {
                      api.clearMemory(s.peer)
                        .then((list) => { setSessions(list); void refreshStatus(); })
                        .catch((e) => window.alert(String(e?.message ?? e)));
                    }
                  },
                }, "清空记忆"),
                h("button", { className: "wc-btn wc-btn-danger", onClick: () => api.unbindSession(s.peer).then(setSessions) }, "解绑"),
              ),
            ),
          ),
      sessions.length > 0
        ? h("p", { className: "wc-hint" }, "「清空记忆」会让该对端下次发消息时开启全新会话，此前上下文不再保留（正在回复时无法清空）。")
        : null,
    ),

    // -- 人设管理 --
    h(
      "div",
      { className: "wc-card" },
      h("div", { className: "wc-card-title" }, "人设管理"),
      h("p", { className: "wc-hint" }, "人设卡内容会作为系统提示词注入到微信对端对应的 DSH 会话。切换人设后对新会话生效；已有会话在重启后生效。"),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, editing ? `编辑人设「${editing}」— 名称` : "新建人设 — 名称"),
        h("input", { className: "wc-input", value: personaName, placeholder: "小鲸", onChange: (e: any) => setPersonaName(e.target.value) }),
      ),
      h(
        "div",
        { className: "wc-field" },
        h("span", { className: "wc-label" }, "内容（Markdown）"),
        h("textarea", { className: "wc-textarea", value: personaContent, onChange: (e: any) => setPersonaContent(e.target.value) }),
      ),
      h(
        "div",
        { className: "wc-actions" },
        h("button", { className: "wc-btn wc-btn-primary", onClick: savePersona }, "保存人设"),
        editing
          ? h("button", { className: "wc-btn", onClick: () => { setEditing(null); setPersonaName(""); setPersonaContent(""); } }, "取消编辑")
          : null,
        personaNotice ? h("span", { className: "wc-success" }, personaNotice) : null,
        personaError ? h("span", { className: "wc-error" }, personaError) : null,
      ),
      cardNames.length === 0
        ? h("p", { className: "wc-hint" }, "还没有人设卡，先在上面新建一个。")
        : h(
            "div",
            { className: "wc-sessions" },
            cardNames.map((n) =>
              h(
                "div",
                { className: "wc-persona-card", key: n },
                h(
                  "div",
                  { className: "wc-persona-main" },
                  h(
                    "div",
                    { className: "wc-persona-title" },
                    h("span", { className: "wc-persona-name" }, n),
                    persona.active === n ? h("span", { className: "wc-badge wc-badge-running" }, "当前") : null,
                  ),
                  h("div", { className: "wc-persona-preview" }, firstLine(cards[n])),
                ),
                h(
                  "div",
                  { className: "wc-persona-actions" },
                  persona.active === n
                    ? null
                    : h("button", { className: "wc-btn", onClick: () => api.setActivePersona(n).then(refreshStatus) }, "启用"),
                  h("button", { className: "wc-btn", onClick: () => startEdit(n) }, "编辑"),
                  h("button", { className: "wc-btn wc-btn-danger", onClick: () => { if (window.confirm(`删除人设「${n}」？`)) api.deletePersona(n).then(refreshStatus); } }, "删除"),
                ),
              ),
            ),
          ),
    ),

    // -- 实时日志 --
    h(
      "div",
      { className: "wc-card" },
      h(
        "div",
        { className: "wc-card-title", style: { justifyContent: "space-between" } },
        "实时日志",
        h(
          "div",
          { className: "wc-actions" },
          h(
            "label",
            { className: "wc-autoscroll", title: "新日志自动滚动到底部" },
            h("span", null, "自动滚动"),
            h(Switch, { checked: autoScroll, onChange: setAutoScroll }),
          ),
          h("button", { className: "wc-btn", onClick: () => { logCache.logs = []; setLogs([]); } }, "清空"),
        ),
      ),
      h(
        "div",
        { className: "wc-log", ref: logBox },
        logs.length === 0
          ? h("span", { className: "wc-log-line", style: { color: "#6e7681" } }, "暂无日志。启动桥接后会在这里实时显示。")
          : logs.map((l) =>
              h(
                "div",
                { className: "wc-log-line" + (l.level === "error" ? " error" : l.level === "warn" ? " warn" : ""), key: l.seq },
                h("span", { className: "wc-log-time" }, `[${fmtTime(l.time)}]`),
                l.text,
              ),
            ),
      ),
    ),
  );
}
