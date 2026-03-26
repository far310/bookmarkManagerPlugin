import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Search, X, Plus, FolderPlus, Bookmark, Folder,
  Pencil, Trash2, FolderInput, Check, BookmarkX,
  ChevronRight, Settings2, RotateCcw, Loader2,
} from 'lucide-react';
import '@pages/options/Options.css';
import { ApiResponse, BookmarkAction, BookmarkNode } from '@src/types/bookmark';
import { Button } from '@src/components/animate-ui/components/buttons/button';
import { Fade } from '@src/components/animate-ui/primitives/effects/fade';
import { SlidingNumber } from '@src/components/animate-ui/primitives/texts/sliding-number';

function sendAction<T>(action: BookmarkAction): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(action, (response: ApiResponse<T>) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'Failed to communicate with background'));
        return;
      }
      resolve(response);
    });
  });
}

function flattenFolders(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];

  const walk = (list: BookmarkNode[]) => {
    list.forEach((node) => {
      const isFolder = !node.url;
      if (isFolder && node.parentId !== undefined) {
        result.push(node);
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    });
  };

  walk(nodes);
  return result;
}

function isRootNode(node: BookmarkNode): boolean {
  return node.parentId === undefined;
}

export default function Options() {
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createType, setCreateType] = useState<'bookmark' | 'folder'>('bookmark');
  const [createTitle, setCreateTitle] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [createParentId, setCreateParentId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  const isSearching = searchQuery.trim().length > 0;
  const shownNodes = isSearching ? searchResults : tree;
  const folders = useMemo(() => flattenFolders(tree), [tree]);

  useEffect(() => {
    void refreshList();
  }, []);

  async function refreshList() {
    setLoading(true);
    setError(null);
    try {
      const response = await sendAction<BookmarkNode[]>({ type: 'LIST_BOOKMARKS' });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setTree(response.data);
      if (!createParentId && response.data.length > 0) {
        const defaultFolder = flattenFolders(response.data)[0];
        if (defaultFolder) {
          setCreateParentId(defaultFolder.id);
        }
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to load bookmarks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCurrentView() {
    if (!isSearching) {
      await refreshList();
      return;
    }

    await handleSearch();
  }

  async function handleSearch() {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      await refreshList();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await sendAction<BookmarkNode[]>({
        type: 'SEARCH_BOOKMARKS',
        payload: { query },
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setSearchResults(response.data);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Search failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!createTitle.trim()) {
      setError('Title is required');
      return;
    }

    if (createType === 'bookmark' && !createUrl.trim()) {
      setError('URL is required for bookmarks');
      return;
    }

    setLoading(true);
    try {
      const response = await sendAction<BookmarkNode>({
        type: 'CREATE_BOOKMARK',
        payload: {
          title: createTitle,
          url: createType === 'bookmark' ? createUrl : undefined,
          parentId: createParentId || undefined,
        },
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setCreateTitle('');
      setCreateUrl('');
      setSuccess(`${createType === 'bookmark' ? 'Bookmark' : 'Folder'} created`);
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Create operation failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(node: BookmarkNode) {
    const confirmDelete = window.confirm(`Delete "${node.title || 'Untitled'}"?`);
    if (!confirmDelete) {
      return;
    }

    setActionPendingId(node.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await sendAction<{ id: string }>({
        type: 'DELETE_BOOKMARK',
        payload: { id: node.id },
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setSuccess('Item deleted');
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Delete operation failed';
      setError(message);
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleRename(node: BookmarkNode) {
    if (!editingTitle.trim()) {
      setError('Title is required');
      return;
    }

    setActionPendingId(node.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await sendAction<BookmarkNode>({
        type: 'RENAME_BOOKMARK',
        payload: { id: node.id, title: editingTitle },
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setEditingId(null);
      setEditingTitle('');
      setSuccess('Item renamed');
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Rename operation failed';
      setError(message);
    } finally {
      setActionPendingId(null);
    }
  }

  async function handleMove(node: BookmarkNode) {
    const targetFolderId = moveTargets[node.id];
    if (!targetFolderId) {
      setError('Choose a target folder');
      return;
    }

    setActionPendingId(node.id);
    setError(null);
    setSuccess(null);
    try {
      const response = await sendAction<BookmarkNode>({
        type: 'MOVE_BOOKMARK',
        payload: { id: node.id, parentId: targetFolderId },
      });

      if (!response.ok) {
        setError(response.error);
        return;
      }

      setSuccess('Item moved');
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Move operation failed';
      setError(message);
    } finally {
      setActionPendingId(null);
    }
  }

  function renderNodes(nodes: BookmarkNode[], depth = 0): React.ReactNode {
    return nodes.map((node, idx) => {
      const isFolder = !node.url;
      const isRoot = isRootNode(node);
      const isPending = actionPendingId === node.id;
      const canShowChildren = !isSearching && !!node.children?.length;

      return (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.2) }}
        >
          <div
            className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur transition hover:border-indigo-200 hover:shadow-md"
            style={{ marginLeft: depth > 0 ? `${depth * 20}px` : undefined }}
          >
            {/* left accent bar */}
            <div
              className={[
                'absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl',
                isFolder ? 'bg-amber-400/60' : 'bg-indigo-500/60',
              ].join(' ')}
            />

            <div className="flex flex-col gap-3 px-4 py-3 pl-5">
              {/* top row: icon + title/url + type badge */}
              <div className="flex items-start gap-3">
                <div
                  className={[
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm',
                    isFolder ? 'bg-amber-100' : 'bg-indigo-100',
                  ].join(' ')}
                >
                  {isFolder ? (
                    <Folder className="size-4 text-amber-600" />
                  ) : (
                    <Bookmark className="size-4 text-indigo-600" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {editingId === node.id ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 rounded-xl border border-indigo-300 bg-indigo-50/60 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 transition"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleRename(node);
                          if (e.key === 'Escape') { setEditingId(null); setEditingTitle(''); }
                        }}
                      />
                      <Button
                        className="rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 gap-1"
                        onClick={() => void handleRename(node)}
                        disabled={isPending}
                        hoverScale={1.04} tapScale={0.95}
                      >
                        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                        Save
                      </Button>
                      <Button
                        className="rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => { setEditingId(null); setEditingTitle(''); }}
                        hoverScale={1.03} tapScale={0.97}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {node.title || '(Untitled)'}
                      </div>
                      {node.url && (
                        <a
                          href={node.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-xs text-indigo-500 hover:text-indigo-700 hover:underline transition"
                        >
                          {node.url}
                        </a>
                      )}
                    </>
                  )}
                </div>

                {!isRoot && editingId !== node.id && (
                  <span
                    className={[
                      'mt-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      isFolder ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700',
                    ].join(' ')}
                  >
                    {isFolder ? 'Folder' : 'Bookmark'}
                  </span>
                )}
              </div>

              {/* action row */}
              {!isRoot && editingId !== node.id && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                  <Button
                    className="gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                    onClick={() => { setEditingId(node.id); setEditingTitle(node.title); }}
                    disabled={isPending}
                    hoverScale={1.04} tapScale={0.95}
                  >
                    <Pencil className="size-3" />
                    Rename
                  </Button>

                  <div className="flex gap-1.5">
                    <select
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-indigo-300 transition disabled:opacity-50"
                      value={moveTargets[node.id] || ''}
                      onChange={(e) => setMoveTargets((prev) => ({ ...prev, [node.id]: e.target.value }))}
                      disabled={isPending}
                    >
                      <option value="">Move to…</option>
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.title || '(Untitled Folder)'}
                        </option>
                      ))}
                    </select>
                    <Button
                      className="gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                      onClick={() => void handleMove(node)}
                      disabled={isPending}
                      hoverScale={1.04} tapScale={0.95}
                    >
                      {isPending ? <Loader2 className="size-3 animate-spin" /> : <FolderInput className="size-3" />}
                      Move
                    </Button>
                  </div>

                  <Button
                    className="ml-auto gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-100 hover:border-red-300"
                    onClick={() => void handleDelete(node)}
                    disabled={isPending}
                    hoverScale={1.04} tapScale={0.95}
                  >
                    {isPending ? <Loader2 className="size-3 animate-spin text-red-600" /> : <Trash2 className="size-3" />}
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </div>

          {canShowChildren && (
            <motion.div
              className="mt-1.5 space-y-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
            >
              {renderNodes(node.children || [], depth + 1)}
            </motion.div>
          )}
        </motion.div>
      );
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,#eef2ff_0%,#f8fafc_50%,#f1f5f9_100%)] px-4 py-6 text-slate-900">
      {/* ambient blobs */}
      <div className="pointer-events-none fixed -top-32 -right-32 h-80 w-80 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none fixed bottom-0 left-0 h-64 w-64 rounded-full bg-violet-300/15 blur-3xl" />

      <div className="relative mx-auto max-w-4xl space-y-5">
        {/* ── page header ── */}
        <Fade className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-400/30">
            <Settings2 className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Bookmark Manager</h1>
            <p className="text-sm text-slate-500">Manage bookmarks and folders in one place.</p>
          </div>
        </Fade>

        {/* ── search + create grid ── */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* search card */}
          <Fade delay={50} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Search className="size-4 text-indigo-500" />
              Search
            </h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-8 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 transition"
                  placeholder="Search by title or URL"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch(); }}
                />
              </div>
              <Button
                className="rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm"
                onClick={() => void handleSearch()}
                hoverScale={1.04} tapScale={0.95}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
              </Button>
              <Button
                className="rounded-xl border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50"
                onClick={() => { setSearchQuery(''); setSearchResults([]); void refreshList(); }}
                hoverScale={1.04} tapScale={0.96}
              >
                <X className="size-4" />
              </Button>
            </div>
          </Fade>

          {/* create card */}
          <Fade delay={100} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Plus className="size-4 text-indigo-500" />
              Create
            </h2>
            <form className="space-y-2" onSubmit={(e) => void handleCreate(e)}>
              <div className="flex gap-2">
                <select
                  className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-300 transition"
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as 'bookmark' | 'folder')}
                >
                  <option value="bookmark">Bookmark</option>
                  <option value="folder">Folder</option>
                </select>
                <select
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-indigo-300 transition"
                  value={createParentId}
                  onChange={(e) => setCreateParentId(e.target.value)}
                >
                  <option value="">Default folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.title || '(Untitled Folder)'}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 transition"
                placeholder="Title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
              {createType === 'bookmark' && (
                <input
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 transition"
                  placeholder="https://example.com"
                  value={createUrl}
                  onChange={(e) => setCreateUrl(e.target.value)}
                />
              )}
              <Button
                className="w-full justify-center gap-1.5 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 py-2 text-sm font-semibold text-white shadow-sm hover:from-indigo-500 hover:to-violet-500"
                type="submit"
                disabled={loading}
                hoverScale={1.02} tapScale={0.97}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : (
                  createType === 'folder' ? <FolderPlus className="size-4" /> : <Plus className="size-4" />
                )}
                Create {createType === 'folder' ? 'Folder' : 'Bookmark'}
              </Button>
            </form>
          </Fade>
        </div>

        {/* ── toast notifications ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="err"
              className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-700 shadow-sm backdrop-blur"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <BookmarkX className="size-4 shrink-0 text-red-500" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="size-4" />
              </button>
            </motion.div>
          )}
          {success && (
            <motion.div
              key="ok"
              className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-700 shadow-sm backdrop-blur"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            >
              <Check className="size-4 shrink-0 text-emerald-500" />
              <span className="flex-1">{success}</span>
              <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600">
                <X className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── bookmark list section ── */}
        <Fade delay={150} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              {isSearching ? (
                <>
                  <Search className="size-4 text-indigo-500" />
                  Search Results
                </>
              ) : (
                <>
                  <Bookmark className="size-4 text-indigo-500" />
                  All Bookmarks
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    <SlidingNumber number={shownNodes.length} fromNumber={0} initiallyStable className="tabular-nums" />
                  </span>
                </>
              )}
            </h2>
            <Button
              className="gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700"
              onClick={() => void refreshList()}
              disabled={loading}
              hoverScale={1.04} tapScale={0.95}
            >
              {loading ? <Loader2 className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
              Refresh
            </Button>
          </div>

          {loading && shownNodes.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl bg-slate-100"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                />
              ))}
            </div>
          ) : shownNodes.length === 0 ? (
            <motion.div
              className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-12 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Bookmark className="size-10 text-slate-300" />
              <div>
                <p className="text-sm font-medium text-slate-600">
                  {isSearching ? 'No search results' : 'No bookmarks found'}
                </p>
                {!isSearching && (
                  <p className="mt-0.5 text-xs text-slate-400">Create a bookmark to get started</p>
                )}
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              <div className="space-y-2">
                {renderNodes(shownNodes)}
              </div>
            </AnimatePresence>
          )}
        </Fade>

        {/* ── chevron breadcrumb indicate nesting ── */}
        <Fade delay={200} className="flex items-center gap-1.5 px-1 text-[11px] text-slate-400">
          <ChevronRight className="size-3" />
          <span>Indented items are nested inside their parent folder.</span>
        </Fade>
      </div>
    </main>
  );
}
