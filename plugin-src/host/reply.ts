// Reply-trigger judgment and humanization (bubble splitting, punctuation
// trimming, anti-parroting de-duplication).

import type { HumanizeConfig, WechatConnecterConfig } from "./config";

export interface InboundMeta {
  peerType: "contact" | "group";
  content: string;
  isAt: boolean;
  botName: string;
  /** Whether the bot has recently replied in this group (for topic continuation). */
  botParticipatedRecently?: boolean;
}

/** Decide whether the bot should reply to an inbound message. */
export function shouldReply(config: WechatConnecterConfig, meta: InboundMeta): boolean {
  if (meta.peerType === "group") {
    if (!config.group.enabled) return false;
    const named =
      meta.isAt ||
      (meta.botName && meta.content.includes(meta.botName)) ||
      config.group.triggerWords.some((word) => word && meta.content.includes(word));
    if (named) return true;
    // Topic continuation: only when the bot already took part in the chat.
    if (config.group.topicContinuation && meta.botParticipatedRecently) return true;
    return false;
  }
  // Private chat.
  if (!config.private.enabled) return false;
  if (config.private.replyStrategy === "mention") {
    const named =
      (meta.botName && meta.content.includes(meta.botName)) ||
      config.private.triggerWords.some((word) => word && meta.content.includes(word));
    return named;
  }
  return true;
}

const SENTENCE_END = /[。！？!?…~～\n]+/;

/** Trim trailing punctuation / whitespace from a bubble. */
export function stripTrailingPunct(text: string): string {
  return text.replace(/[\s。！？!?…~～.,，、;；:：]+$/u, "");
}

function isOpenPunct(ch: string): boolean {
  return "（(【[《“\"‘'「『".includes(ch);
}

function isClosePunct(ch: string): boolean {
  return "）)】]》”\"’'」』".includes(ch);
}

/**
 * Split a long reply into short bubbles.
 *
 * Splits on sentence-ending punctuation, but keeps parenthetical asides
 * (「（笑）」「（托腮）」 etc.) attached to their preceding sentence instead of
 * emitting them as a dangling bubble — this fixes whale_girl's split bug.
 * Overlong segments are further split on commas, then hard-wrapped.
 */
export function splitIntoBubbles(text: string, maxChars: number): string[] {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const max = Math.max(20, Math.floor(maxChars) || 120);

  // First pass: split into sentence-level segments, tracking bracket depth so
  // parenthetical asides stay with the sentence that opened them.
  const segments: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of raw) {
    current += ch;
    if (isOpenPunct(ch)) depth += 1;
    else if (isClosePunct(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && SENTENCE_END.test(ch)) {
      const seg = current.trim();
      if (seg) segments.push(seg);
      current = "";
    }
  }
  if (current.trim()) segments.push(current.trim());

  // Second pass: break overlong segments.
  const bubbles: string[] = [];
  for (const seg of segments) {
    if (seg.length <= max) {
      bubbles.push(seg);
      continue;
    }
    // Split on commas first, keeping bracket content together.
    const parts: string[] = [];
    let d = 0;
    let cur = "";
    for (const ch of seg) {
      cur += ch;
      if (isOpenPunct(ch)) d += 1;
      else if (isClosePunct(ch)) d = Math.max(0, d - 1);
      if (d === 0 && "，,、;；".includes(ch) && cur.length >= max * 0.6) {
        parts.push(cur.trim());
        cur = "";
      }
    }
    if (cur.trim()) parts.push(cur.trim());
    for (const part of parts) {
      if (part.length <= max) {
        bubbles.push(part);
      } else {
        // Hard-wrap as a last resort.
        for (let i = 0; i < part.length; i += max) {
          bubbles.push(part.slice(i, i + max));
        }
      }
    }
  }
  return bubbles.map((b) => b.trim()).filter(Boolean);
}

function normalizeForCompare(text: string): string {
  return text.replace(/[\s，。！？!?…~～、,.;；:：'"“”‘’()（）【】\[\]]+/gu, "");
}

/**
 * Apply humanization to a reply. Returns an array of bubbles to send (may be
 * empty when the reply is suppressed as a parroted repeat).
 */
export function humanizeReply(
  config: WechatConnecterConfig,
  replyText: string,
  inboundText: string,
): string[] {
  const h: HumanizeConfig = config.humanize;
  let text = String(replyText ?? "").trim();
  if (!text) return [];

  // Anti-parroting: drop replies that merely echo the inbound message.
  if (h.dedupeRepeat) {
    const r = normalizeForCompare(text);
    const u = normalizeForCompare(inboundText);
    if (r && (r === u || u.includes(r) || r.includes(u) && r.length >= Math.min(6, u.length))) {
      // Echoing a short phrase adds nothing; suppress. Long inbound that fully
      // contains a short reply is still a parroted echo.
      if (r.length < 24) return [];
    }
  }

  let bubbles: string[];
  if (h.splitLongReply) {
    bubbles = splitIntoBubbles(text, h.maxBubbleChars);
  } else {
    bubbles = [text];
  }

  if (h.stripTrailingPunct) {
    bubbles = bubbles.map((b) => stripTrailingPunct(b)).filter(Boolean);
  }

  // De-duplicate consecutive identical bubbles (model repetition).
  const deduped: string[] = [];
  for (const bubble of bubbles) {
    if (deduped.length > 0 && deduped[deduped.length - 1] === bubble) continue;
    deduped.push(bubble);
  }
  return deduped;
}
