import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X, Settings, Bookmark, Folder, BookmarkX, Loader2 } from 'lucide-react';
import { ApiResponse, BookmarkAction, BookmarkNode } from '@src/types/bookmark';
import { SlidingNumber } from '@src/components/animate-ui/primitives/texts/sliding-number';
import { Button } from '@src/components/animate-ui/components/buttons/button';
import {
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
  SubFiles,
} from '@src/components/animate-ui/components/radix/files';
import {
  File,
  FileHighlight,
  FileIcon,
  FileLabel,
} from '@src/components/animate-ui/primitives/radix/files';
import { Fade } from '@src/components/animate-ui/primitives/effects/fade';

function sendAction<T>(action: BookmarkAction): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(action, (response: ApiResponse<T>) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        reject(new Error(runtimeError.message || 'Background communication failed'));
        return;
      }
      resolve(response);
    });
  });
}

function flattenNodes(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];

  const walk = (items: BookmarkNode[]) => {
    items.forEach((item) => {
      result.push(item);
      if (item.children && item.children.length > 0) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return result;
}

function stripFirstLayer(nodes: BookmarkNode[]): BookmarkNode[] {
  const stripped = nodes.flatMap((node) => node.children ?? []);
  return stripped.length > 0 ? stripped : nodes;
}

function countBookmarksInNode(node: BookmarkNode): number {
  if (node.url) {
    return 1;
  }

  return (node.children ?? []).reduce((total, child) => total + countBookmarksInNode(child), 0);
}

function countFoldersInNode(node: BookmarkNode): number {
  return (node.children ?? []).reduce((total, child) => {
    if (child.url) {
      return total;
    }

    return total + 1 + countFoldersInNode(child);
  }, 0);
}

function getBookmarkHostname(url?: string): string {
  if (!url) {
    return 'Folder';
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getFaviconUrl(url?: string): string {
  const hostname = getBookmarkHostname(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function BookmarkFavicon({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (!url || failed) {
    return <Bookmark className="size-4" />;
  }

  return (
    <img
      src={getFaviconUrl(url)}
      alt=""
      className="size-4 rounded-sm"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function Popup() {
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [openFolders, setOpenFolders] = useState<string[]>([]);

  const isSearching = searchQuery.trim().length > 0;
  const visibleTree = useMemo(() => stripFirstLayer(tree), [tree]);
  const list = isSearching ? searchResults : visibleTree;

  const treeBookmarksCount = useMemo(() => {
    return flattenNodes(tree).filter((item) => !!item.url).length;
  }, [tree]);

  const visibleFoldersCount = useMemo(() => {
    return flattenNodes(visibleTree).filter((item) => !item.url).length;
  }, [visibleTree]);

  const visibleBookmarkCount = useMemo(() => {
    return flattenNodes(visibleTree).filter((item) => !!item.url).length;
  }, [visibleTree]);

  useEffect(() => {
    void loadTree();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    const timerId = window.setTimeout(() => {
      if (!query) {
        setSearchResults([]);
        return;
      }
      void handleSearch(query);
    }, 220);

    return () => window.clearTimeout(timerId);
  }, [searchQuery]);

  async function loadTree() {
    setLoading(true);
    setError(null);
    try {
      const response = await sendAction<BookmarkNode[]>({ type: 'LIST_BOOKMARKS' });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setTree(response.data);
      setOpenFolders(stripFirstLayer(response.data).filter((node) => !node.url).map((node) => node.id));
      setInitialLoaded(true);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to load bookmarks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(rawQuery?: string) {
    const query = (rawQuery ?? searchQuery).trim();
    if (!query) {
      setSearchResults([]);
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

  function openBookmark(url?: string) {
    if (!url) {
      return;
    }
    chrome.tabs.create({ url });
  }

  function openOptions() {
    const optionsUrl = chrome.runtime.getURL('src/pages/options/index.html#general');
    chrome.tabs.create({ url: optionsUrl });
  }

  function renderBookmarkTree(nodes: BookmarkNode[]): React.ReactNode {
    return nodes.map((node) => {
      if (!node.url) {
        const bookmarkCount = countBookmarksInNode(node);
        const folderCount = countFoldersInNode(node);
        const folderSummary = folderCount > 0
          ? `${bookmarkCount} bookmarks · ${folderCount} folders`
          : `${bookmarkCount} bookmarks`;

        return (
          <FolderItem key={node.id} value={node.id}>
            <FolderTrigger className="text-xs font-medium text-slate-700">
              <span className="inline-flex w-full min-w-0 items-center justify-between gap-3">
                <span className="inline-flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-semibold text-slate-800">
                    {node.title || '(Untitled Folder)'}
                  </span>
                  <span className="truncate text-[10px] font-medium text-slate-400">
                    {folderSummary}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  {bookmarkCount}
                </span>
              </span>
            </FolderTrigger>
            <FolderContent>
              {node.children && node.children.length > 0 ? (
                <SubFiles>
                  {renderBookmarkTree(node.children)}
                </SubFiles>
              ) : (
                <div className="px-2 py-1 text-[11px] text-slate-400">Empty folder</div>
              )}
            </FolderContent>
          </FolderItem>
        );
      }

      return (
        <FileHighlight
          key={node.id}
          className="rounded-md"
          onClick={() => openBookmark(node.url)}
          title={node.url || node.title}
        >
          <File className="group flex cursor-pointer items-center gap-3 rounded-xl p-2 text-slate-800 transition-colors hover:bg-indigo-50/90 hover:text-indigo-900">
            <FileIcon>
              <span className="flex size-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                <BookmarkFavicon url={node.url} />
              </span>
            </FileIcon>
            <FileLabel className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{node.title || '(Untitled)'}</span>
              <span className="block truncate text-[10px] font-medium text-slate-400 group-hover:text-indigo-500">
                {getBookmarkHostname(node.url)}
              </span>
            </FileLabel>
          </File>
        </FileHighlight>
      );
    });
  }

  function renderSearchResults(nodes: BookmarkNode[]): React.ReactNode {
    return nodes.map((node, idx) => {
      const isFolder = !node.url;
      const folderSummary = isFolder
        ? `${countBookmarksInNode(node)} bookmarks${countFoldersInNode(node) > 0 ? ` · ${countFoldersInNode(node)} folders` : ''}`
        : getBookmarkHostname(node.url);

      return (
        <motion.div
          key={node.id}
          className="space-y-0.5"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18) }}
        >
          <Button
            className={[
              'group w-full justify-start gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-xs font-medium',
              'hover:border-indigo-200/60 hover:bg-indigo-50/80 hover:shadow-sm',
              isFolder
                ? 'cursor-default text-slate-600 hover:text-slate-700'
                : 'cursor-pointer text-slate-800 hover:text-indigo-900',
            ].join(' ')}
            onClick={() => openBookmark(node.url)}
            disabled={isFolder}
            title={node.url || node.title}
            hoverScale={isFolder ? 1 : 1.015}
            tapScale={isFolder ? 1 : 0.97}
          >
            <span className="shrink-0 transition-transform group-hover:scale-110">
              {isFolder ? (
                <Folder className="size-3.5 text-amber-500" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-600">
                  <BookmarkFavicon url={node.url} />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate leading-snug">{node.title || '(Untitled)'}</span>
              <span className="block truncate text-[10px] font-medium text-slate-400">
                {folderSummary}
              </span>
            </span>
          </Button>
        </motion.div>
      );
    });
  }

  return (
    <main className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#eef2ff_0%,#f8fafc_55%,#e2e8f0_100%)] text-slate-900">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 -left-12 h-32 w-32 rounded-full bg-sky-300/20 blur-3xl" />

      {/* ── header ── */}
      <header className="relative border-b border-slate-200/70 bg-white/70 px-3 pt-3 pb-2.5 backdrop-blur-md">
        <Fade delay={0} className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 shadow-sm shadow-indigo-400/40">
              <Bookmark className="size-3 text-white" />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-800">Bookmark Pulse</h1>
          </div>
          <motion.div
            className="flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm shadow-indigo-400/30"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 360, damping: 22 }}
          >
            <SlidingNumber number={treeBookmarksCount} fromNumber={0} initiallyStable className="tabular-nums" />
            <span className="text-[10px] tracking-wide text-indigo-200">items</span>
          </motion.div>
        </Fade>

        {/* search bar */}
        <Fade delay={0.05} className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white/90 py-1.5 pl-7 pr-2.5 text-[11px] text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/50 transition"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSearch(searchQuery);
                }
              }}
              placeholder="Search title or URL…"
            />
          </div>
          <Button
            onClick={() => void handleSearch(searchQuery)}
            hoverScale={1.04}
            tapScale={0.94}
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
          </Button>
          <Button
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
            hoverScale={1.03}
            tapScale={0.96}
          >
            <X className="size-3" />
          </Button>
        </Fade>

        <Fade delay={0.08} className="mt-2 flex flex-wrap gap-1.5">
          <div className="inline-flex items-center gap-1 rounded-full border border-indigo-200/80 bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 shadow-sm">
            <Bookmark className="size-3" />
            <span>{visibleBookmarkCount} visible bookmarks</span>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 shadow-sm">
            <Folder className="size-3" />
            <span>{visibleFoldersCount} folders</span>
          </div>
          {isSearching && (
            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
              <Search className="size-3" />
              <span>{searchResults.length} matches</span>
            </div>
          )}
        </Fade>
      </header>

      {/* ── bookmark list ── */}
      <section className="relative flex-1 overflow-y-auto p-2 pb-20">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              className="flex flex-col gap-2 pt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="h-8 animate-pulse rounded-xl bg-slate-200/80"
                  initial={{ opacity: 0, scaleX: 0.92 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: i * 0.04 }}
                />
              ))}
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              className="mx-1 mt-1 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2.5 text-xs text-red-700 backdrop-blur"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <BookmarkX className="mt-0.5 size-3.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </motion.div>
          )}

          {!loading && !error && list.length === 0 && (
            <motion.div
              key="empty"
              className="mx-1 mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 py-8 text-center backdrop-blur"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <Bookmark className="size-7 text-slate-300" />
              <span className="text-xs text-slate-500">
                {isSearching ? 'No results found' : initialLoaded ? 'No bookmarks yet' : 'Preparing view…'}
              </span>
            </motion.div>
          )}

          {!loading && !error && list.length > 0 && (
            <motion.div
              key="list"
              className="space-y-0.5 pt-0.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isSearching ? (
                renderSearchResults(list)
              ) : (
                <Files
                  open={openFolders}
                  onOpenChange={setOpenFolders}
                  className="rounded-2xl border border-slate-200/70 bg-white/75 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm"
                >
                  {renderBookmarkTree(list)}
                </Files>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── footer ── */}
      <footer className="fixed bottom-0 inset-x-0 w-full border-t border-slate-200/70 bg-white/70 p-2.5 backdrop-blur-md">
        <Button
          className='w-full'
          onClick={openOptions}
          hoverScale={1.02}
          tapScale={0.97}
        >
          <Settings className="size-3.5" />
          Open Settings
        </Button>
      </footer>
    </main>
  );
}
