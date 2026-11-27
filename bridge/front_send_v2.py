# -*- coding: utf-8 -*-
"""前台发送增强版（测试版 v2）—— 移植 whale_girl 前台方案的精华。

相比 bridge/main.py 里现有的 `_send_front`，本模块补上了 whale_girl 前台链路
真正值钱、而我们之前缺失的四件事：

  1. 会话名解析  wxid / 群 id 在微信界面上显示的是「备注 / 昵称 / 群名」，
                拿 wxid 直接 open_chat 会白搜十几秒（`_chat_is_open` 的包含
                匹配永远落空，于是每次都重开会话）。先解析成可搜索的名字。
  2. 身份硬闸    发送前只读核对「当前开着的会话到底是谁」，只有完全相等或
                成员名集合吻合才放行——防止把消息串到别的群 / 别的人。
  3. 草稿保护    输入框里有残留草稿就拒绝，不把用户正在打的字一起发出去。
  4. 窗口还原    抢前台发完后把窗口状态还回去（该最小化的重新最小化、前台
                还给原窗口），你正在用电脑时最多看到它闪一下。

技术要点（独立实现，依赖 wechatauto + pywin32）：
  - 窗口激活走 ShowWindowAsync（异步、不合并输入队列）+ SetForegroundWindow，
    避免双开微信时把另一个账号的输入线程也拖住。
  - 复用 wechatauto WeChatGUI 的快速路径（_last_input_box 缓存 + fast 节奏），
    连续发送同一会话时不再重扫输入框。

返回 `(ok, reason)`；`reason` 为稳定字符串，调用方据 `ok` 决定是否回退。
"""

from __future__ import annotations

import re
import time
from collections import Counter

# 群/联系人候选名的分隔符（微信没命名的群在列表里显示成「成员甲、成员乙」）。
_CHAT_NAME_SPLIT_RE = re.compile(r"[、,，;；/]+")


# ---------------------------------------------------------------------------
# 会话名解析
# ---------------------------------------------------------------------------
def _is_raw_chat_id(s) -> bool:
    """微信里搜不到、也不能拿去做 UI 匹配的内部 id。"""
    s = str(s or "").strip()
    return s.endswith("@chatroom") or s.startswith("wxid_") or s.startswith("gh_")


def resolve_name(db, username: str, shown: str = "") -> str:
    """把内部 id 解析成「界面可搜索 / 可匹配」的会话名。

    读不到备注/昵称/群名就返回空，让调用方放弃本次发送——宁可这条不发，
    也不拿 wxid 去 open_chat 白搜一圈（搜不到还会把发送锁占住十几秒）。
    """
    uname = str(username or "").strip()
    shown = str(shown or "").strip()
    if uname.lower() == "filehelper" or shown.lower() == "filehelper":
        return "文件传输助手"
    if shown and not _is_raw_chat_id(shown):
        return shown
    if not uname:
        return ""
    try:
        if uname.endswith("@chatroom"):
            nm = str(db.get_nickname(uname) or "").strip()
            if not nm or _is_raw_chat_id(nm):
                nm = str(db.group_id_to_name(uname) or "").strip()
        else:
            nm = str(db.get_nickname(uname) or "").strip()
    except Exception:
        nm = ""
    if nm and nm != uname and not _is_raw_chat_id(nm):
        return nm
    return ""


def build_aliases(db, username: str, shown: str = "") -> list:
    """会话在界面列表里可能的名字候选（含群成员名拼接）。"""
    out = []
    if shown and shown != username and not _is_raw_chat_id(shown):
        out.append(shown)
    uname = str(username or "").strip()
    if uname.endswith("@chatroom"):
        try:
            nm = str(db.group_id_to_name(uname) or "").strip()
            if nm and nm != uname and not _is_raw_chat_id(nm):
                out.append(nm)
        except Exception:
            pass
        # 没命名的群：界面显示「成员甲、成员乙」，用成员名拼接当候选。
        try:
            me = str(getattr(db, "wxid", "") or "").strip()
            nicks = []
            for m in db.get_group_members(uname) or []:
                if str(m.get("username", "") or "").strip() == me:
                    continue
                n = (m.get("remark") or "").strip() or (m.get("nick_name") or "").strip()
                if n:
                    nicks.append(n)
            if nicks:
                out.append("、".join(nicks))
        except Exception:
            pass
    else:
        try:
            nm = str(db.get_nickname(uname) or "").strip()
            if nm and nm != uname and not _is_raw_chat_id(nm):
                out.append(nm)
        except Exception:
            pass
    if not out:
        out.append(shown or uname)
    # 去重 + 过滤掉仍不可搜索的内部 id。
    seen, cleaned = set(), []
    for x in out:
        x = str(x or "").strip()
        if x and x not in seen and not _is_raw_chat_id(x):
            seen.add(x)
            cleaned.append(x)
    return cleaned


