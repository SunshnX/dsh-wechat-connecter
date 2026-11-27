// Config schema, types, defaults, and disk persistence.
//
// All user-facing configuration lives in a single JSON file under
// `$DSH_HOME/dsh-wechat-connecter/config.json`. The host plugin is the single
// owner of this file; the browser card reads/writes it through the management
// RPC endpoints. This keeps the plugin free of DSH settings-service timing
// subtleties while still surviving restarts.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type SendMode = "front" | "bg" | "auto";

export interface PrivateChatConfig {
  enabled: boolean;
  /** 私聊回复策略：always 始终回复；mention 仅在包含点名/触发词时回复。 */
  replyStrategy: "always" | "mention";
  triggerWords: string[];
}

export interface GroupChatConfig {
  enabled: boolean;
  /** 群聊必须 @ 或点名机器人才回复。 */
  requireAt: boolean;
  /** 额外触发词（机器人昵称等）。 */
  triggerWords: string[];
  /** 话题延续：机器人已参与且话题未结束时继续回复。 */
  topicContinuation: boolean;
}

export interface HumanizeConfig {
  /** 长回复拆成多条短气泡。 */
  splitLongReply: boolean;
  maxBubbleChars: number;
  /** 仅去掉句尾句号（其他标点保留）。 */
  stripTrailingPunct: boolean;
  /** 反鹦鹉学舌去重（去掉复述对方原话的句子）。 */
  dedupeRepeat: boolean;
  /** 回复拆条之间的最小间隔（毫秒）。 */
  bubbleGapMs: number;
  /** 模拟真人打字延迟：发送每条气泡前按字数停顿。 */
  typingDelay: boolean;
  /** 每个字的打字延迟（毫秒）。 */
  typingDelayPerCharMs: number;
  /** 单条消息的打字延迟上限（毫秒）。 */
  typingDelayMaxMs: number;
}

export interface PersonaConfig {
  /** 当前启用的人设卡名；空 = 不注入。 */
  active: string;
  /** 人设卡：name -> markdown。 */
  cards: Record<string, string>;
}

export interface GithubConfig {
  /** 更新检测仓库，例如 owner/repo。 */
  repo: string;
  /** 是否在启动时自动检查更新。 */
  checkUpdate: boolean;
}

export interface ModelConfig {
  /** Provider 路由 id；空 = 跟随默认模型（跟随工作区 / DSH 默认）。 */
  provider: string;
  /** 模型 id；空 = 跟随默认模型。 */
  model: string;
}

export interface WechatConnecterConfig {
  /** 桥接是否启用（决定是否响应消息）。 */
  enabled: boolean;
  /** 插件加载时自动启动桥接。 */
  autoStart: boolean;
  /** 发送通道：front 前台 UIA；bg 后台 PostMessage；auto 后台失败回退前台。 */
  sendMode: SendMode;
  /** 自定义 Python 解释器路径；空 = 自动探测。 */
  pythonPath: string;
  /** 消息轮询间隔（秒）。 */
  pollInterval: number;
  /** 机器人自己的微信昵称（用于判断点名）。 */
  botName: string;
  /** 模型路由：空 = 跟随默认模型。 */
  model: ModelConfig;
  /**
   * 自定义工作区目录（绝对路径）：微信对端新建会话的 cwd，agent 的文件/命令
   * 都在这个目录下执行。空 = 使用默认目录（$DSH_HOME/dsh-wechat-connecter/workspace）。
   */
  workspace: string;
  /** 定时/计划任务在绑定会话里产生的回复，也投递到微信（像 dsh-im 的 deferred delivery）。 */
  scheduledDelivery: boolean;
  /** 自动把会话改名为「微信 · 对端名字」（像 dsh-im 的渠道标题前缀）。 */
  autoRenameTitle: boolean;
  private: PrivateChatConfig;
  group: GroupChatConfig;
  humanize: HumanizeConfig;
  persona: PersonaConfig;
  github: GithubConfig;
}

