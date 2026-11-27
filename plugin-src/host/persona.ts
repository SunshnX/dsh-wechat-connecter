// Persona resolution + scoped system-prompt injection.
//
// The persona is registered on the agent's scoped context inside the
// create/resume `setup` callback, so it only applies to WeChat-bridged
// sessions and never leaks into the user's own DSH sessions.

import type { WechatConnecterConfig } from "./config";

/** Resolve the active persona card text, or "" when none is active. */
export function activePersonaText(config: WechatConnecterConfig): string {
  const name = config.persona.active;
  if (!name) return "";
  return config.persona.cards?.[name] ?? "";
}

/** Build the system-prompt section options for the active persona. */
export function personaSection(config: WechatConnecterConfig) {
  const text = activePersonaText(config);
  return {
    name: "wechat-persona",
    order: 100,
    text,
    interpolate: false,
  };
}

/** Whether a persona is currently active. */
export function hasPersona(config: WechatConnecterConfig): boolean {
  return activePersonaText(config).length > 0;
}
