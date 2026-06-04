import type { KnowledgeEntry } from '../types';
import { daysSince } from './utils';

function compareForReview(a: KnowledgeEntry, b: KnowledgeEntry): number {
  if (a.importance !== b.importance) return b.importance - a.importance;
  return a.updatedAt - b.updatedAt;
}

export function buildReviewQueue(entries: KnowledgeEntry[], limit = 20): KnowledgeEntry[] {
  const now = Date.now();
  const buckets: KnowledgeEntry[][] = [[], [], [], []];

  for (const entry of entries) {
    if (entry.lastReviewedAt === null) {
      buckets[0].push(entry);
      continue;
    }

    const diffDays = daysSince(entry.lastReviewedAt, now);
    if (diffDays >= 7) buckets[1].push(entry);
    else if (diffDays >= 3) buckets[2].push(entry);
    else buckets[3].push(entry);
  }

  buckets[0].sort(compareForReview);
  buckets[1].sort((a, b) => a.lastReviewedAt! - b.lastReviewedAt!);
  buckets[2].sort((a, b) => a.lastReviewedAt! - b.lastReviewedAt!);
  buckets[3].sort(compareForReview);

  return [...buckets[0], ...buckets[1], ...buckets[2], ...buckets[3]].slice(0, limit);
}