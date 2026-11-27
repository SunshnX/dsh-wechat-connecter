// dsh-wechat-connecter — host half.
//
// Turns WeChat into a DeepSeek Harness chat client:
//   1. A local Python sidecar reads/sends WeChat messages.
//   2. Each WeChat peer (private contact or group) maps to one DSH session.
//   3. Inbound messages are fed to the DSH agent via `agent.followup()`;
//      the reply is captured after the agent goes idle, humanized, and sent.
//   4. Persona presets are injected as a scoped system-prompt section.
//   5. A management RPC surface drives the browser settings card.

import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import z from "@deepseek-ai/schemastery";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";

const require = createRequire(import.meta.url);
const PLUGIN_VERSION: string = (require("../package.json") as { version?: string }).version ?? "0.0.0";
import { createConfigStore, type WechatConnecterConfig } from "./config";
import { createSessionMapStore, type SessionMapStore, type PeerType } from "./session-map";
import { activePersonaText } from "./persona";
import { humanizeReply, shouldReply } from "./reply";
import { BridgeProcess, type InboundMessage, type LogLine } from "./bridge";
import { checkDeps, installDeps, resolvePython } from "./deps";

const name = "dsh-wechat-connecter";
const inject = ["connection"] as string[];

// ---------------------------------------------------------------------------
// Config schema (for the DSH config editor / form auto-generation reference).
// Actual storage is the plugin's own config.json; see config.ts.
// ---------------------------------------------------------------------------
const Config = z
  .object({
    enabled: z.boolean().default(false),
    autoStart: z.boolean().default(false),
    sendMode: z.union([z.const("front"), z.const("bg"), z.const("auto")]).default("auto"),
    pythonPath: z.string().default(""),
    pollInterval: z.number().default(0.5),
    botName: z.string().default(""),
    private: z
      .object({
        enabled: z.boolean().default(true),
        replyStrategy: z.union([z.const("always"), z.const("mention")]).default("always"),
        triggerWords: z.array(z.string()).default([]),
      })
      .default({ enabled: true, replyStrategy: "always", triggerWords: [] }),
    group: z
      .object({
        enabled: z.boolean().default(true),
        requireAt: z.boolean().default(true),
        triggerWords: z.array(z.string()).default([]),
        topicContinuation: z.boolean().default(false),
      })
      .default({ enabled: true, requireAt: true, triggerWords: [], topicContinuation: false }),
    humanize: z
      .object({
        splitLongReply: z.boolean().default(true),
        maxBubbleChars: z.number().default(120),
        stripTrailingPunct: z.boolean().default(true),
        dedupeRepeat: z.boolean().default(true),
        bubbleGapMs: z.number().default(400),
      })
      .default({
        splitLongReply: true,
        maxBubbleChars: 120,
        stripTrailingPunct: true,
        dedupeRepeat: true,
        bubbleGapMs: 400,
      }),
    persona: z
      .object({
        active: z.string().default("小鲸"),
        cards: z.dict(z.string(), z.string()).default({}),
      })
      .default({ active: "小鲸", cards: {} }),
    github: z
      .object({
        repo: z.string().default("SunshnX/dsh-wechat-connecter"),
        checkUpdate: z.boolean().default(false),
      })
      .default({ repo: "SunshnX/dsh-wechat-connecter", checkUpdate: false }),
  })
  .volatile();

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
function apply(ctx: any, _config: unknown) {
  const logger = (ctx.logger ? ctx.logger(name) : null) ?? console;
  const dataDir = join(resolveDshHome(), name);
  const workspaceDir = join(dataDir, "workspace");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(workspaceDir, { recursive: true });

  const store = createConfigStore(dataDir);
  const sessionMap: SessionMapStore = createSessionMapStore(dataDir);

  const bridge = new BridgeProcess(store.config);
  const handles = new Map<string, { agent: any; dispose(): Promise<void> }>();
  const peerQueues = new Map<string, Promise<unknown>>();
  const lastReplied = new Map<string, number>();
  let depsInstalling = false;
  let depsResult: { ok: boolean; message: string } | null = null;

  const log = (level: LogLine["level"], text: string) => bridge.log(level, text);

  // -- agent creation / resume ---------------------------------------------
  const setup = (agentCtx: any) => {
    const text = activePersonaText(store.config);
    if (!text) return;
    const sp = agentCtx?.systemPrompt ?? agentCtx?.get?.("systemPrompt");
    if (sp && typeof sp.section === "function") {
      sp.section({ name: "wechat-persona", order: 100, text, interpolate: false });
    }
  };

  async function getOrCreateAgent(peer: string, peerType: PeerType, displayName: string) {
    const existing = sessionMap.get(peer);
    if (existing) {
      try {
        const handle = await ctx.get("agents").resume({
          resumeSessionId: existing.sessionId,
          setup,
        });
        handles.set(peer, handle);
        return handle;
      } catch (error) {
        logger.warn(`[${name}] resume ${peer} 失败，将新建会话: ${String(error)}`);
        sessionMap.remove(peer);
      }
    }
    const sessionId = randomUUID();
    const handle = await ctx.get("agents").create({
      sessionId,
      meta: { cwd: workspaceDir },
      setup,
    });
    sessionMap.set(peer, { sessionId, peerType, displayName, lastSeen: Date.now() });
    handles.set(peer, handle);
    return handle;
  }

  function extractLastAssistantText(agent: any): string {
    try {
      const messages = agent.session.deriveMessages?.() ?? [];
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.role === "assistant") {
          const text = (m.content ?? [])
            .filter((b: any) => b?.type === "text")
            .map((b: any) => b.text)
            .join("\n")
            .trim();
          if (text) return text;
        }
      }
    } catch (error) {
      logger.warn(`[${name}] extract reply failed: ${String(error)}`);
    }
    return "";
  }

  function assistantCount(agent: any): number {
    try {
      const messages = agent.session.deriveMessages?.() ?? [];
      let n = 0;
      for (const m of messages) if (m?.role === "assistant") n += 1;
      return n;
    } catch {
      return 0;
    }
  }

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), ms);
      promise.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // -- inbound pipeline ------------------------------------------------------
  async function processMessage(peer: string, peerType: PeerType, msg: InboundMessage) {
    try {
      const handle = await getOrCreateAgent(peer, peerType, msg.displayName);
      const agent = handle.agent;

      const inboundText = buildInboundText(peerType, msg);
      const before = assistantCount(agent);
      agent.followup({
        id: randomUUID(),
        role: "user",
        content: [{ type: "text", text: inboundText }],
        source: { kind: "user" },
      });

      try {
        await withTimeout(agent.whenIdle(), 180_000);
      } catch {
        // Timeout / pending approval — do not send a partial reply.
        logger.warn(`[${name}] ${peer} 等待回复超时，跳过本轮发送`);
        return;
      }

      // Only send when the turn actually produced a new assistant message,
      // otherwise the "last assistant message" would be a stale one.
      if (assistantCount(agent) <= before) return;

      const replyText = extractLastAssistantText(agent);
      if (!replyText) return;

      const bubbles = humanizeReply(store.config, replyText, msg.content);
      for (const bubble of bubbles) {
        bridge.sendText(peer, bubble);
        if (store.config.humanize.bubbleGapMs > 0) await sleep(store.config.humanize.bubbleGapMs);
      }
      lastReplied.set(peer, Date.now());
      sessionMap.touch(peer);
    } catch (error) {
      logger.error(`[${name}] 处理消息失败 (${peer}): ${String(error)}`);
    }
  }

  function buildInboundText(peerType: PeerType, msg: InboundMessage): string {
    if (peerType === "group") {
      const sender = msg.senderName || msg.senderId || "群友";
      return `[群聊消息] ${sender} 说：${msg.content}`;
    }
    return msg.content;
  }

  function handleInbound(msg: InboundMessage) {
    if (!store.config.enabled) return;
    if (msg.peerType === "self" || msg.peerType === "system") return;
    if (!msg.username) return;
    const peerType: PeerType = msg.peerType === "group" ? "group" : "contact";
    const peer = msg.username;

    const meta = {
      peerType,
      content: msg.content ?? "",
      isAt: Boolean(msg.isAt),
      botName: store.config.botName,
      botParticipatedRecently:
        (lastReplied.get(peer) ?? 0) > Date.now() - 10 * 60 * 1000,
    };
    if (!shouldReply(store.config, meta)) return;

    const prev = peerQueues.get(peer) ?? Promise.resolve();
    const next = prev.then(() => processMessage(peer, peerType, msg)).catch(() => undefined);
    peerQueues.set(peer, next);
  }

  bridge.onMessage = handleInbound;

  // -- bridge control --------------------------------------------------------
  async function startBridge(): Promise<{ ok: boolean; message: string; python?: string }> {
    if (bridge.status === "running" || bridge.status === "starting") {
      return { ok: true, message: "桥接已在运行。" };
    }
    const resolved = await resolvePython(store.config);
    if (!resolved) {
      return { ok: false, message: "未找到可用的 Python 解释器（建议 Python 3.13）。" };
    }
    const deps = await checkDeps(store.config);
    if (!deps.wechatautoInstalled) {
      logger.warn(`[${name}] 依赖未安装（${deps.message}），请先安装依赖。`);
      return { ok: false, message: "wechatauto 未安装，请先点击「安装依赖」。", python: resolved.python };
    }
    bridge.start(resolved.python);
    return { ok: true, message: "桥接启动中…", python: resolved.python };
  }

  function stopBridge(): { ok: boolean; message: string } {
    bridge.stop();
    return { ok: true, message: "桥接已停止。" };
  }

  // -- management RPC --------------------------------------------------------
  const RPC_ENDPOINT = `${name}/management`;

  async function rpcHandle(method: string, payload: any): Promise<{ ok: boolean; value?: any; error?: { code: string; message: string; details?: object } }> {
    const fail = (code: string, message: string) => ({ ok: false, error: { code, message, details: {} } });
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
              config: store.config,
            },
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
          if (depsInstalling) return { ok: true, value: { running: true, message: "依赖安装进行中…" } };
          depsInstalling = true;
          depsResult = null;
          void installDeps(store.config, (line) => log("info", line)).then((result) => {
            depsInstalling = false;
            depsResult = result;
          });
          return { ok: true, value: { running: true, message: "依赖安装已开始。" } };
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
          if (!cardName) return fail("bad-request", "人设名不能为空。");
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
              void handle.dispose().catch(() => undefined);
              handles.delete(peer);
            }
          }
          return { ok: true, value: sessionMap.list() };
        }
        case "update.check": {
          const value = await checkForUpdate(store.config.github.repo);
          return { ok: true, value };
        }
        default:
          return fail("unknown-method", `未知方法: ${method}`);
      }
    } catch (error) {
      return fail("internal", String(error));
    }
  }

  async function checkForUpdate(repo: string) {
    const version = PLUGIN_VERSION;
    if (!repo || !repo.includes("/")) {
      return { repo, currentVersion: version, latestVersion: null, hasUpdate: false, message: "未配置 GitHub 仓库。" };
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "dsh-wechat-connecter" },
      });
      if (!res.ok) {
        return { repo, currentVersion: version, latestVersion: null, hasUpdate: false, message: `GitHub API ${res.status}` };
      }
      const data = (await res.json()) as { tag_name?: string; html_url?: string };
      const latest = String(data.tag_name ?? "").replace(/^v/, "");
      const hasUpdate = Boolean(latest) && latest !== version;
      return { repo, currentVersion: version, latestVersion: latest || null, hasUpdate, url: data.html_url, message: hasUpdate ? `发现新版本 ${latest}` : "已是最新版本。" };
    } catch (error) {
      return { repo, currentVersion: version, latestVersion: null, hasUpdate: false, message: String(error) };
    }
  }

  // -- lifecycle -------------------------------------------------------------
  let rpcDispose: (() => Promise<void>) | null = null;
  try {
    const connection = ctx.connection ?? ctx.get?.("connection");
    if (connection?.fetch && typeof connection.fetch.register === "function") {
      rpcDispose = connection.fetch.register({
        path: `/api/${RPC_ENDPOINT}`,
        methods: ["POST"],
        requestBody: "buffered",
        async fetch(request: Request) {
          if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
          let body: any;
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
        },
      });
      logger.info(`[${name}] 管理 RPC 已注册: /api/${RPC_ENDPOINT}`);
    } else {
      logger.warn(`[${name}] connection.fetch 不可用，管理 UI 的 RPC 将无法使用。`);
    }
  } catch (error) {
    logger.warn(`[${name}] 注册管理 RPC 失败: ${String(error)}`);
  }

  ctx.effect(() => {
    // Auto-start if configured.
    if (store.config.autoStart && store.config.enabled) {
      void startBridge();
    }
    return () => {
      bridge.stop();
      void rpcDispose?.();
      for (const handle of handles.values()) {
        void handle.dispose().catch(() => undefined);
      }
      handles.clear();
      sessionMap.flush();
    };
  }, `${name}.lifecycle()`);
}

export { apply, inject, name, Config };
