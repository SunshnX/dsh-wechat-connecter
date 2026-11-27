# -*- coding: utf-8 -*-
"""零焦点后台发送 —— 完整方案（测试版 v2）。

技术链路（与 whale_girl 同思路，独立实现）：

  物化   SPI_SETSCREENREADER + accessibility gate 热激活（写 Weixin.dll 内存字节）
         —— 让 Qt 暴露 mmui 控件树，全程不 SetForegroundWindow / SetFocus。
  读     uiautomation `FindAll(Descendants)` 遍历控件树，按 AutomationId 找输入框、
         按 Name 找发送按钮、按 AutomationId 找会话列表。
  写     `PostMessage(WM_CHAR)` 逐字投递（微信 4.2 按 UTF-16 码元解释 wParam），
         发送用 `PostMessage` 鼠标消息点「发送」按钮，不模拟键盘、不抢焦点。

依赖：`uiautomation`（pip 包）、`wechatauto.accessibility`（gate 热激活，wechatauto 内置）。

返回 `(ok, reason)`；`reason` 为稳定字符串，调用方据 `ok` 决定是否回退前台通道。
"""

from __future__ import annotations

import ctypes
import re
import time
from ctypes import wintypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

# ---- Windows 常量 ----
SPI_SETSCREENREADER = 0x0047
SPI_GETSCREENREADER = 0x0048
SPIF_UPDATEINIFILE = 0x01
SPIF_SENDCHANGE = 0x02

WM_SETFOCUS = 0x0007
WM_KILLFOCUS = 0x0008
WM_CHAR = 0x0102
WM_MOUSEMOVE = 0x0200
WM_LBUTTONDOWN = 0x0201
WM_LBUTTONUP = 0x0202
MK_LBUTTON = 0x0001

# ShowWindow 参数：显示窗口但不激活（不抢前台）。微信缩到托盘时主窗是隐藏的
# （visible=False），Qt 对隐藏窗口不物化控件树，必须先「只显示不激活」拉出来。
SW_SHOWNOACTIVATE = 4
SW_RESTORE = 9
UNHIDE_SETTLE = 0.4    # 「显示但不激活」后等 Qt 建树的秒数

# ---- 微信 4.x 控件锚点（客观常量）----
CHAT_INPUT_AID = "chat_input_field"   # 输入框 AutomationId；其 Name == 当前聊天对象
SEND_BUTTON_NAME = "发送"
SESSION_LIST_AID = "session_list"

MIN_NODES = 20          # 树物化的最低节点数阈值
CHAR_GAP = 0.03         # 逐字 WM_CHAR 间隔（秒）


# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------
def _aid_hit(aid, candidates) -> bool:
    a = (aid or "").strip().lower()
    if not a:
        return False
    segs = a.split(".")
    for c in candidates:
        cl = (c or "").strip().lower()
        if cl and (a == cl or a.endswith("." + cl) or cl in segs):
            return True
    return False


def _norm_chat_name(text) -> str:
    head = str(text or "").split("\n", 1)[0].strip()
    for tail in ("长按鼠标", "语音输入", "按住说话", "按 Enter", "按回车"):
        if tail in head:
            head = head.split(tail, 1)[0].strip()
    m = re.match(r"^(.*?)\s*[（(]\s*\d+\s*[）)]\s*$", head)
    return m.group(1).strip() if (m and m.group(1).strip()) else head


def _find_hwnd_by_enum() -> list:
    """枚举所有顶层窗口（含隐藏窗口），按标题关键词匹配微信主窗口。

    返回 `[(hwnd, title, visible), ...]`，可见的排在前面。FindWindowW 只做精确
    标题匹配，微信有未读计数等后缀时可能 miss；EnumWindows 能拿到隐藏窗口。
    """
    results = []
    WNDENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def _cb(hwnd, _lparam):
        try:
            length = user32.GetWindowTextLengthW(hwnd)
            if length <= 0:
                return True
            buf = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, buf, length + 1)
            title = buf.value
            for kw in ("微信", "Weixin", "WeChat"):
                if kw in title:
                    results.append((int(hwnd), title, bool(user32.IsWindowVisible(hwnd))))
                    break
        except Exception:  # noqa: BLE001
            pass
        return True

    user32.EnumWindows(WNDENUMPROC(_cb), 0)
    results.sort(key=lambda r: (not r[2], r[0]))  # 可见优先
    return results


def find_hwnd() -> int:
    # 1) 精确标题（FindWindowW 能找隐藏窗口，但要求标题完全一致）
    for title in ("微信", "Weixin", "WeChat"):
        try:
            h = user32.FindWindowW(None, title)
        except Exception:
            h = 0
        if h:
            return int(h)
    # 2) 枚举兜底：含标题关键词的顶层窗口（含隐藏）
    for hwnd, _title, _visible in _find_hwnd_by_enum():
        return hwnd
    return 0


