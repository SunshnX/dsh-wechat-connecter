export interface MemoryTarget {
  file: string;
  legacySeed?: string;
}
export interface MemoryChain {
  exists: boolean;
  text: string;
  index: string;
  source: string;
  topic: string;
}
export function createMemoryLayout(
  root: string | (() => string),
  readText: (file: string) => string | null,
): {
  writeTarget(scope: string, opts: { layered: boolean; topic: string }): MemoryTarget;
  readChain(scopes: string[], opts: { layered: boolean; topic: string }): MemoryChain;
};
export function normalizeMemoryTopic(topic: unknown): string;
export function retainMemoryEnds(text: string, cap: number): string;
export function stripTopicIndex(text: string): { text: string; stripped: string };
export function safeMemoryName(value: unknown, fallback?: string): string;
export function renderTopicIndex(topics: unknown): string;
export function topicDescriptor(file: string, text: string): unknown;
export const TOPIC_INDEX_HEADING: string;
