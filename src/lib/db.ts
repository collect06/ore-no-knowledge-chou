import type { KnowledgeEntry } from '../types';
import { createId } from './utils';

const DB_NAME = 'ore-no-knowledge-chou';
const DB_VERSION = 1;
const STORE_NAME = 'knowledge';

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });

  return dbPromise;
}

async function readAll(): Promise<KnowledgeEntry[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return requestToPromise(store.getAll());
}

async function countAll(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return requestToPromise(store.count());
}

export async function getAllKnowledge(): Promise<KnowledgeEntry[]> {
  return readAll();
}

export async function getKnowledgeById(id: string): Promise<KnowledgeEntry | undefined> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  return requestToPromise(store.get(id));
}

export async function saveKnowledge(entry: KnowledgeEntry): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await requestToPromise(store.put(entry));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save knowledge'));
    tx.onabort = () => reject(tx.error ?? new Error('Failed to save knowledge'));
  });
}

export async function deleteKnowledge(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await requestToPromise(store.delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete knowledge'));
    tx.onabort = () => reject(tx.error ?? new Error('Failed to delete knowledge'));
  });
}

export async function seedDemoDataIfEmpty(): Promise<boolean> {
  const count = await countAll();
  if (count > 0) return false;

  const now = Date.now();
  const samples: KnowledgeEntry[] = [
    {
      id: createId(),
      title: 'OSI参照モデル',
      content:
        '7層モデル。物理層 / データリンク層 / ネットワーク層 / トランスポート層 / セッション層 / プレゼンテーション層 / アプリケーション層。',
      tags: ['基本情報', 'ネットワーク'],
      importance: 5,
      createdAt: now,
      updatedAt: now,
      lastReviewedAt: null,
      reviewCount: 0,
      rememberedCount: 0,
      forgottenCount: 0,
    },
    {
      id: createId(),
      title: 'INNER JOIN',
      content: '両方のテーブルに一致する行だけを返す結合。共通部分を取りたいときに使う。',
      tags: ['基本情報', 'DB', 'SQL'],
      importance: 4,
      createdAt: now - 86_400_000,
      updatedAt: now - 86_400_000,
      lastReviewedAt: now - 8 * 86_400_000,
      reviewCount: 2,
      rememberedCount: 2,
      forgottenCount: 0,
    },
    {
      id: createId(),
      title: 'CSMA/CD',
      content: '衝突検出の仕組み。共有媒体で通信がぶつかったら検出して再送する。',
      tags: ['基本情報', 'ネットワーク'],
      importance: 3,
      createdAt: now - 2 * 86_400_000,
      updatedAt: now - 2 * 86_400_000,
      lastReviewedAt: now - 4 * 86_400_000,
      reviewCount: 1,
      rememberedCount: 1,
      forgottenCount: 0,
    },
    {
      id: createId(),
      title: '二進数と十進数',
      content: '2進数は0と1で表す。ビットは情報量の最小単位。',
      tags: ['基礎', '数学'],
      importance: 2,
      createdAt: now - 3 * 86_400_000,
      updatedAt: now - 3 * 86_400_000,
      lastReviewedAt: null,
      reviewCount: 0,
      rememberedCount: 0,
      forgottenCount: 0,
    },
    {
      id: createId(),
      title: 'ハッシュ関数',
      content: '入力を固定長の値に変換する関数。パスワード保存などで使う。',
      tags: ['基本情報', 'セキュリティ'],
      importance: 4,
      createdAt: now - 5 * 86_400_000,
      updatedAt: now - 5 * 86_400_000,
      lastReviewedAt: now - 2 * 86_400_000,
      reviewCount: 1,
      rememberedCount: 1,
      forgottenCount: 0,
    },
  ];

  for (const sample of samples) {
    await saveKnowledge(sample);
  }

  return true;
}