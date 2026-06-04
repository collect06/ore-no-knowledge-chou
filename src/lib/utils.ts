import type { KnowledgeEntry, Importance } from '../types';

const DAY = 1000 * 60 * 60 * 24;

export function createId(): string {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `k_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function normalizeTags(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .replaceAll('、', ',')
        .split(/[\n,]/g)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

export function tagsToText(tags: string[]): string {
  return tags.join(', ');
}

export function formatDateTime(value: number | null): string {
  if (!value) return '未復習';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDate(value: number): string {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function daysSince(value: number, now = Date.now()): number {
  return Math.floor((now - value) / DAY);
}

export function importanceLabel(value: Importance): string {
  return '★'.repeat(value);
}

export function uniqueTags(entries: KnowledgeEntry[]): string[] {
  return Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((a, b) =>
    a.localeCompare(b, 'ja')
  );
}

export function sortEntriesByUpdatedAt(entries: KnowledgeEntry[]): KnowledgeEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function scoreTextByImportance(importance: Importance): string {
  switch (importance) {
    case 1:
      return '低';
    case 2:
      return 'やや低';
    case 3:
      return '標準';
    case 4:
      return '高';
    case 5:
      return '最重要';
  }
}