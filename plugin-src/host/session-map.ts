// peer -> sessionId mapping persistence.
//
// Each WeChat peer (private contact or group chatroom) maps to exactly one DSH
// session id. The mapping survives restarts so that resuming the plugin reuses
// the same session (via ctx.agents.resume) instead of creating a new one.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export type PeerType = "contact" | "group";

export interface PeerBinding {
  sessionId: string;
  peerType: PeerType;
  /** Human-readable display name captured when the binding was made. */
  displayName: string;
  /** Epoch ms of last activity. */
  lastSeen: number;
}

interface StateFile {
  peers: Record<string, PeerBinding>;
}

export interface SessionMapStore {
  /** Resolve a binding for a peer key (username), or undefined. */
  get(peer: string): PeerBinding | undefined;
  /** Record (or update) a binding and persist. */
  set(peer: string, binding: PeerBinding): void;
  /** Remove a binding and persist. */
  remove(peer: string): void;
  /** List all bindings. */
  list(): Array<{ peer: string; binding: PeerBinding }>;
  /** Touch a peer's lastSeen without a full rewrite (throttled). */
  touch(peer: string): void;
  /** Persist immediately. */
  flush(): void;
}

export function createSessionMapStore(baseDir: string): SessionMapStore {
  const statePath = join(baseDir, "state.json");
  mkdirSync(dirname(statePath), { recursive: true });

  let peers: Record<string, PeerBinding> = {};
  let dirty = false;

  const load = () => {
    try {
      if (existsSync(statePath)) {
        const raw = JSON.parse(readFileSync(statePath, "utf8")) as StateFile;
        if (raw && typeof raw === "object" && raw.peers && typeof raw.peers === "object") {
          peers = raw.peers;
        }
      }
    } catch (error) {
      console.error("[dsh-wechat-connecter] failed to read state:", error);
    }
  };

  const persist = () => {
    try {
      writeFileSync(statePath, JSON.stringify({ peers }, null, 2), "utf8");
      dirty = false;
    } catch (error) {
      console.error("[dsh-wechat-connecter] failed to write state:", error);
    }
  };

  load();

  return {
    get(peer) {
      return peers[peer];
    },
    set(peer, binding) {
      peers[peer] = binding;
      dirty = true;
      persist();
    },
    remove(peer) {
      if (peer in peers) {
        delete peers[peer];
        persist();
      }
    },
    list() {
      return Object.entries(peers).map(([peer, binding]) => ({ peer, binding }));
    },
    touch(peer) {
      const binding = peers[peer];
      if (binding) {
        binding.lastSeen = Date.now();
        dirty = true;
      }
    },
    flush() {
      if (dirty) persist();
    },
  };
}
