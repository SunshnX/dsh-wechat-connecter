// Python interpreter detection and bridge dependency management.

import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { WechatConnecterConfig } from "./config";

export const WECHATAUTO_VERSION = "1.3.0.2";

export interface DepCheckResult {
  ok: boolean;
  python: string;
  pythonVersion: string;
  wechatautoInstalled: boolean;
  wechatautoVersion: string;
  message: string;
}

function runProcess(command: string, args: string[], options: { timeoutMs?: number } = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 60_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: String(error) });
    });
  });
}

/** Probe a Python executable: return its version string, or null. */
async function probePythonVersion(python: string): Promise<string | null> {
  const result = await runProcess(python, ["--version"], { timeoutMs: 15_000 });
  if (result.code !== 0) return null;
  const version = (result.stdout || result.stderr).trim();
  return version || null;
}

/** Discover candidate Python interpreters, best first. */
export function discoverPythonCandidates(): string[] {
  const candidates: string[] = [];

  // 1. WorkBuddy-bundled Python (3.13.x) — avoids the py-launcher 3.15
  //    prebuilt-wheel problem for zstandard and friends.
  const wbRoot = join(homedir(), ".workbuddy", "binaries", "python", "versions");
  if (existsSync(wbRoot)) {
    try {
      const versions = readdirSync(wbRoot)
        .map((name) => ({ name, path: join(wbRoot, name) }))
        .filter((entry) => statSync(entry.path).isDirectory())
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
      for (const version of versions) {
        const py = join(version.path, "python.exe");
        if (existsSync(py)) candidates.push(py);
      }
    } catch {
      /* ignore */
    }
  }

  // 2. `python` on PATH.
  candidates.push("python");

  return candidates;
}

/** Resolve the Python interpreter to use, or null when none is available. */
export async function resolvePython(config: WechatConnecterConfig): Promise<{
  python: string;
  version: string | null;
} | null> {
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

/** Check whether the bridge dependencies are installed. */
export async function checkDeps(config: WechatConnecterConfig): Promise<DepCheckResult> {
  const resolved = await resolvePython(config);
  if (!resolved) {
    return {
      ok: false,
      python: "",
      pythonVersion: "",
      wechatautoInstalled: false,
      wechatautoVersion: "",
      message: "未找到可用的 Python 解释器（建议 Python 3.13）。",
    };
  }
  const { python, version } = resolved;
  const probe = await runProcess(
    python,
    ["-c", `import wechatauto; print(getattr(wechatauto, "__version__", "?"))`],
    { timeoutMs: 30_000 },
  );
  const installed = probe.code === 0;
  const installedVersion = installed ? (probe.stdout.trim() || probe.stderr.trim()) : "";
  return {
    ok: installed,
    python,
    pythonVersion: version ?? "",
    wechatautoInstalled: installed,
    wechatautoVersion: installedVersion,
    message: installed
      ? `wechatauto ${installedVersion} 已安装（Python ${version ?? ""}）`
      : "wechatauto 未安装。",
  };
}

/** Install bridge dependencies (best-effort streaming to a logger callback). */
export async function installDeps(
  config: WechatConnecterConfig,
  onLog: (line: string) => void,
): Promise<{ ok: boolean; python: string; message: string }> {
  const resolved = await resolvePython(config);
  if (!resolved) {
    return { ok: false, python: "", message: "未找到可用的 Python 解释器。" };
  }
  const { python } = resolved;
  onLog(`[deps] 使用解释器: ${python}`);
  onLog(`[deps] 安装 wechatauto-replica==${WECHATAUTO_VERSION} …`);

  return new Promise((resolve) => {
    const child = spawn(
      python,
      ["-m", "pip", "install", "--upgrade", `wechatauto-replica==${WECHATAUTO_VERSION}`],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    child.stdout.on("data", (d: Buffer) => onLog(d.toString().trimEnd()));
    child.stderr.on("data", (d: Buffer) => onLog(d.toString().trimEnd()));
    child.on("error", (error) => {
      onLog(`[deps] 安装失败: ${error}`);
      resolve({ ok: false, python, message: String(error) });
    });
    child.on("close", (code) => {
      const ok = code === 0;
      onLog(`[deps] pip install ${ok ? "完成" : `失败（退出码 ${code}）`}`);
      resolve({
        ok,
        python,
        message: ok ? "依赖安装完成。" : `pip install 退出码 ${code}。`,
      });
    });
  });
}
