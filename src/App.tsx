import { useEffect, useMemo, useState } from 'react';
import type { KnowledgeEntry, KnowledgeFormState, Importance, Screen } from './types';
import { deleteKnowledge, getAllKnowledge, getKnowledgeById, saveKnowledge, seedDemoDataIfEmpty } from './lib/db';
import { buildReviewQueue } from './lib/review';
import {
  createId,
  formatDate,
  formatDateTime,
  importanceLabel,
  normalizeTags,
  scoreTextByImportance,
  sortEntriesByUpdatedAt,
  tagsToText,
  uniqueTags,
} from './lib/utils';

const EMPTY_FORM: KnowledgeFormState = {
  title: '',
  content: '',
  tagsText: '',
  importance: 3,
};

function toFormState(entry: KnowledgeEntry): KnowledgeFormState {
  return {
    title: entry.title,
    content: entry.content,
    tagsText: tagsToText(entry.tags),
    importance: entry.importance,
  };
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<KnowledgeFormState>(EMPTY_FORM);
  const [reviewQueue, setReviewQueue] = useState<KnowledgeEntry[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function reloadEntries() {
    const list = await getAllKnowledge();
    setEntries(sortEntriesByUpdatedAt(list));
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await seedDemoDataIfEmpty();
        const list = await getAllKnowledge();
        if (mounted) setEntries(sortEntriesByUpdatedAt(list));
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : '読み込みに失敗しました');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(''), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const tags = useMemo(() => uniqueTags(entries), [entries]);

  const filteredEntries = useMemo(() => {
    const lowerSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const matchSearch =
        !lowerSearch ||
        entry.title.toLowerCase().includes(lowerSearch) ||
        entry.content.toLowerCase().includes(lowerSearch) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(lowerSearch));

      const matchTag = tagFilter === 'all' || entry.tags.includes(tagFilter);
      const matchImportance =
        importanceFilter === 'all' || String(entry.importance) === importanceFilter;

      return matchSearch && matchTag && matchImportance;
    });
  }, [entries, search, tagFilter, importanceFilter]);

  const reviewCountToday = useMemo(() => buildReviewQueue(entries, 20).length, [entries]);
  const totalTags = tags.length;

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? null,
    [entries, selectedId]
  );

  const currentReviewEntry = reviewQueue[reviewIndex] ?? null;

  function openCreateScreen() {
    setEditing(false);
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setScreen('create');
  }

  function openDetail(entry: KnowledgeEntry) {
    setSelectedId(entry.id);
    setEditing(false);
    setScreen('detail');
  }

  function startReview() {
    const queue = buildReviewQueue(entries, 20);
    if (queue.length === 0) {
      setMessage('復習対象がありません。まずは知識を登録してください。');
      return;
    }
    setReviewQueue(queue);
    setReviewIndex(0);
    setShowAnswer(false);
    setScreen('review');
  }

  async function loadDetailEntry(id: string) {
    try {
      const entry = await getKnowledgeById(id);
      if (!entry) {
        setError('データが見つかりませんでした');
        setScreen('list');
        return;
      }
      setSelectedId(entry.id);
      setForm(toFormState(entry));
    } catch (err) {
      setError(err instanceof Error ? err.message : '詳細の取得に失敗しました');
    }
  }

  async function handleEditSelected() {
    if (!selectedEntry) return;
    setForm(toFormState(selectedEntry));
    setEditing(true);
  }

  async function handleDeleteSelected() {
    if (!selectedEntry) return;
    const ok = window.confirm(`「${selectedEntry.title}」を削除しますか？`);
    if (!ok) return;

    setBusy(true);
    try {
      await deleteKnowledge(selectedEntry.id);
      await reloadEntries();
      setMessage('削除しました');
      setScreen('list');
      setSelectedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveForm() {
    const title = form.title.trim();
    const content = form.content.trim();
    const tags = normalizeTags(form.tagsText);

    if (!title || !content) {
      setError('タイトルと内容は必須です');
      return;
    }

    setBusy(true);
    try {
      const now = Date.now();

      if (screen === 'create') {
        const entry: KnowledgeEntry = {
          id: createId(),
          title,
          content,
          tags,
          importance: form.importance,
          createdAt: now,
          updatedAt: now,
          lastReviewedAt: null,
          reviewCount: 0,
          rememberedCount: 0,
          forgottenCount: 0,
        };
        await saveKnowledge(entry);
        setMessage('保存しました');
      } else if (screen === 'detail' && selectedEntry) {
        const updated: KnowledgeEntry = {
          ...selectedEntry,
          title,
          content,
          tags,
          importance: form.importance,
          updatedAt: now,
        };
        await saveKnowledge(updated);
        setMessage('更新しました');
      }

      await reloadEntries();
      setEditing(false);
      setSelectedId(null);
      setScreen('list');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  async function handleReviewResult(remembered: boolean) {
    if (!currentReviewEntry) return;

    setBusy(true);
    try {
      const latest = (await getKnowledgeById(currentReviewEntry.id)) ?? currentReviewEntry;
      const now = Date.now();

      const updated: KnowledgeEntry = {
        ...latest,
        lastReviewedAt: now,
        updatedAt: now,
        reviewCount: latest.reviewCount + 1,
        rememberedCount: latest.rememberedCount + (remembered ? 1 : 0),
        forgottenCount: latest.forgottenCount + (remembered ? 0 : 1),
      };

      await saveKnowledge(updated);
      await reloadEntries();

      const nextIndex = reviewIndex + 1;
      if (nextIndex >= reviewQueue.length) {
        setScreen('home');
        setMessage('本日の復習を完了しました');
        return;
      }

      setReviewIndex(nextIndex);
      setShowAnswer(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '復習記録の保存に失敗しました');
    } finally {
      setBusy(false);
    }
  }

  function backFromDetail() {
    if (editing) {
      setEditing(false);
      return;
    }
    setSelectedId(null);
    setScreen('list');
  }

  function renderHeader(title: string, backAction?: () => void) {
    return (
      <header className="app-header">
        <div className="header-left">
          {backAction ? (
            <button className="icon-button" onClick={backAction} aria-label="戻る">
              ←
            </button>
          ) : (
            <div className="icon-spacer" />
          )}
          <div>
            <h1>{title}</h1>
            <p className="header-subtitle">自分専用の知識ストック</p>
          </div>
        </div>
        <div className="header-badge">{entries.length}件</div>
      </header>
    );
  }

  function renderHome() {
    return (
      <main className="page">
        {renderHeader('俺の知識帳')}
        <section className="hero-card">
          <div className="hero-grid">
            <div className="stat-card">
              <span className="stat-label">今日の復習</span>
              <strong className="stat-value">{reviewCountToday}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">知識総数</span>
              <strong className="stat-value">{entries.length}</strong>
            </div>
            <div className="stat-card">
              <span className="stat-label">タグ数</span>
              <strong className="stat-value">{totalTags}</strong>
            </div>
          </div>

          <div className="action-grid">
            <button className="primary-button" onClick={startReview}>
              復習開始
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setScreen('list');
                setMessage('');
              }}
            >
              知識一覧
            </button>
            <button className="secondary-button" onClick={openCreateScreen}>
              新規登録
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-title-row">
            <h2>最近更新した知識</h2>
            <button className="text-button" onClick={() => setScreen('list')}>
              すべて見る
            </button>
          </div>

          <div className="card-list">
            {entries.slice(0, 5).map((entry) => (
              <button
                key={entry.id}
                className="knowledge-preview"
                onClick={() => openDetail(entry)}
              >
                <div className="preview-top">
                  <strong>{entry.title}</strong>
                  <span className="importance-pill">{importanceLabel(entry.importance)}</span>
                </div>
                <p className="preview-content">{entry.content}</p>
                <div className="tag-row">
                  {entry.tags.slice(0, 3).map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}

            {entries.length === 0 && <p className="empty-text">まだ知識がありません。</p>}
          </div>
        </section>
      </main>
    );
  }

  function renderList() {
    return (
      <main className="page">
        {renderHeader('知識一覧', () => setScreen('home'))}

        <section className="card">
          <div className="filter-grid">
            <label className="field">
              <span>検索</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="タイトル・内容・タグ"
              />
            </label>

            <label className="field">
              <span>タグ</span>
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                <option value="all">すべて</option>
                {tags.map((tag) => (
                  <option value={tag} key={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>重要度</span>
              <select
                value={importanceFilter}
                onChange={(e) => setImportanceFilter(e.target.value)}
              >
                <option value="all">すべて</option>
                <option value="1">★1</option>
                <option value="2">★2</option>
                <option value="3">★3</option>
                <option value="4">★4</option>
                <option value="5">★5</option>
              </select>
            </label>
          </div>

          <div className="summary-row">
            <span>表示件数：{filteredEntries.length}</span>
            <button className="text-button" onClick={openCreateScreen}>
              ＋ 新規登録
            </button>
          </div>
        </section>

        <section className="card-list">
          {filteredEntries.map((entry) => (
            <button
              key={entry.id}
              className="knowledge-card"
              onClick={() => openDetail(entry)}
            >
              <div className="preview-top">
                <strong>{entry.title}</strong>
                <span className="importance-pill">{importanceLabel(entry.importance)}</span>
              </div>
              <p className="preview-content">{entry.content}</p>
              <div className="tag-row">
                {entry.tags.length > 0 ? (
                  entry.tags.map((tag) => (
                    <span className="tag" key={tag}>
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="tag muted">タグなし</span>
                )}
              </div>
              <div className="meta-row">
                <span>最終復習：{formatDateTime(entry.lastReviewedAt)}</span>
                <span>更新：{formatDate(entry.updatedAt)}</span>
              </div>
            </button>
          ))}

          {filteredEntries.length === 0 && (
            <div className="empty-card">
              条件に合う知識がありません。
            </div>
          )}
        </section>
      </main>
    );
  }

  function renderForm() {
    const title = screen === 'create' ? '新規登録' : '編集';
    return (
      <main className="page">
        {renderHeader(title, backFromDetail)}

        <section className="card">
          <div className="field">
            <span>タイトル</span>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="例：OSI参照モデル"
            />
          </div>

          <div className="field">
            <span>内容</span>
            <textarea
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="覚えたい内容を短く整理"
              rows={8}
            />
          </div>

          <div className="field">
            <span>タグ</span>
            <input
              value={form.tagsText}
              onChange={(e) => setForm((prev) => ({ ...prev, tagsText: e.target.value }))}
              placeholder="例：基本情報, ネットワーク, SQL"
            />
            <small className="helper-text">カンマ、読点、改行で区切れます。</small>
          </div>

          <div className="field">
            <span>重要度</span>
            <select
              value={form.importance}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  importance: Number(e.target.value) as Importance,
                }))
              }
            >
              <option value="1">★1 低</option>
              <option value="2">★2 やや低</option>
              <option value="3">★3 標準</option>
              <option value="4">★4 高</option>
              <option value="5">★5 最重要</option>
            </select>
          </div>

          <div className="action-row">
            <button className="primary-button" onClick={handleSaveForm} disabled={busy}>
              保存
            </button>
            <button className="secondary-button" onClick={backFromDetail} disabled={busy}>
              キャンセル
            </button>
          </div>
        </section>
      </main>
    );
  }

  function renderDetail() {
    if (!selectedEntry) {
      return (
        <main className="page">
          {renderHeader('詳細', () => setScreen('list'))}
          <div className="empty-card">データが見つかりませんでした。</div>
        </main>
      );
    }

    if (editing) return renderForm();

    return (
      <main className="page">
        {renderHeader('詳細', () => setScreen('list'))}

        <section className="card">
          <div className="detail-top">
            <div>
              <h2 className="detail-title">{selectedEntry.title}</h2>
              <p className="detail-subtitle">
                重要度：{importanceLabel(selectedEntry.importance)} / {scoreTextByImportance(selectedEntry.importance)}
              </p>
            </div>
            <div className="detail-actions">
              <button className="secondary-button" onClick={handleEditSelected}>
                編集
              </button>
              <button className="danger-button" onClick={handleDeleteSelected} disabled={busy}>
                削除
              </button>
            </div>
          </div>

          <div className="detail-content">{selectedEntry.content}</div>

          <div className="tag-row">
            {selectedEntry.tags.length > 0 ? (
              selectedEntry.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))
            ) : (
              <span className="tag muted">タグなし</span>
            )}
          </div>

          <div className="detail-meta">
            <div>作成日：{formatDate(selectedEntry.createdAt)}</div>
            <div>更新日：{formatDate(selectedEntry.updatedAt)}</div>
            <div>最終復習：{formatDateTime(selectedEntry.lastReviewedAt)}</div>
            <div>復習回数：{selectedEntry.reviewCount}</div>
            <div>覚えた：{selectedEntry.rememberedCount}</div>
            <div>忘れた：{selectedEntry.forgottenCount}</div>
          </div>
        </section>
      </main>
    );
  }

  function renderReview() {
    if (!currentReviewEntry) {
      return (
        <main className="page">
          {renderHeader('復習', () => setScreen('home'))}
          <div className="empty-card">復習対象がありません。</div>
        </main>
      );
    }

    return (
      <main className="page">
        {renderHeader('復習モード', () => setScreen('home'))}

        <section className="card review-card">
          <div className="review-progress">
            <span>
              {reviewIndex + 1} / {reviewQueue.length}
            </span>
            <span>今日の復習</span>
          </div>

          <h2 className="review-title">{currentReviewEntry.title}</h2>

          {!showAnswer ? (
            <>
              <p className="review-hint">まずはタイトルを見て思い出してみてください。</p>
              <button className="primary-button" onClick={() => setShowAnswer(true)}>
                答えを見る
              </button>
            </>
          ) : (
            <>
              <div className="review-answer">{currentReviewEntry.content}</div>
              <div className="tag-row">
                {currentReviewEntry.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="action-row">
                <button
                  className="secondary-button"
                  onClick={() => handleReviewResult(false)}
                  disabled={busy}
                >
                  忘れていた
                </button>
                <button
                  className="primary-button"
                  onClick={() => handleReviewResult(true)}
                  disabled={busy}
                >
                  覚えていた
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <div className="status-bar">
        {message && <div className="toast success">{message}</div>}
        {error && <div className="toast error">{error}</div>}
      </div>

      {loading ? (
        <main className="page center-page">
          <div className="loading-card">読み込み中…</div>
        </main>
      ) : screen === 'home' ? (
        renderHome()
      ) : screen === 'list' ? (
        renderList()
      ) : screen === 'create' ? (
        renderForm()
      ) : screen === 'detail' ? (
        renderDetail()
      ) : (
        renderReview()
      )}
    </div>
  );
}

export default App;