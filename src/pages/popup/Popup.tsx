import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  Bookmark,
  Folder,
  BookmarkX,
  History,
} from 'lucide-react';
import {
  ApiResponse,
  BookmarkAction,
  BookmarkNode,
  BrowserHistoryItem,
} from '@src/types/bookmark';
import { Button as UiButton } from '@src/components/ui/button';
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
import { Input } from '@src/components/ui/input';
import { InputGroup, InputGroupAddon } from '@src/components/ui/input-group';
import { Card, CardContent, CardHeader } from '@src/components/ui/card';
import { ScrollArea } from '@src/components/ui/scroll-area';
import { Badge } from '@src/components/ui/badge';


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

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={idx} className="bg-yellow-200 font-semibold">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
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
  const [bookmarkSearchResults, setBookmarkSearchResults] = useState<BookmarkNode[]>([]);
  const [historySearchResults, setHistorySearchResults] = useState<BrowserHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [openFolders, setOpenFolders] = useState<string[]>([]);

  const isSearching = searchQuery.trim().length > 0;
  const visibleTree = useMemo(() => stripFirstLayer(tree), [tree]);
  const totalSearchResults = bookmarkSearchResults.length + historySearchResults.length;

  useEffect(() => {
    void loadTree();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    const timerId = window.setTimeout(() => {
      if (!query) {
        setBookmarkSearchResults([]);
        setHistorySearchResults([]);
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
      setBookmarkSearchResults([]);
      setHistorySearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [bookmarkResponse, historyResponse] = await Promise.all([
        sendAction<BookmarkNode[]>({
          type: 'SEARCH_BOOKMARKS',
          payload: { query },
        }),
        sendAction<BrowserHistoryItem[]>({
          type: 'SEARCH_BROWSER_HISTORY',
          payload: { query, maxResults: 30 },
        }),
      ]);

      if (!bookmarkResponse.ok) {
        setError(bookmarkResponse.error);
        return;
      }
      if (!historyResponse.ok) {
        setError(historyResponse.error);
        return;
      }

      setBookmarkSearchResults(bookmarkResponse.data);
      setHistorySearchResults(historyResponse.data);
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

  function renderBookmarkSearchResults(nodes: BookmarkNode[]): React.ReactNode {
    return nodes.map((node) => {
      const isFolder = !node.url;
      const folderSummary = isFolder
        ? `${countBookmarksInNode(node)} bookmarks${countFoldersInNode(node) > 0 ? ` · ${countFoldersInNode(node)} folders` : ''}`
        : getBookmarkHostname(node.url);

      return (
        <div key={node.id} className="">
          <UiButton
            variant="outline"
            className={[
              'group my-0.5 h-auto w-full justify-start gap-2 rounded-lg border-slate-200 px-2.5 py-2 text-left text-xs font-medium',
              'hover:border-indigo-200/60 hover:bg-indigo-50/80',
              isFolder
                ? 'cursor-default text-slate-600 hover:text-slate-700'
                : 'cursor-pointer text-slate-800 hover:text-indigo-900',
            ].join(' ')}
            onClick={() => openBookmark(node.url)}
            disabled={isFolder}
            title={node.url || node.title}
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
              <span className="block truncate leading-snug">{highlightText(node.title || '(Untitled)', searchQuery)}</span>
              <span className="block truncate text-[10px] font-medium text-slate-400">
                {highlightText(folderSummary, searchQuery)}
              </span>
            </span>
          </UiButton>
        </div>
      );
    });
  }

  function renderHistoryResults(nodes: BrowserHistoryItem[]): React.ReactNode {
    return nodes.map((item) => (
      <div key={item.id}>
        <UiButton
          variant="outline"
          className="group my-0.5 h-auto w-full justify-start gap-2 rounded-lg border-slate-200 px-2.5 py-2 text-left text-xs font-medium text-slate-800 hover:border-indigo-200/60 hover:bg-indigo-50/80 hover:text-indigo-900"
          onClick={() => openBookmark(item.url)}
          title={item.url}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <History className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate leading-snug">{highlightText(item.title || '(Untitled)', searchQuery)}</span>
            <span className="block truncate text-[10px] font-medium text-slate-400">
              {highlightText(item.url, searchQuery)}
            </span>
          </span>
        </UiButton>
      </div>
    ));
  }

  return (
    <main className="h-full text-slate-900">
      <Card className="h-full bg-white/85 rounded-none border-none! outline-0 gap-1.5!">
        <CardHeader className="flex-row flex items-center gap-2">
          <InputGroup className="h-10 flex-1 rounded-xl border-slate-200 bg-white/90 shadow-sm">
            <InputGroupAddon side="start">
              <Search className="size-3.5" />
            </InputGroupAddon>
            <Input
              className="h-9 flex-1 border-0 bg-transparent px-2 text-[11px] shadow-none focus-visible:ring-0"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleSearch(searchQuery);
                }
                if (event.key === 'Escape') {
                  setSearchQuery('');
                  setBookmarkSearchResults([]);
                  setHistorySearchResults([]);
                }
              }}
              placeholder="搜索书签和浏览历史..."
            />
            {searchQuery.trim().length > 0 && (
              <InputGroupAddon side="end">
                <UiButton
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setSearchQuery('');
                    setBookmarkSearchResults([]);
                    setHistorySearchResults([]);
                  }}
                  title="Clear search"
                >
                  <X className="size-3" />
                </UiButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col gap-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 shadow-sm">
              <BookmarkX className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <ScrollArea className="min-h-0 flex-1">
              {loading && (
                <div className="flex flex-col gap-2 pt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-8 animate-pulse rounded-xl bg-slate-200/80" />
                  ))}
                </div>
              )}

              {!loading && !error && isSearching && totalSearchResults === 0 && (
                <div className="mx-1 mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 py-8 text-center backdrop-blur">
                  <History className="size-7 text-slate-300" />
                  <span className="text-xs text-slate-500">未找到浏览历史或书签结果</span>
                </div>
              )}

              {!loading && !error && !isSearching && visibleTree.length === 0 && (
                <div className="mx-1 mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/60 py-8 text-center backdrop-blur">
                  <Bookmark className="size-7 text-slate-300" />
                  <span className="text-xs text-slate-500">
                    {initialLoaded ? 'No bookmarks yet' : 'Preparing view...'}
                  </span>
                </div>
              )}

              {!loading && !error && isSearching && totalSearchResults > 0 && (
                <>
                  <div className="flex items-center gap-2 py-1">
                    <Badge variant="outline">共 {totalSearchResults} 条结果</Badge>
                    <Badge variant="outline">书签 {bookmarkSearchResults.length}</Badge>
                    <Badge variant="outline">历史 {historySearchResults.length}</Badge>
                  </div>

                  {bookmarkSearchResults.length > 0 && (
                    <div className="mt-1">
                      <div className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-slate-400">书签</div>
                      {renderBookmarkSearchResults(bookmarkSearchResults)}
                    </div>
                  )}

                  {historySearchResults.length > 0 && (
                    <div className="mt-2">
                      <div className="px-1 pb-1 text-[10px] font-semibold tracking-wide text-slate-400">历史访问</div>
                      {renderHistoryResults(historySearchResults)}
                    </div>
                  )}
                </>
              )}

              {!loading && !error && !isSearching && visibleTree.length > 0 && (
                <>
                  <Files
                    open={openFolders}
                    onOpenChange={setOpenFolders}
                    className="rounded-2xl border border-slate-200/70 shadow-none"
                  >
                    {renderBookmarkTree(visibleTree)}
                  </Files>
                </>
              )}
          </ScrollArea>
        </CardContent>
      </Card>

    </main>
  );
}
