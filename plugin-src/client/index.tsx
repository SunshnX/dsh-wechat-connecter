// Browser half — client entry (ModuleLoader bundle).
//
// Registers two settings sections:
//   1. 微信连接 (bridge panel)  — start/stop, deps, logs, reply settings, update
//   2. 人设管理 (persona panel) — persona card CRUD

import * as React from "react";
import { Api } from "./api";
import { BridgePanel, PersonaPanel } from "./panels";

const h = React.createElement;

export const inject = ["slots", "connection", "locale"];

export function apply(ctx: any) {
  const api = new Api(ctx.connection);

  const zh = {
    bridgeTitle: "微信连接",
    personaTitle: "人设管理",
  };
  const en = {
    bridgeTitle: "WeChat Bridge",
    personaTitle: "Persona",
  };
  const localeNs = "dshWechatConnecter";
  try {
    ctx.locale?.register?.(localeNs, { zh, en });
  } catch {
    /* locale registration is best-effort */
  }

  const section = (id: string, order: number, label: () => string, render: () => React.ReactElement) => {
    ctx.slots.inject("settings.section", () => {
      const unregister = ctx.slots.register(
        {
          name: "settings.section",
          id,
          order,
          label,
          locale: localeNs,
        },
        render,
      );
      return () => unregister();
    });
  };

  section("dsh-wechat-connecter-bridge", 30, () => "微信连接", () => h(BridgePanel, { api }));
  section("dsh-wechat-connecter-persona", 31, () => "人设管理", () => h(PersonaPanel, { api }));
}
