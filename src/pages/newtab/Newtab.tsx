import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search, X, Bookmark, Folder, Star, Clock, ExternalLink, BookmarkX, Loader2 } from 'lucide-react';
import '@pages/newtab/Newtab.css';
import { useBookmarkSearch } from '@src/hooks/use-bookmark-search';
import { useBookmarkTree } from '@src/hooks/use-bookmark-tree';
import { BookmarkNode } from '@src/types/bookmark';
import { Button } from '@src/components/animate-ui/components/buttons/button';
import { Fade } from '@src/components/animate-ui/primitives/effects/fade';
import { Blur } from '@src/components/animate-ui/primitives/effects/blur';
import { SlidingNumber } from '@src/components/animate-ui/primitives/texts/sliding-number';

function flattenBookmarks(nodes: BookmarkNode[]): BookmarkNode[] {
  const result: BookmarkNode[] = [];
  const walk = (items: BookmarkNode[]) => {
    items.forEach((item) => {
      if (item.url) result.push(item);
      if (item.children) walk(item.children);
    });
  };
  walk(nodes);
  return result;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Newtab() {
  const { tree, loading: treeLoading, loadTree: fetchTree } = useBookmarkTree();
  const {
    results: searchResults,
    loading: searchLoading,
    searchBookmarks,
    clearResults,
  } = useBookmarkSearch({ filter: (node) => !!node.url });
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const loading = treeLoading || searchLoading;
  const isSearching = searchQuery.trim().length > 0;
  const allBookmarks = useMemo(() => flattenBookmarks(tree), [tree]);

  // recent = first 12 bookmarks from flattened tree
  const recentBookmarks = useMemo(() => allBookmarks.slice(0, 12), [allBookmarks]);
  const displayList = isSearching ? searchResults : recentBookmarks;

  // clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadInitialTree();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    const timerId = window.setTimeout(() => {
      if (!query) {
        clearResults();
        return;
      }
      void handleSearch(query);
    }, 220);
    return () => window.clearTimeout(timerId);
  }, [searchQuery]);

  async function loadInitialTree() {
    setError(null);
    try {
      await fetchTree();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookmarks');
    }
  }

  async function handleSearch(query: string) {
    setError(null);
    try {
      await searchBookmarks(query);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    }
  }

  function openBookmark(url: string) {
    window.location.href = url;
  }

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,#312e81_0%,#1e1b4b_35%,#0f0e1a_100%)] text-white selection:bg-indigo-400/30">
      {/* ambient glows */}
      <div className="pointer-events-none fixed top-[-20%] left-[-10%] h-150 w-150 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-20%] right-[-10%] h-125 w-125 rounded-full bg-violet-600/15 blur-[100px]" />
      <div className="pointer-events-none fixed top-[40%] left-[50%] h-75 w-75 -translate-x-1/2 rounded-full bg-cyan-600/10 blur-[80px]" />

      <div className="relative mx-auto max-w-5xl px-6 py-12">
        {/* ── clock + greeting ── */}
        <Blur className="mb-10 text-center">
          <div className="mb-1 text-[72px] font-thin tabular-nums leading-none tracking-tight text-white/90">
            {timeStr}
          </div>
          <div className="text-sm font-medium text-white/50">{dateStr}</div>
          <div className="mt-2 text-lg font-light text-white/70">{getGreeting()}</div>
        </Blur>

        {/* ── search bar ── */}
        <Fade delay={100} className="mx-auto mb-10 max-w-xl">
          <div className="relative flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-xl shadow-black/20 backdrop-blur-xl ring-1 ring-white/5 focus-within:border-indigo-400/50 focus-within:ring-indigo-400/20 transition">
            <Search className="shrink-0 size-4 text-white/50" />
            <input
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
              placeholder="Search bookmarks…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); clearResults(); } }}
            />
            {searchQuery && (
              <motion.button
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                className="text-white/40 hover:text-white/70 transition"
                onClick={() => { setSearchQuery(''); clearResults(); }}
              >
                <X className="size-4" />
              </motion.button>
            )}
            {loading && <Loader2 className="size-4 animate-spin text-white/50" />}
          </div>
        </Fade>

        {/* ── stats row ── */}
        {!isSearching && (
          <Fade delay={150} className="mb-8 flex justify-center gap-6">
            {[
              { icon: Bookmark, label: 'Bookmarks', value: allBookmarks.length, color: 'text-indigo-300' },
              { icon: Folder, label: 'Folders', value: flattenBookmarks(tree).length ? Math.max(0, (function count(n: BookmarkNode[]): number { let c = 0; n.forEach(x => { if (!x.url) c++; if (x.children) c += count(x.children); }); return c; })(tree)) : 0, color: 'text-amber-300' },
              { icon: Star, label: 'Recent', value: recentBookmarks.length, color: 'text-violet-300' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/5 px-4 py-2 backdrop-blur">
                <Icon className={`size-4 ${color}`} />
                <span className={`text-base font-semibold tabular-nums ${color}`}>
                  <SlidingNumber number={value} fromNumber={0} initiallyStable />
                </span>
                <span className="text-xs text-white/40">{label}</span>
              </div>
            ))}
          </Fade>
        )}

        {/* ── bookmark grid ── */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              className="mx-auto mb-6 flex max-w-sm items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 backdrop-blur"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <BookmarkX className="size-4 shrink-0" />
              {error}
            </motion.div>
          )}

          {!error && loading && displayList.length === 0 && (
            <motion.div
              key="loading"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl bg-white/5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                />
              ))}
            </motion.div>
          )}

          {!error && !loading && displayList.length === 0 && (
            <motion.div
              key="empty"
              className="flex flex-col items-center gap-3 py-16 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Bookmark className="size-7 text-white/30" />
              </div>
              <p className="text-sm text-white/40">
                {isSearching ? 'No results found' : 'No bookmarks yet'}
              </p>
            </motion.div>
          )}

          {!error && displayList.length > 0 && (
            <motion.div
              key={isSearching ? 'search' : 'recent'}
              className="space-y-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Fade delay={50} className="mb-2 flex items-center gap-2">
                {isSearching ? (
                  <><Search className="size-3.5 text-indigo-400" /><span className="text-xs font-medium text-white/50">Search results for "{searchQuery}"</span></>
                ) : (
                  <><Clock className="size-3.5 text-indigo-400" /><span className="text-xs font-medium text-white/50">Recent bookmarks</span></>
                )}
              </Fade>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {displayList.map((node, idx) => (
                  <motion.button
                    key={node.id}
                    className="group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border border-white/8 bg-white/5 p-4 text-left backdrop-blur transition hover:border-indigo-400/40 hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/10"
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3) }}
                    whileHover={{ scale: 1.025, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => openBookmark(node.url!)}
                  >
                    {/* favicon */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 group-hover:bg-indigo-500/20 transition">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(node.url!).hostname}&sz=32`}
                        alt=""
                        className="size-4 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextSibling && ((e.target as HTMLImageElement).nextSibling as HTMLElement).classList.remove('hidden');
                        }}
                      />
                      <Bookmark className="hidden size-4 text-white/40" />
                    </div>
                    <div className="w-full min-w-0">
                      <div className="truncate text-sm font-medium text-white/90 group-hover:text-white">
                        {node.title || '(Untitled)'}
                      </div>
                      <div className="truncate text-[11px] text-white/30 group-hover:text-white/50">
                        {new URL(node.url!).hostname}
                      </div>
                    </div>
                    <ExternalLink className="absolute top-3 right-3 size-3 text-white/0 group-hover:text-white/40 transition" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
