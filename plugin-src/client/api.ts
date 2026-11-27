// Browser half — RPC client helpers and shared types.

export const RPC_ENDPOINT = "dsh-wechat-connecter/management";

export interface RpcConnection {
  rpc: {
    call(scope: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<any>;
  };
}

export interface BridgeStatus {
  status: "stopped" | "starting" | "running" | "error";
  lastError: string;
  enabled: boolean;
  depsInstalling: boolean;
  depsResult: { ok: boolean; message: string } | null;
  config: Config;
}

export interface Config {
  enabled: boolean;
  autoStart: boolean;
  sendMode: "front" | "bg" | "auto";
  pythonPath: string;
  pollInterval: number;
  botName: string;
  model: { provider: string; model: string };
  workspace: string;
  scheduledDelivery: boolean;
  private: {
    enabled: boolean;
    replyStrategy: "always" | "mention";
    triggerWords: string[];
  };
  group: {
    enabled: boolean;
    requireAt: boolean;
    triggerWords: string[];
    topicContinuation: boolean;
  };
  humanize: {
    splitLongReply: boolean;
    maxBubbleChars: number;
    stripTrailingPunct: boolean;
    dedupeRepeat: boolean;
    bubbleGapMs: number;
    typingDelay: boolean;
    typingDelayPerCharMs: number;
    typingDelayMaxMs: number;
  };
  persona: {
    active: string;
    cards: Record<string, string>;
  };
  github: {
    repo: string;
    checkUpdate: boolean;
  };
}

export interface LogLine {
  seq: number;
  time: number;
  level: "info" | "warn" | "error" | "debug";
  text: string;
}

export interface LogsResult {
  logs: LogLine[];
  lastSeq: number;
}

export interface UpdateCheckResult {
  repo: string;
  currentVersion: string;
  latestVersion: string | null;
  hasUpdate: boolean;
  url?: string;
  message: string;
}

export interface ModelGroup {
  id: string;
  name: string;
  models: { id: string; name: string }[];
}

export interface ModelListResult {
  groups: ModelGroup[];
  current: { provider: string; model: string };
  selected: { provider: string; model: string };
}

export interface WorkspaceInfo {
  custom: string;
  effective: string;
  default: string;
}

export interface SessionBinding {
  peer: string;
  binding: {
    sessionId: string;
    peerType: "contact" | "group";
    displayName: string;
    lastSeen: number;
  };
}

export class Api {
  constructor(private connection: RpcConnection) {}

  async call<T = any>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
    const result = await this.connection.rpc.call("/api", RPC_ENDPOINT, { method, payload });
    if (!result || typeof result !== "object" || typeof (result as any).ok !== "boolean") {
      throw new Error("RPC 响应格式错误");
    }
    if ((result as any).ok !== true) {
      const error = (result as any).error;
      throw new Error(error?.message ?? error?.code ?? "RPC 调用失败");
    }
    return (result as any).value as T;
  }

  status(): Promise<BridgeStatus> {
    return this.call("bridge.status");
  }
  start(): Promise<{ ok: boolean; message: string; python?: string }> {
    return this.call("bridge.start");
  }
  stop(): Promise<{ ok: boolean; message: string }> {
    return this.call("bridge.stop");
  }
  logs(afterSeq: number): Promise<LogsResult> {
    return this.call("bridge.logs", { afterSeq });
  }
  checkDeps(): Promise<any> {
    return this.call("bridge.deps.check");
  }
  installDeps(): Promise<{ running: boolean; message: string }> {
    return this.call("bridge.deps.install");
  }
  getConfig(): Promise<Config> {
    return this.call("config.get");
  }
  setConfig(patch: Partial<Config>): Promise<Config> {
    return this.call("config.set", { patch });
  }
  savePersona(name: string, content: string): Promise<Config["persona"]> {
    return this.call("persona.save", { name, content });
  }
  deletePersona(name: string): Promise<Config["persona"]> {
    return this.call("persona.delete", { name });
  }
  setActivePersona(name: string): Promise<Config["persona"]> {
    return this.call("persona.setActive", { name });
  }
  listSessions(): Promise<SessionBinding[]> {
    return this.call("sessions.list");
  }
  unbindSession(peer: string): Promise<SessionBinding[]> {
    return this.call("sessions.unbind", { peer });
  }
  checkUpdate(): Promise<UpdateCheckResult> {
    return this.call("update.check");
  }
  listModels(): Promise<ModelListResult> {
    return this.call("model.list");
  }
  workspaceInfo(): Promise<WorkspaceInfo> {
    return this.call("workspace.info");
  }
  setWorkspace(workspace: string): Promise<WorkspaceInfo> {
    return this.call("workspace.set", { workspace });
  }
}
