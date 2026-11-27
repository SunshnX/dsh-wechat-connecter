# -*- coding: utf-8 -*-
"""dsh-wechat-connecter Python bridge (sidecar).

Reads WeChat messages from the local SQLCipher database via
`wechatauto-replica` (WeChatDB + Listener), and sends replies via the
zero-focus background channel (`bg_send_v2`): SPI_SETSCREENREADER +
accessibility gate + UIA SetValue + PostMessage click. No foreground
UIA channel.

Protocol with the Node host (newline-delimited JSON):

  Python -> Node (stdout):
    {"event": "ready", "account": "wxid_xxx"}
    {"event": "message", "peerType": "...", "username": "...", "content": "..."}
    {"event": "log", "level": "info|warn|error", "text": "..."}

  Node -> Python (stdin):
    {"type": "send", "who": "wxid_xxx", "text": "hello"}
    {"type": "stop"}

All structured output is flushed line-by-line. Unstructured output (tracebacks,
third-party warnings) is emitted as plain lines on stderr and is surfaced by the
host as error log lines.
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time

# Ensure UTF-8 on every stream: Windows console defaults to GBK.
for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass


def emit(event: str, **payload) -> None:
    """Write one structured event to stdout and flush."""
    obj = {"event": event, **payload}
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def log(level: str, text: str) -> None:
    emit("log", level=level, text=str(text))


def load_config(argv) -> dict:
    if len(argv) > 1:
        try:
            return json.loads(argv[1])
        except Exception:
            log("warn", "无法解析桥接配置参数，使用默认值")
    return {}


def main() -> int:
    config = load_config(sys.argv)
    poll_interval = float(config.get("pollInterval", 0.5))
    bot_name = str(config.get("botName", ""))

    log("info", "桥接启动，正在导入 wechatauto…")
    try:
        from wechatauto import WeChatDB
        # 注意：顶层 `wechatauto.Listener` 是 wx.Listener（空抽象基类，不接受参数）；
        # 真正从本地数据库轮询消息的监听器在 `wechatauto.db.Listener`。
        try:
            from wechatauto.db import Listener
        except ImportError:
            from wechatauto import Listener
    except Exception as exc:  # noqa: BLE001
        log("error", f"导入 wechatauto 失败：{exc}")
        log("error", "请在管理页点击「安装依赖」，或手动执行：pip install wechatauto-replica==1.3.0.2")
        return 1

    db: WeChatDB
    try:
        db = WeChatDB()
    except Exception as exc:  # noqa: BLE001
        log("error", f"打开微信数据库失败（请确认微信已登录）：{exc}")
        return 2

    runtime = WeChatRuntime(db, bot_name=bot_name)
    runtime.start_listener(interval=poll_interval)
    log("info", f"监听器已启动（间隔 {poll_interval}s，发送通道：后台零焦点）")
    emit("ready", account=str(getattr(db, "wxid", "") or ""))

    # stdin command loop
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                cmd = json.loads(line)
            except Exception:
                log("warn", f"无法解析 stdin 命令：{line[:120]}")
                continue
            cmd_type = cmd.get("type")
            if cmd_type == "stop":
                log("info", "收到停止指令，桥接退出")
                break
            if cmd_type == "send":
                who = str(cmd.get("who", ""))
                text = str(cmd.get("text", ""))
                if not who or not text:
                    log("warn", "send 命令缺少 who/text")
                    continue
                runtime.send_text(who, text)
    except KeyboardInterrupt:
        pass
    finally:
        runtime.stop()
        log("info", "桥接已停止")
    return 0


class WeChatRuntime:
    """Owns the DB Listener and the send path."""

    def __init__(self, db, bot_name: str = ""):
        self.db = db
        self.bot_name = bot_name
        self._listener = None
        self._send_lock = threading.Lock()

    # -- receive -----------------------------------------------------------
    def start_listener(self, interval: float = 0.5) -> None:
        # 真正的 DB 监听器在 wechatauto.db.Listener（顶层 wechatauto.Listener 是空抽象基类）。
        try:
            from wechatauto.db import Listener
        except ImportError:
            from wechatauto import Listener

        listener = Listener(self.db, interval=interval)
        listener.add_all(self._on_message, discover=True)
        listener.start()
        self._listener = listener

    def _on_message(self, msg: dict, _listener) -> None:
        """Listener callback: `msg` dict 字段（wechatauto 1.3.0.2）：
        local_id / type(中文名，如"文本") / sender_id(数字 rowid，非 wxid) /
        sender_username(真实发送者 wxid) / create_time / content / sort_seq /
        username(会话 wxid)。"""
        try:
            username = str(msg.get("username", "") or "")
            if not username:
                return
            content = str(msg.get("content", "") or "")
            msg_type = msg.get("type")
            sender_username = str(msg.get("sender_username", "") or "")

            # 跳过自己发出的消息（sender_username 是本机账号的 wxid），避免
            # 把自己发的话当成对方消息再回复一次。
            my_wxid = str(getattr(self.db, "wxid", "") or "")
            if my_wxid and sender_username and sender_username == my_wxid:
                return

            peer_type = self._classify(username)

            # 跳过非文本消息（图片/语音/文件等无正文内容）。
            if msg_type not in ("文本", None) and not content:
                return

            is_at = self._detect_at(content, username)
            emit(
                "message",
                peerType=peer_type,
                username=username,
                displayName=username,
                senderId=sender_username,
                senderName="",
                content=content,
                isAt=is_at,
                messageType=str(msg_type or ""),
                localId=msg.get("local_id"),
                createTime=msg.get("create_time"),
            )
        except Exception as exc:  # noqa: BLE001
            log("error", f"处理消息回调异常：{exc}")

    def _classify(self, username: str) -> str:
        if username.endswith("@chatroom"):
            return "group"
        my_wxid = str(getattr(self.db, "wxid", "") or "")
        if my_wxid and username == my_wxid:
            return "self"
        # filehelper / notifications / official accounts.
        if username in ("filehelper", "medianote", "floatbottle", "fmessage") or username.startswith("gh_"):
            return "system"
        return "contact"

    def _detect_at(self, content: str, username: str) -> bool:
        if "@" in content:
            return True
        if self.bot_name and self.bot_name in content:
            return True
        return False

    # -- send --------------------------------------------------------------
    def send_text(self, who: str, text: str) -> None:
        """发送一条消息。仅保留后台零焦点通道（bg_send_v2），不再回退前台 UIA。"""
        with self._send_lock:
            try:
                from bg_send_v2 import send_background_v2

                ok, reason = send_background_v2(
                    who, text, db=self.db, log=lambda m: log("info", m))
                if ok:
                    log("info", f"[bg] 已发送给 {who}")
                else:
                    log("warn", f"[bg] 发送失败（{reason}）→ {who}")
            except Exception as exc:  # noqa: BLE001
                log("error", f"发送给 {who} 失败：{exc}")

    def stop(self) -> None:
        try:
            if self._listener is not None:
                self._listener.stop()
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    sys.exit(main())
