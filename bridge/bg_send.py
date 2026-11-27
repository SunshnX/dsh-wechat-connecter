# -*- coding: utf-8 -*-
"""后台（零焦点）发送通道 —— 尽力而为。

思路：通过 wechatauto 的 UIA driver 打开目标会话并拿到聊天输入框的 UIA 元素，
再用 `PostMessageW(WM_CHAR)` 把文本逐字符投递到输入框的原生窗口句柄，最后
`PostMessageW(WM_KEYDOWN/UP, VK_RETURN)` 发送——全程不抢前台焦点、不模拟键盘。

注意：微信 4.x 用 Qt 自绘，输入框的原生句柄可能并非独立 HWND（Qt 控件通常不
创建真实子窗口）。因此本通道是「尽力而为」：任何一步失败都会返回 False，由调用
方回退到前台 UIA 通道。
"""

from __future__ import annotations

import ctypes
import time

user32 = ctypes.windll.user32

WM_CHAR = 0x0102
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
VK_RETURN = 0x0D


def _hwnd_of(element) -> int | None:
    """从 UIA 元素提取原生窗口句柄。"""
    try:
        hwnd = int(element.NativeWindowHandle)
        if hwnd:
            return hwnd
    except Exception:  # noqa: BLE001
        pass
    try:
        hwnd = int(element.GetTopLevelControl().NativeWindowHandle)
        if hwnd:
            return hwnd
    except Exception:  # noqa: BLE001
        pass
    return None


def _post_text(hwnd: int, text: str) -> bool:
    """逐字符投递 WM_CHAR（微信 4.2 起 wParam 按 UTF-16 码元解释，含 emoji 代理对）。"""
    for ch in text:
        for unit in ch:  # 处理 surrogate pair（emoji 等）
            if not user32.PostMessageW(hwnd, WM_CHAR, ord(unit), 0):
                return False
    return True


def send_background(gui, who: str, text: str) -> bool:
    """后台发送 `text` 给 `who`。失败返回 False，调用方回退前台通道。"""
    try:
        uia = gui._get_uia()  # noqa: SLF001
        if uia is None:
            return False
        if not uia.open_chat(who):
            return False
        element = uia._chat_input()  # noqa: SLF001
        if element is None:
            return False
        hwnd = _hwnd_of(element)
        if not hwnd:
            return False
        if not _post_text(hwnd, text):
            return False
        user32.PostMessageW(hwnd, WM_KEYDOWN, VK_RETURN, 0)
        time.sleep(0.05)
        user32.PostMessageW(hwnd, WM_KEYUP, VK_RETURN, 0)
        return True
    except Exception:  # noqa: BLE001
        return False