def _unhide(hwnd: int, log=None) -> bool:
    """兜底：窗口隐藏/最小化时用「只显示、不激活」拉出（仅恢复窗口框）。

    注意：这只恢复窗口框，**不会**重建 Qt 渲染面和无障碍树（实测树仍只有 1 个
    节点）。真正能重建树的是微信自己的 Ctrl+Alt+W 热键（见 `_wake_by_hotkey`），
    本函数只作次要兜底。返回「窗口是否已可见」。
    """
    log = log or (lambda *_a, **_k: None)
    try:
        visible = bool(user32.IsWindowVisible(hwnd))
        iconic = bool(user32.IsIconic(hwnd))
        if visible and not iconic:
            return True
        fg0 = user32.GetForegroundWindow()
        if iconic:
            user32.ShowWindow(hwnd, SW_RESTORE)          # 最小化 → 还原
            time.sleep(0.1)
        if not bool(user32.IsWindowVisible(hwnd)):
            user32.ShowWindow(hwnd, SW_SHOWNOACTIVATE)   # 隐藏 → 只显示不激活
            time.sleep(UNHIDE_SETTLE)
        fg1 = user32.GetForegroundWindow()
        log("bgv2：窗口原来%s，已用「显示但不激活」拉出（前台 %s → %s%s）"
            % ("隐藏/最小化" if (not visible or iconic) else "可见",
               fg0, fg1, "，没抢" if fg0 == fg1 else "，**被抢了**"))
        return bool(user32.IsWindowVisible(hwnd))
    except Exception as exc:  # noqa: BLE001
        log("bgv2：显示窗口失败 %r" % (exc,))
        return False


def _send_hotkey(log=None) -> bool:
    """按一次微信自己的「打开/隐藏微信」热键 Ctrl+Alt+W。

    这是微信注册的全局热键，走微信自己的恢复逻辑——能同时把界面和控件树拉回来
    （ShowWindow 做不到，它只恢复窗口框）。热键是开关式的：窗口正常时按一下会
    缩回托盘，所以只在树坏掉时调用。
    """
    log = log or (lambda *_a, **_k: None)
    try:
        u32 = user32
        keys = (0x11, 0x12, 0x57)  # Ctrl / Alt / W
        for vk in keys:
            u32.keybd_event(vk, 0, 0, 0)
            time.sleep(0.03)
        for vk in reversed(keys):
            u32.keybd_event(vk, 0, 2, 0)  # KEYEVENTF_KEYUP
            time.sleep(0.03)
        return True
    except Exception as exc:  # noqa: BLE001
        log("bgv2：按 Ctrl+Alt+W 失败：%r" % (exc,))
        return False


def _wake_by_hotkey(hwnd: int, log=None, wait: float = 3.0) -> bool:
    """用 Ctrl+Alt+W 唤醒微信并等控件树重建。

    热键是开关式的，最多按两次——第一次可能恰好把它切回托盘，第二次才真正打开。
    """
    log = log or (lambda *_a, **_k: None)
    if not hwnd:
        return False

    def _tree_ok() -> bool:
        return len(_read_ui(hwnd)["nodes"]) >= MIN_NODES

    if _tree_ok():
        return True

    for attempt in range(2):
        if not _send_hotkey(log=log):
            return False
        deadline = time.monotonic() + max(0.8, float(wait))
        while time.monotonic() < deadline:
            if _tree_ok():
                log("bgv2：Ctrl+Alt+W 已唤醒微信，控件树恢复（%d 节点）"
                    % len(_read_ui(hwnd)["nodes"]))
                return True
            time.sleep(0.25)
        if attempt == 0:
            log("bgv2：第一次热键后控件树仍是空壳，再按一次（热键是开关式）")
    return False


# ---------------------------------------------------------------------------
# 物化：SPI + accessibility gate
# ---------------------------------------------------------------------------
def _materialize(hwnd: int) -> bool:
    """热激活 Qt 无障碍树：优先 gate 字节热写（不激活窗口），失败再开系统读屏标志。"""
    try:
        from wechatauto.accessibility import AccessibilityGate
    except Exception:
        return False
    # 1) gate 热写（写 Weixin.dll 内存字节 0→1，校验 mmui 树是否物化）
    try:
        if AccessibilityGate._hot_activate_accessibility(hwnd, verify=True, max_candidates=4):
            return True
    except Exception:
        pass
    # 2) 兜底：系统读屏标志
    try:
        AccessibilityGate._set_screen_reader_flag(True)
        return True
    except Exception:
        return False
    return False