export const DEFAULT_PERSONA_CARD = `# 角色
你是一个通过微信与朋友聊天的 AI 助手「小鲸」。你自然、真诚、有礼貌，说话轻松口语化，偶尔带一点俏皮。

# 说话风格
- 用简短的口语句子回复，像真人发微信一样。
- 不要长篇大论，不要用 markdown 标题、列表或代码块。
- 适当使用语气词和表情，但不要每句都加。
- 称呼对方时用「你」，不要用「用户」。

# 行为准则
- 尊重隐私，不主动打听对方个人信息。
- 遇到不知道的事情坦诚说明，不要编造。
- 对方情绪低落时先安抚，再给建议。
- 不传播谣言，不输出违法违规内容。`;

export function defaultConfig(): WechatConnecterConfig {
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
    private: {
      enabled: true,
      replyStrategy: "always",
      triggerWords: [],
    },
    group: {
      enabled: true,
      requireAt: true,
      triggerWords: [],
      topicContinuation: false,
    },
    humanize: {
      splitLongReply: true,
      maxBubbleChars: 120,
      stripTrailingPunct: true,
      dedupeRepeat: true,
      bubbleGapMs: 400,
      typingDelay: true,
      typingDelayPerCharMs: 60,
      typingDelayMaxMs: 10000,
    },
    persona: {
      active: "小鲸",
      cards: {
        小鲸: DEFAULT_PERSONA_CARD,
      },
    },
    github: {
      repo: "SunshnX/dsh-wechat-connecter",
      checkUpdate: false,
    },
  };
}

/** Deep-merge a partial user config over the defaults. */
export function normalizeConfig(input: unknown): WechatConnecterConfig {
  const base = defaultConfig();
  if (input == null || typeof input !== "object") return base;
  const u = input as Record<string, unknown>;
  const merged: WechatConnecterConfig = {
    ...base,
    ...u,
    model: { ...base.model, ...(isObj(u.model) ? u.model : {}) },
    private: { ...base.private, ...(isObj(u.private) ? u.private : {}) },
    group: { ...base.group, ...(isObj(u.group) ? u.group : {}) },
    humanize: { ...base.humanize, ...(isObj(u.humanize) ? u.humanize : {}) },
    persona: { ...base.persona, ...(isObj(u.persona) ? u.persona : {}) },
    github: { ...base.github, ...(isObj(u.github) ? u.github : {}) },
  } as WechatConnecterConfig;
  // Coerce enums to valid values.
  if (merged.sendMode !== "front" && merged.sendMode !== "bg" && merged.sendMode !== "auto") {
    merged.sendMode = "auto";
  }
  if (merged.private.replyStrategy !== "always" && merged.private.replyStrategy !== "mention") {
    merged.private.replyStrategy = "always";
  }
  return merged;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export interface ConfigStore {
  config: WechatConnecterConfig;
  configPath: string;
  /** Reload from disk (returns the fresh config). */
  reload(): WechatConnecterConfig;
  /** Persist a full config object (normalized) to disk and update in-memory. */
  save(next: WechatConnecterConfig): WechatConnecterConfig;
  /** Update a subset of top-level fields (shallow merge) and persist. */
  patch(patch: Partial<WechatConnecterConfig>): WechatConnecterConfig;
}

/** Create a config store rooted at `baseDir` (usually $DSH_HOME/dsh-wechat-connecter). */
export function createConfigStore(baseDir: string): ConfigStore {
  const configPath = join(baseDir, "config.json");
  mkdirSync(dirname(configPath), { recursive: true });

  const load = (): WechatConnecterConfig => {
    try {
      if (existsSync(configPath)) {
        const raw = readFileSync(configPath, "utf8");
        return normalizeConfig(JSON.parse(raw));
      }
    } catch (error) {
      // A corrupt config should not take the plugin down; fall back to defaults.
      console.error("[dsh-wechat-connecter] failed to read config:", error);
    }
    return defaultConfig();
  };

  let config = load();

  const store: ConfigStore = {
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
    },
  };
  return store;
}