# ---------------------------------------------------------------------------
# 身份核对
# ---------------------------------------------------------------------------
def _chat_identity_level(current, aliases) -> object:
    """当前会话名和目标候选名有多像：0 完全相等、1 成员名集合吻合，其它一律不收。

    刻意不用「包含」匹配（`name in cur`）：否则「群A」和「群A2」会互认，
    正文就发到另一个群里去了。
    """
    cur = str(current or "").strip()
    if not cur:
        return None
    keys = [str(a or "").strip() for a in (aliases or []) if str(a or "").strip()]
    if not keys:
        return None
    if cur in keys:
        return 0
    parts = [p.strip() for p in _CHAT_NAME_SPLIT_RE.split(cur) if p.strip()]
    if len(parts) >= 2:
        for k in keys:
            wanted = [p.strip() for p in _CHAT_NAME_SPLIT_RE.split(k) if p.strip()]
            if Counter(parts) == Counter(wanted):
                return 1
    return None


def _current_chat(u):
    """只读当前开着的会话名；读不到返回空串。"""
    try:
        return u.current_chat() or ""
    except Exception:
        return ""


def _require_chat_identity(u, who, aliases, log) -> bool:
    """发送前硬闸：当前会话必须真是目标。重试 3 次应对「刚点完会话标题还没刷新」。"""
    for attempt in range(3):
        cur = _current_chat(u)
        if _chat_identity_level(cur, aliases) is not None:
            log("front_v2：身份核对通过 目标=%s 当前=%s" % (who, cur or "?"))
            return True
        time.sleep(0.3)
    log("front_v2：身份核对失败 目标=%s（当前会话不是目标，拒绝发送）" % who)
    return False


# ---------------------------------------------------------------------------
# 草稿保护
# ---------------------------------------------------------------------------
def _input_value(u) -> str:
    """尽量读出输入框当前文字；读不到返回空串。"""
    try:
        e = u._chat_input()
        if e is None:
            return ""
        try:
            v = e.GetValuePattern().Value
            if isinstance(v, str):
                return v
        except Exception:
            pass
        for name in ("get_value", "value"):
            try:
                v = getattr(e, name)
                v = v() if callable(v) else v
                if v is not None:
                    return str(v)
            except Exception:
                pass
    except Exception:
        pass
    return ""


# ---------------------------------------------------------------------------
# 窗口激活兼容层 + 状态快照/还原
# ---------------------------------------------------------------------------
def activate(hwnd) -> bool:
    """把窗口拉到前台：ShowWindowAsync（异步、不合并输入队列）+ SetForegroundWindow。

    不用同步 ShowWindow，避免双开微信时把另一个账号的 GUI 线程也拖住。
    """
    import win32gui
    import win32con

    if not hwnd or not win32gui.IsWindow(hwnd):
        return False
    try:
        if win32gui.IsIconic(hwnd):
            win32gui.ShowWindowAsync(hwnd, win32con.SW_RESTORE)
        elif not win32gui.IsWindowVisible(hwnd):
            win32gui.ShowWindowAsync(hwnd, win32con.SW_SHOW)
    except Exception:
        pass
    try:
        win32gui.SetForegroundWindow(hwnd)
    except Exception:
        return False
    return win32gui.GetForegroundWindow() == hwnd


def _snapshot_win_state(hwnd) -> dict:
    import win32gui

    return {
        "hwnd": hwnd,
        "fg": win32gui.GetForegroundWindow(),
        "iconic": win32gui.IsIconic(hwnd),
        "visible": win32gui.IsWindowVisible(hwnd),
    }


def _restore_win_state(snap: dict) -> None:
    import win32gui
    import win32con

    try:
        hwnd = snap.get("hwnd")
        if not hwnd or not win32gui.IsWindow(hwnd):
            return
        if snap.get("iconic"):
            win32gui.ShowWindowAsync(hwnd, win32con.SW_MINIMIZE)
        elif not snap.get("visible"):
            win32gui.ShowWindowAsync(hwnd, win32con.SW_HIDE)
        fg = snap.get("fg")
        if fg and win32gui.IsWindow(fg):
            try:
                win32gui.SetForegroundWindow(fg)
            except Exception:
                pass
    except Exception:
        pass


