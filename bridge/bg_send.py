# -*- coding: utf-8 -*-
"""Best-effort background (zero-focus) send channel.

WeChat 4.x renders with Qt and does not expose a stable Win32 edit control, so a
fully reliable zero-focus send is hard. This module provides a *best-effort*
background path:

  1. Open the target chat and focus the input using the UIA driver, then
  2. Type the text with `PostMessageW(WM_CHAR)` instead of `SendInput`, so no
     keyboard hook steals the user's focus mid-type, and
  3. Send with `PostMessageW(WM_KEYDOWN/UP, VK_RETURN)`.

Any failure returns `False` so the caller falls back to the foreground UIA
channel. This is intentionally conservative: it never blocks or half-sends.
"""

from __future__ import annotations

import ctypes
import time

user32 = ctypes.windll.user32

WM_CHAR = 0x0102
WM_KEYDOWN = 0x0100
WM_KEYUP = 0x0101
VK_RETURN = 0x0D
WM_SETTEXT = 0x000C


def _find_input_hwnd(gui) -> int | None:
    """Locate a usable chat-input HWND through the UIA driver."""
    try:
        box = getattr(gui, "focus_input", None)
        if box is None:
            return None
        if not box():
            return None
        # focus_input returns a bounding box on some versions; try to discover
        # the focused element's native HWND from the UIA element.
        uia = gui._get_uia()  # noqa: SLF001
        if uia is None:
            return None
        element = getattr(uia, "_input_element", None)
        if element is None:
            return None
        hwnd = getattr(element, "CurrentNativeWindowHandle", None)
        return int(hwnd) if hwnd else None
    except Exception:  # noqa: BLE001
        return None


def _post_text(hwnd: int, text: str) -> bool:
    for ch in text:
        for unit in ch:  # handles surrogate pairs (emoji)
            if not user32.PostMessageW(hwnd, WM_CHAR, ord(unit), 0):
                return False
    return True


def send_background(who: str, text: str) -> bool:
    """Send `text` to `who` without stealing focus. Returns False on any
    failure (caller should fall back to the foreground channel)."""
    try:
        from wechatauto import WeChatGUI  # noqa: PLC0415

        gui = WeChatGUI()
        uia = gui._get_uia()  # noqa: SLF001
        if uia is None or not uia.open_chat(who):
            return False
        hwnd = _find_input_hwnd(gui)
        if hwnd is None:
            return False
        if not _post_text(hwnd, text):
            return False
        user32.PostMessageW(hwnd, WM_KEYDOWN, VK_RETURN, 0)
        time.sleep(0.05)
        user32.PostMessageW(hwnd, WM_KEYUP, VK_RETURN, 0)
        return True
    except Exception:  # noqa: BLE001
        return False