# ---------------------------------------------------------------------------
# 读控件树
# ---------------------------------------------------------------------------
def _descendants(control):
    """等价于 FindAll(TreeScope_Descendants)。递归 GetChildren 会在中间层没物化时断掉，
    只能拿到几十个节点；FindAll 能拿到 160+。"""
    try:
        from uiautomation import uiautomation as _u
        client = _u._AutomationClient.instance().IUIAutomation
        arr = control.Element.FindAll(4, client.CreateTrueCondition())  # 4 = Descendants
        if arr is not None and arr.Length:
            import uiautomation as auto
            out = []
            for i in range(arr.Length):
                c = auto.Control.CreateControlFromElement(arr.GetElement(i))
                if c is not None:
                    out.append(c)
            return out
    except Exception:
        pass
    # 兜底：递归 GetChildren（节点会少）
    out, level = [], [control]
    for _ in range(6):
        nxt = []
        for node in level:
            try:
                kids = node.GetChildren() or []
            except Exception:
                kids = []
            for k in kids:
                out.append(k)
                nxt.append(k)
        if not nxt:
            break
        level = nxt
    return out


def _read_ui(hwnd: int) -> dict:
    info = {
        "ctrl": None, "nodes": [], "edit": None, "edit_hwnd": None, "chat": None,
        "send_xy": None, "send_button": None, "rows": [],
    }
    if not hwnd:
        return info
    try:
        import uiautomation as auto
        info["ctrl"] = auto.ControlFromHandle(hwnd)
    except Exception:
        return info
    if info["ctrl"] is None:
        return info

    nodes = _descendants(info["ctrl"])
    info["nodes"] = nodes

    # 输入框（AutomationId=chat_input_field）
    for c in nodes:
        try:
            if _aid_hit(getattr(c, "AutomationId", ""), (CHAT_INPUT_AID,)):
                info["edit"] = c
                info["edit_hwnd"] = int(c.NativeWindowHandle) if getattr(c, "NativeWindowHandle", None) else None
                break
        except Exception:
            continue

    if info["edit"] is not None:
        try:
            info["chat"] = _norm_chat_name(info["edit"].Name)
        except Exception:
            pass

    # 发送按钮（Name=发送，Button 类型）→ 屏幕坐标中心
    for c in nodes:
        try:
            if (c.Name or "").strip() == SEND_BUTTON_NAME and "Button" in c.ControlTypeName:
                r = c.BoundingRectangle
                if r.right > r.left and r.bottom > r.top:
                    info["send_xy"] = (r.left + (r.right - r.left) // 2,
                                       r.top + (r.bottom - r.top) // 2)
                    info["send_button"] = c
                    break
        except Exception:
            continue

    # 会话列表（AutomationId=session_list）→ 行
    lst = None
    for c in nodes:
        try:
            if _aid_hit(getattr(c, "AutomationId", ""), (SESSION_LIST_AID,)):
                lst = c
                break
        except Exception:
            continue
    if lst is not None:
        level = [lst]
        for _ in range(4):
            nxt, named = [], []
            for node in level:
                try:
                    kids = node.GetChildren()
                except Exception:
                    kids = []
                for k in kids:
                    nxt.append(k)
                    nm = _norm_chat_name(getattr(k, "Name", "") or "")
                    if nm:
                        named.append((nm, k))
            if named:
                info["rows"] = named[:40]
                break
            level = nxt
            if not level:
                break
    return info


# ---------------------------------------------------------------------------
# PostMessage 发送器
# ---------------------------------------------------------------------------
class _Sender:
    def __init__(self, hwnd: int):
        self.hwnd = int(hwnd)

    @staticmethod
    def _lparam(x, y):
        return (y << 16) | (x & 0xFFFF)

    def _post(self, msg, wparam, lparam):
        if not user32.PostMessageW(self.hwnd, msg, wparam, lparam):
            raise ctypes.WinError(ctypes.get_last_error())

    def type_text(self, text: str) -> bool:
        """回退通道：WM_SETFOCUS 伪焦点 + 逐字 WM_CHAR 到主窗口（UTF-16 码元）。

        微信 4.2 输入框是 Qt 自绘、无独立 HWND，WM_CHAR 只能发到主窗口，
        由 Qt 路由到当前聚焦的输入框。正常路径应优先用 UIA SetValue。
        """
        self._post(WM_SETFOCUS, 0, 0)
        time.sleep(0.05)
        for ch in text:
            for unit in ch:  # 处理 surrogate pair（emoji）
                self._post(WM_CHAR, ord(unit), 1)
                time.sleep(CHAR_GAP)
        return True

    def click_screen(self, sx: int, sy: int) -> bool:
        """PostMessage 鼠标点击（屏幕坐标 → 客户区坐标），被遮挡也有效。"""
        pt = wintypes.POINT(int(sx), int(sy))
        if not user32.ScreenToClient(self.hwnd, ctypes.byref(pt)):
            return False
        lp = self._lparam(pt.x, pt.y)
        self._post(WM_MOUSEMOVE, 0, lp)
        self._post(WM_LBUTTONDOWN, MK_LBUTTON, lp)
        time.sleep(0.06)
        self._post(WM_LBUTTONUP, 0, lp)
        return True


def _write_text(edit, text: str) -> bool:
    """优先用 UIA ValuePattern.SetValue 直接写输入框，不经过键盘、不抢焦点。"""
    if edit is None:
        return False
    try:
        edit.GetValuePattern().SetValue(str(text))
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# 会话切换（点会话列表行，不碰搜索框）
# ---------------------------------------------------------------------------
def _open_chat(hwnd: int, info: dict, who: str, aliases) -> bool:
    if info["chat"] and _chat_is_target(info["chat"], aliases):
        return True
    for name, ctrl in info["rows"]:
        if _chat_is_target(name, aliases):
            r = ctrl.BoundingRectangle
            if r.right <= r.left or r.bottom <= r.top:
                continue
            x = r.left + (r.right - r.left) // 2
            y = r.top + (r.bottom - r.top) // 2
            try:
                _Sender(hwnd).click_screen(x, y)
                time.sleep(0.3)
                return True
            except Exception:
                continue
    return False


def _chat_is_target(current, aliases) -> bool:
    cur = _norm_chat_name(current)
    if not cur:
        return False
    for a in aliases:
        if a and (cur == a or a in cur or cur in a):
            return True
    return False


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def send_background_v2(who: str, text: str, db=None, gui=None, log=None) -> tuple:
    """零焦点后台发送一条消息。返回 (ok, reason)。"""
    log = log or (lambda *_a, **_k: None)

    try:
        hwnd = find_hwnd()
        if not hwnd:
            return False, "no_window"

        # 目标会话的候选名（wxid 本身 + 昵称/备注/微信号）
        aliases = [who]
        try:
            if db is not None:
                for hit in (db.search_contact(who) or []):
                    for k in (hit.get("remark"), hit.get("nick_name")):
                        if k and k not in aliases:
                            aliases.append(k)
                nick = db.get_nickname(who)
                if nick and nick not in aliases:
                    aliases.append(nick)
        except Exception:
            pass

        # 0) 物化控件树。
        #    缩到托盘时树是「0-1 节点空壳」：ShowWindow 只恢复窗口框，Qt 渲染面
        #    和无障碍树不会重建（实测仍 1 节点），必须用微信自己的 Ctrl+Alt+W
        #    热键唤醒；仍不完整再走 SPI/gate 热激活兜底。
        info = _read_ui(hwnd)
        if len(info["nodes"]) <= 1:
            log("bgv2：控件树为空壳（%d 节点），按 Ctrl+Alt+W 唤醒微信" % len(info["nodes"]))
            _wake_by_hotkey(hwnd, log=log)
            info = _read_ui(hwnd)
        if len(info["nodes"]) < MIN_NODES:
            log("bgv2：控件树未物化（%d 节点），尝试拉窗口 + gate 热激活" % len(info["nodes"]))
            _unhide(hwnd, log=log)
            _materialize(hwnd)
            time.sleep(0.8)
            info = _read_ui(hwnd)
        if len(info["nodes"]) < MIN_NODES:
            return False, "tree_not_ready"

        # 2) 切会话
        if not _open_chat(hwnd, info, who, aliases):
            return False, "chat_not_found"
        info = _read_ui(hwnd)  # 切过会话要重读（按钮位置会变）

        # 3) 找输入框 + 发送按钮
        if info["edit"] is None:
            return False, "no_input_field"
        if info["send_xy"] is None:
            return False, "no_send_button"

        sender = _Sender(hwnd)

        # 4) 打字：优先 UIA ValuePattern.SetValue（不抢焦点），失败回退 WM_CHAR 到主窗口
        if not _write_text(info["edit"], text):
            log("bgv2：UIA SetValue 不可用，回退 WM_CHAR")
            if not sender.type_text(text):
                return False, "type_failed"
        time.sleep(0.3)

        # 5) 点发送
        if not sender.click_screen(*info["send_xy"]):
            return False, "click_failed"
        time.sleep(0.2)

        log("bgv2：已提交（零焦点）")
        return True, "sent"
    except Exception as exc:  # noqa: BLE001
        return False, "error:" + type(exc).__name__
