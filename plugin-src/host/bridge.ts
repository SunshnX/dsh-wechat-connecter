// Python sidecar process management (spawn / stop / log ring buffer / JSON
// line protocol over stdin/stdout).

import { spawn, type ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { WechatConnecterConfig, SendMode } from "./config";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type BridgeStatus = "stopped" | "starting" | "running" | "error";

export interface InboundMessage {
  type: "message";
  peerType: "contact" | "group" | "self" | "system";
  username: string;
  displayName: string;
  senderId?: string;
  senderName?: string;
  content: string;
  isAt?: boolean;
  messageType?: string;
  localId?: number | string;
  createTime?: number;
}

export interface BridgeEvent {
  event: string;
  [key: string]: unknown;
}

export interface LogLine {
  seq: number;
  time: number;
  level: "info" | "warn" | "error" | "debug";
  text: string;
}

const MAX_LOG_LINES = 500;

export class BridgeProcess {
  private child: ChildProcess | null = null;
  private logs: LogLine[] = [];
  private logSeq = 0;
  private _status: BridgeStatus = "stopped";
  private _lastError = "";
  private bridgeDir: string;
  private config: WechatConnecterConfig;

  onMessage: ((msg: InboundMessage) => void) | null = null;
  onStatusChange: ((status: BridgeStatus) => void) | null = null;
  onLog: ((line: LogLine) => void) | null = null;

  constructor(config: WechatConnecterConfig, bridgeDir?: string) {
    this.config = config;
    this.bridgeDir = bridgeDir ?? join(__dirname, "..", "bridge");
  }

  get status(): BridgeStatus {
    return this._status;
  }

  get lastError(): string {
    return this._lastError;
  }

  get logLines(): LogLine[] {
    return this.logs;
  }

  private setStatus(status: BridgeStatus) {
    if (this._status === status) return;
    this._status = status;
    this.onStatusChange?.(status);
  }

  private pushLog(level: LogLine["level"], text: string) {
    const line: LogLine = { seq: this.logSeq++, time: Date.now(), level, text };
    this.logs.push(line);
    if (this.logs.length > MAX_LOG_LINES) this.logs.splice(0, this.logs.length - MAX_LOG_LINES);
    this.onLog?.(line);
  }

  /** Append a log line to the ring buffer from host-side code. */
  log(level: LogLine["level"], text: string) {
    this.pushLog(level, text);
  }

  start(pythonPath: string): void {
    if (this.child) return;
    this.setStatus("starting");
    const configJson = JSON.stringify({
      sendMode: this.config.sendMode,
      pollInterval: this.config.pollInterval,
      botName: this.config.botName,
      bridgeDir: this.bridgeDir,
    });

    let child: ChildProcess;
    try {
      child = spawn(pythonPath, [join(this.bridgeDir, "main.py"), configJson], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
      });
    } catch (error) {
      this._lastError = String(error);
      this.setStatus("error");
      this.pushLog("error", `启动桥接失败: ${error}`);
      return;
    }
    this.child = child;
    this.pushLog("info", `启动 Python 桥接: ${pythonPath}`);

    child.stdout?.on("data", (data: Buffer) => this.handleStdout(data.toString()));
    child.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) {
        if (line.trim()) this.pushLog("error", line);
      }
    });
    child.on("error", (error) => {
      this._lastError = String(error);
      this.setStatus("error");
      this.pushLog("error", `桥接进程错误: ${error}`);
    });
    child.on("close", (code) => {
      this.pushLog("info", `桥接进程退出（code=${code}）`);
      this.child = null;
      this.setStatus("stopped");
    });
  }

  private handleStdout(chunk: string) {
    for (const raw of chunk.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      this.handleEvent(line);
    }
  }

  private handleEvent(line: string) {
    try {
      const event = JSON.parse(line) as BridgeEvent;
      if (!event || typeof event.event !== "string") throw new Error("no event");
      switch (event.event) {
        case "ready":
          this.setStatus("running");
          this.pushLog("info", `微信桥接就绪：${String(event.account ?? "")}`);
          break;
        case "message":
          this.onMessage?.(event as unknown as InboundMessage);
          break;
        case "log":
          this.pushLog(
            (["info", "warn", "error", "debug"].includes(String(event.level))
              ? (event.level as LogLine["level"])
              : "info"),
            String(event.text ?? ""),
          );
          break;
        case "status":
          this.pushLog("info", String(event.text ?? ""));
          break;
        default:
          this.pushLog("debug", line);
      }
    } catch {
      // Not a structured event: treat as a plain log line.
      this.pushLog("info", line);
    }
  }

  send(command: Record<string, unknown>): boolean {
    if (!this.child || !this.child.stdin || !this.child.stdin.writable) return false;
    try {
      this.child.stdin.write(JSON.stringify(command) + "\n");
      return true;
    } catch {
      return false;
    }
  }

  sendText(who: string, text: string, mode?: SendMode): boolean {
    return this.send({
      type: "send",
      who,
      text,
      mode: mode ?? this.config.sendMode,
    });
  }

  stop(): void {
    if (!this.child) return;
    const child = this.child;
    this.child = null;
    // Ask politely, then force.
    try {
      this.send({ type: "stop" });
    } catch {
      /* ignore */
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }, 3000);
    child.once("close", () => clearTimeout(timer));
    try {
      child.kill();
    } catch {
      /* ignore */
    }
    this.setStatus("stopped");
  }
}
