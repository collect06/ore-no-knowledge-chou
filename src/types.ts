export type Screen = 'home' | 'list' | 'create' | 'detail' | 'review';

export type Importance = 1 | 2 | 3 | 4 | 5;

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  importance: Importance;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt: number | null;
  reviewCount: number;
  rememberedCount: number;
  forgottenCount: number;
}

export interface KnowledgeFormState {
  title: string;
  content: string;
  tagsText: string;
  importance: Importance;
}