def _force_foreground(hwnd, log) -> bool:
    """需要时把微信拉到前台（托盘里先拉出、必要时临时置顶）。"""
    import win32gui
    import win32con

    try:
        if not win32gui.IsWindowVisible(hwnd):
            activate(hwnd)
            time.sleep(0.4)
        fg = win32gui.GetForegroundWindow()
        if fg == hwnd:
            return True
        # 前台锁拒绝时临时置顶一次，再激活。
        was_topmost = False
        try:
            ex = win32gui.GetWindowLong(hwnd, win32con.GWL_EXSTYLE)
            was_topmost = bool(ex & win32con.WS_EX_TOPMOST)
            if not was_topmost:
                win32gui.SetWindowPos(hwnd, win32con.HWND_TOPMOST, 0, 0, 0, 0,
                                      win32con.SWP_NOMOVE | win32con.SWP_NOSIZE)
        except Exception:
            pass
        activate(hwnd)
        time.sleep(0.2)
        ok = win32gui.GetForegroundWindow() == hwnd
        # 用完撤掉临时置顶，避免长期霸占置顶。
        try:
            if not was_topmost:
                win32gui.SetWindowPos(hwnd, win32con.HWND_NOTOPMOST, 0, 0, 0, 0,
                                      win32con.SWP_NOMOVE | win32con.SWP_NOSIZE)
        except Exception:
            pass
        return ok
    except Exception as exc:  # noqa: BLE001
        log("front_v2：抢前台异常 %r" % exc)
        return False


# ---------------------------------------------------------------------------
# 发送
# ---------------------------------------------------------------------------
def _do_send(gui, text: str) -> bool:
    """复用 WeChatGUI 快速路径：优先走上次缓存的输入框坐标 + fast 节奏。"""
    box = getattr(gui, "_last_input_box", None)
    if box is not None and gui.input_text(text, box=box, fast=True):
        if gui.click_send(fast=True):
            return True
    if gui.input_text(text) and gui.click_send():
        return True
    return False


def send_front_v2(who: str, text: str, db=None, gui=None, log=None,
                  require_foreground: bool = False) -> tuple:
    """前台发送增强版。返回 (ok, reason)。

    默认先走「不抢前台」的 UIA 快速路径（微信最小化/被遮挡也能发，whale_girl
    实测成立），只有发不出去时才抢前台重试一次、发完还原窗口状态。
    """
    log = log or (lambda *_a, **_k: None)

    try:
        # 0) 会话名解析：读不到可搜索名字直接放弃，避免 open_chat 白搜。
        target = resolve_name(db, who)
        if not target:
            return False, "chat_name_unresolved"
        aliases = build_aliases(db, who, target)
        log("front_v2：目标解析 %s → %s" % (who, target))

        if gui is None:
            from wechatauto import WeChatGUI
            gui = WeChatGUI()
            try:
                from wechatauto import rhythm
                rhythm.set_profile("fast")
            except Exception:
                pass
        hwnd = getattr(gui, "main_hwnd", 0)
        u = gui._get_uia() if gui is not None else None

        # 1) 打开会话：已是目标则跳过 open_chat（这是提速的关键）。
        cur = _current_chat(u) if u is not None else ""
        if _chat_identity_level(cur, aliases) is None:
            log("front_v2：需打开会话（当前=%s）" % (cur or "?"))
            if not gui.open_chat(target):
                return False, "open_chat_failed"

        # 2) 身份硬闸（重试 3 次应对标题刷新）。
        if u is None or not _require_chat_identity(u, target, aliases, log):
            return False, "identity_mismatch"

        # 3) 草稿保护。
        draft = _input_value(u)
        if draft.strip():
            log("front_v2：输入框有草稿，拒绝发送（不污染用户正在输入的内容）")
            return False, "draft_dirty"

        # 4) 第一轮：不抢前台，UIA 直接发（复用快速路径）。
        if not require_foreground and _do_send(gui, text):
            log("front_v2：已发送（未抢前台）→ %s" % target)
            return True, "sent"

        # 5) 第二轮：抢前台 + 快照还原。
        snap = _snapshot_win_state(hwnd) if hwnd else None
        try:
            if require_foreground or not _force_foreground(hwnd, log):
                # 抢不到前台也要尽量发一次（UIA 后台仍可能成功）。
                log("front_v2：抢前台失败，尝试后台 UIA 直接发送")
            if _do_send(gui, text):
                log("front_v2：已发送（前台）→ %s" % target)
                return True, "sent_foreground"
            return False, "send_failed"
        finally:
            if snap is not None:
                _restore_win_state(snap)

        return False, "send_failed"
    except Exception as exc:  # noqa: BLE001
        return False, "error:" + type(exc).__name__
