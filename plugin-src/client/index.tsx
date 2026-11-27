// Browser half — client entry (ModuleLoader bundle).
//
// Registers one settings section "wechat-connecter" combining the bridge
// control panel and persona management into a single page.

import * as React from "react";
import { Api } from "./api";
import { WechatPanel } from "./panels";

const h = React.createElement;

export const inject = ["slots", "connection", "locale"];

export function apply(ctx: any) {
  const api = new Api(ctx.connection);

  const localeNs = "dshWechatConnecter";
  try {
    ctx.locale?.register?.(localeNs, {
      zh: { title: "wechat-connecter" },
      en: { title: "wechat-connecter" },
    });
  } catch {
    /* locale registration is best-effort */
  }

  ctx.slots.inject("settings.section", () => {
    const unregister = ctx.slots.register(
      {
        name: "settings.section",
        id: "dsh-wechat-connecter",
        order: 30,
        label: () => "wechat-connecter",
        locale: localeNs,
      },
      () => h(WechatPanel, { api }),
    );
    return () => unregister();
  });
}
