// Persona resolution + scoped system-prompt injection.
//
// The persona is registered on the agent's scoped context inside the
// create/resume `setup` callback, so it only applies to WeChat-bridged
// sessions and never leaks into the user's own DSH sessions.

import type { WechatConnecterConfig } from "./config";

/** Resolve the active persona card text, or "" when none is active. */
export function activePersonaText(config: WechatConnecterConfig): string {
  try {
    const name = config?.persona?.active;
    if (!name) return "";
    return config?.persona?.cards?.[name] ?? "";
  } catch {
    return "";
  }
}

/**
 * DSH 为「人设」预留的最优先槽位（order=0），名字与 DSH 的
 * PERSONA_PREFIX_SECTION 对齐。用这个名字注册会让我们的微信人设占据
 * 系统提示词最顶端的第一优先级位置，排在工具/策略/上下文之前。
 */
export const PERSONA_SECTION_NAME = "deployment:persona-prefix";
export const PERSONA_SECTION_ORDER = 0;

/** Build the system-prompt section options for the active persona. */
export function personaSection(config: WechatConnecterConfig) {
  const text = activePersonaText(config);
  return {
    name: PERSONA_SECTION_NAME,
    order: PERSONA_SECTION_ORDER,
    text,
    interpolate: false,
  };
}

/** Whether a persona is currently active. */
export function hasPersona(config: WechatConnecterConfig): boolean {
  return activePersonaText(config).length > 0;
}
