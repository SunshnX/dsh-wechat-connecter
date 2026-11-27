# dsh-wechat-connecter

把微信变成 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的聊天客户端。

安装一个 DSH 插件，即可无感地把微信消息接入 DSH 的 agent 会话：AI 以你设定的人设自动回复微信消息，回复过程（思考、聊天记录）在 DSH 界面内可见，并附带一个 DSH 内置管理页。

## 功能

- **微信连接器**：本地 Python sidecar 负责微信收发。读消息走本地 SQLCipher 数据库增量轮询（无需窗口焦点），发消息支持「前台 / 后台」双通道。
- **微信 ↔ DSH agent 桥接**：每个微信对端（私聊联系人 / 群）对应一个 DSH 会话；入站消息通过 `agent.followup()` 喂给 DSH 的 agent 循环，思考过程与聊天记录自动出现在 DSH 会话里。
- **人设系统**：内置人设预设（JSON），会话启动时作为系统提示词注入（仅注入微信对端对应的会话，不影响你自己的 DSH 会话）。
- **回复触发判定**：群聊需 @/点名、私聊回复策略、话题延续、适时沉默。
- **拟人化表达**：长回复拆成多条短气泡、去掉句尾标点、反鹦鹉学舌去重（修复了括号加神态被错误拆开的 bug）。
- **会话跨重启恢复**：peer→sessionId 映射持久化到磁盘，重启后用 `ctx.agents.resume()` 恢复历史会话（不新建）。
- **桥接进程托管**：插件内用 `child_process.spawn` 拉起 Python 桥接，`windowsHide: true`（不弹 cmd 黑窗），捕获 stdout/stderr 到环形日志缓冲，插件卸载自动停止。
- **DSH 管理页卡片**：一键启动/停止桥接、依赖检查安装、实时日志、发送模式切换、人设管理单独成页、GitHub 拉取检查更新。

## 环境要求

- **Windows**（微信 4.x 的 UIA 自动化仅 Windows）
- **微信 4.x**（实测 4.2.0.53；微信 4.x 用 Qt 自绘渲染，`wxauto` 已停更且不支持 4.x）
- **DeepSeek Harness** desktop / web profile（兼容 `0.2.2-rc.5`）
- **Node.js** ≥ 22.19（ESM）
- **Python** 3.13（推荐；系统若同时存在指向 3.15 的 `py` 启动器，`zstandard` 等包可能无预编译轮子装不上）

## 安装

Desktop 在内置终端执行：

```bash
dsh plugin --profile desktop add dsh-wechat-connecter
```

Web 将 `desktop` 改为 `web`。安装后重启 Desktop（或 `dsh web`），打开「设置 → 微信连接」。

## 使用

1. 打开「设置 → 微信连接」。
2. 点击「安装依赖」自动安装 `wechatauto-replica==1.3.0.2`。
3. 确认微信已登录，点击「启动桥接」。
4. 在「人设管理」里选择或编辑人设。
5. 用另一个微信给机器人发消息（群聊默认需 @ 才回复），即可在 DSH 会话里看到思考与回复过程。

## 目录结构

```
├─ package.json            # DSH 插件清单（dsh 字段、peerDependencies、导出）
├─ cordis.patch.yml        # Cordis loader 条目
├─ locale/                 # 设置页 meta 文案（zh / en）
├─ plugin-src/
│  ├─ host/                # 宿主半（Node/TS，tsup 打包为 lib/index.js）
│  │  ├─ index.ts          # 插件入口 name/inject/apply/Config
│  │  ├─ config.ts         # 配置 schema + 默认值 + 磁盘持久化
│  │  ├─ session-map.ts    # peer→sessionId 映射持久化
│  │  ├─ persona.ts        # 人设解析与作用域注入
│  │  ├─ reply.ts          # 回复触发判定 + 拟人化
│  │  ├─ bridge.ts         # Python 桥接进程托管
│  │  ├─ deps.ts           # Python 探测与依赖安装
│  │  └─ ...
│  └─ client/              # 浏览器半（React，esbuild 打包为 lib/client.js）
│     ├─ index.tsx         # 设置分区注册
│     ├─ panels.tsx        # 桥接面板 + 人设面板
│     └─ api.ts            # RPC 客户端
├─ bridge/                 # Python sidecar
│  ├─ main.py              # 入口：DB 监听 + 发送 + stdin/stdout 协议
│  ├─ bg_send.py           # 后台发送通道（尽力而为）
│  └─ requirements.txt
├─ lib/                    # 构建产物
└─ test/
```

## 开发

```bash
npm install
npm run build      # tsup 打包 host + esbuild 打包 client
npm run typecheck  # tsc --noEmit
npm test           # node --test
```

## 协议

微信消息通过 `wechatauto-replica`（Apache-2.0）读取本地数据库并发送，插件不篡改、不注入微信客户端代码，但自动化收发可能违反微信用户协议，请自行评估风险，谨慎使用。

## 参考

- [whale_girl](https://github.com/Banan1cee/whale_girl) — 微信连接与信息收发、回复触发、拟人化
- [dsh-im](https://github.com/xmanrui/dsh-im) — DSH IM 桥接与管理 UI
- [dsh-soul-md](https://github.com/Scorp1o117/dsh-soul-md) — 人设与记忆系统
