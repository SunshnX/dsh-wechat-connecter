// 文件式长期记忆（移植自 dsh-soul-md 的核心机制）。
//
// - 注入：ctx.systemPrompt.section({ name: "soul:memory", order: 0.5, text: fn })
//   text 是函数，DSH 每次装配提示词时重新读取记忆文件（切换/写入即时生效）。
// - 工具：memory_read / memory_append / memory_rewrite / memory_search
//   通过 ctx.tools.register(defineTool(...)) 注册，agent 按需读写。
// - 目录：$DSH_HOME/dsh-wechat-connecter/memory/<scope>/{core.md,topics/*.md}
//
// 人设专属（soul_read/soul_update）不在本模块——我们的人设在插件自己的 config.json。

import { appendFileSync, mkdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import {
  createMemoryLayout,
  normalizeMemoryTopic,
  retainMemoryEnds,
  stripTopicIndex,
} from "./memory-layout.js";

const require = createRequire(import.meta.url);

export interface MemoryConfig {
  enabled: boolean;
  inject: boolean;
  layered: boolean;
  injectMaxChars: number;
  maxBytes: number;
  order: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  inject: true,
  layered: true,
  injectMaxChars: 8000,
  maxBytes: 1024 * 1024,
  order: 0.5,
};

/** 消息/工具里统一的记忆作用域：按微信对端 peer 隔离，另设 global 兜底。 */
function scopeOf(agent: any): string {
  try {
    const header = agent?.session?.header;
    // 优先用 session 的 cwd/标题等稳定标识；这里简化为 global，避免与 dsh-im/soul-md 冲突。
    return "global";
  } catch {
    return "global";
  }
}

export function installMemory(ctx: any, getConfig: () => MemoryConfig, logger: { info?: (s: string) => void; warn?: (s: string) => void } = {}) {
  const say = (s: string) => logger.info?.(s);
  const warn = (s: string) => logger.warn?.(s);

  // dsh-tools 是 DSH 主程序自带包；拿不到就只保留注入、不注册工具。
  let defineTool: ((opts: any) => any) | null = null;
  try {
    defineTool = require("@deepseek-ai/dsh-tools").defineTool;
  } catch (error) {
    warn(`[memory] dsh-tools 不可用，记忆工具未注册: ${String(error)}`);
  }

  const memoryDir = () => join(resolveDshHome(), "dsh-wechat-connecter", "memory");
  const fileCache = new Map<string, { mtimeMs: number; text: string }>();

  const readCached = (file: string): string | null => {
    try {
      const st = statSync(file);
      const hit = fileCache.get(file);
      if (hit && hit.mtimeMs === st.mtimeMs) return hit.text;
      const text = readFileSync(file, "utf8");
      fileCache.set(file, { mtimeMs: st.mtimeMs, text });
      return text;
    } catch {
      return null;
    }
  };

  const layout = createMemoryLayout(memoryDir, readCached);
  const cfg = () => ({ ...DEFAULT_MEMORY_CONFIG, ...(getConfig() ?? {}) });
  const layered = () => cfg().layered !== false;
  const byteLen = (s: string) => Buffer.byteLength(s, "utf8");
  const ensureParent = (f: string) => { mkdirSync(dirname(f), { recursive: true }); };

  const scopes = () => ["global"];
  const target = (topic = "") => layout.writeTarget("global", { layered: layered(), topic });
  const readChain = (topic = "") => layout.readChain(scopes(), { layered: layered(), topic });

  // ---- 注入 section -------------------------------------------------------
  const sectionDisposer = ctx.systemPrompt?.section?.({
    name: "soul:memory",
    order: cfg().order,
    text: (_assembly: any) => {
      const c = cfg();
      if (!c.enabled || !c.inject) return "";
      try {
        const { text, index } = readChain();
        if (!text && !index) return "";
        const rendered = [text, index].filter(Boolean).join("\n\n");
        const cap = c.injectMaxChars;
        if (rendered.length <= cap) return rendered;
        return retainMemoryEnds(rendered, cap)
          + "\n\n> 部分记忆未注入，请用 memory_read 读取全文 / part omitted; use memory_read.";
      } catch (error) {
        warn(`[memory] 注入失败: ${String(error)}`);
        return "";
      }
    },
    interpolate: false,
  });

  // ---- 工具注册 -----------------------------------------------------------
  const toolDisposers: Array<() => void> = [];
  const register = (opts: any) => {
    try {
      const d = ctx.tools.register(defineTool!(opts));
      if (typeof d === "function") toolDisposers.push(d);
    } catch (error) {
      warn(`[memory] 注册工具 ${opts.name} 失败: ${String(error)}`);
    }
  };

  if (defineTool && ctx.tools?.register) {
    const renderText = (text: string) => [{ type: "text", text }];

    // memory_read：读取 core（不带 topic）或某个主题全文。
    register({
      name: "memory_read",
      description: "读取长期记忆。不带 topic 读取核心记忆与主题索引；带 topic 读取该主题全文。",
      parameters: { topic: { type: "string", description: "可选主题 key（如 work、family）" } },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            exists: { type: "boolean" },
            content: { type: "string" },
            index: { type: "string" },
            scope: { type: "string" },
            topic: { type: "string" },
          },
        },
        render: (_args: any, value: any) => [
          { type: "text", text: value.exists ? value.content : "记忆为空 / Memory is empty." },
        ],
      },
      isConcurrencySafe: () => true,
      async execute(args: any) {
        const t = normalizeMemoryTopic(args?.topic);
        const { exists, text, index } = readChain(t);
        return {
          exists: Boolean(exists),
          content: text ?? "",
          index: index ?? "",
          scope: scopeOf(null),
          topic: t,
        };
      },
    });

    // memory_append：按日期追加一条记忆。
    register({
      name: "memory_append",
      description: "向长期记忆追加一条带日期的记录。可指定 topic 写入主题文件。",
      parameters: {
        section: { type: "string", required: true, description: "小节标题/主题概要" },
        content: { type: "string", required: true, description: "要记住的内容（Markdown）" },
        topic: { type: "string", description: "可选主题 key" },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            bytes: { type: "integer" },
            topic: { type: "string" },
          },
        },
        render: (_args: any, value: any) => renderText(value.ok ? `已写入记忆（${value.bytes} 字节）` : "写入失败"),
      },
      isConcurrencySafe: () => false,
      async execute(args: any) {
        if (!cfg().enabled) throw new Error("记忆功能已关闭");
        const content = String(args?.content ?? "").trim();
        if (!content) throw new Error("memory_append: content 不能为空");
        const t = normalizeMemoryTopic(args?.topic);
        const d = new Date();
        const p = (n: number) => String(n).padStart(2, "0");
        const heading = `## ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}${args?.section ? ` — ${String(args.section).trim()}` : ""}`;
        const block = `\n${heading}\n\n${content}\n`;
        const dest = target(t);
        const current = readCached(dest.file) ?? "";
        const existing = layered() && !t ? stripTopicIndex(current).text : current;
        if (byteLen(existing + block) > cfg().maxBytes) {
          throw new Error("记忆文件超过 maxBytes 上限，请先用 memory_rewrite 整理");
        }
        ensureParent(dest.file);
        appendFileSync(dest.file, block, "utf8");
        fileCache.delete(dest.file);
        say(`记忆已追加：${dest.file}`);
        return { ok: true, bytes: byteLen(block), topic: t };
      },
    });

    // memory_rewrite：整文件替换（用于整理/合并）。
    register({
      name: "memory_rewrite",
      description: "用新内容整体替换记忆文件（core 或指定 topic），用于整理合并。",
      parameters: {
        content: { type: "string", required: true, description: "新的完整 Markdown 正文" },
        topic: { type: "string", description: "可选主题 key；不带则替换 core" },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" }, bytes: { type: "integer" }, topic: { type: "string" } },
        },
        render: (_args: any, value: any) => renderText(value.ok ? `已重写记忆（${value.bytes} 字节）` : "重写失败"),
      },
      isConcurrencySafe: () => false,
      async execute(args: any) {
        if (!cfg().enabled) throw new Error("记忆功能已关闭");
        const t = normalizeMemoryTopic(args?.topic);
        const body = layered() && !t
          ? stripTopicIndex(String(args?.content ?? "")).text
          : String(args?.content ?? "");
        if (byteLen(body) > cfg().maxBytes) throw new Error("内容超过 maxBytes 上限");
        const dest = target(t);
        ensureParent(dest.file);
        writeFileSync(dest.file, body, "utf8");
        fileCache.delete(dest.file);
        say(`记忆已重写：${dest.file}`);
        return { ok: true, bytes: byteLen(body), topic: t };
      },
    });
  }

  return {
    close() {
      try { sectionDisposer?.(); } catch { /* ignore */ }
      for (const d of toolDisposers) { try { d(); } catch { /* ignore */ } }
    },
    /** 供 RPC 查询记忆目录与大小。 */
    info() {
      return { dir: memoryDir(), layered: layered() };
    },
  };
}
