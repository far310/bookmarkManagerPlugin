import React, { useEffect, useMemo, useState } from 'react';
import { ApiResponse, BookmarkAction, BookmarkNode } from '@src/types/bookmark';

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

export default function Popup() {
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSearching = searchQuery.trim().length > 0;
  const list = isSearching ? searchResults : tree;

  const treeBookmarksCount = useMemo(() => {
    return flattenNodes(tree).filter((item) => !!item.url).length;
  }, [tree]);

  useEffect(() => {
    void loadTree();
  }, []);

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
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to load bookmarks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const query = searchQuery.trim();
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

  function renderTree(nodes: BookmarkNode[], depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const isFolder = !node.url;
      return (
        <div key={node.id} className="space-y-1">
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-100"
            style={{ paddingLeft: `${8 + depth * 12}px` }}
            onClick={() => openBookmark(node.url)}
            disabled={isFolder}
            title={node.url || node.title}
          >
            <span className="text-xs text-gray-500">{isFolder ? 'DIR' : 'URL'}</span>
            <span className="truncate text-sm text-gray-800">{node.title || '(Untitled)'}</span>
          </button>

          {!isSearching && node.children && node.children.length > 0 && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  }

  return (
    <main className="flex h-full flex-col bg-white text-gray-900">
      <header className="border-b border-gray-200 p-2">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-sm font-semibold">Bookmarks</h1>
          <span className="text-xs text-gray-500">{treeBookmarksCount} items</span>
        </div>
        <div className="flex gap-1">
          <input
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSearch();
              }
            }}
            placeholder="Search title or URL"
          />
          <button
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white"
            onClick={() => void handleSearch()}
          >
            Search
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-2">
        {loading && <div className="rounded bg-blue-50 p-2 text-xs text-blue-700">Loading...</div>}
        {error && <div className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
        {!loading && !error && list.length === 0 && (
          <div className="rounded border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
            {isSearching ? 'No result found' : 'No bookmarks yet'}
          </div>
        )}
        {!loading && !error && list.length > 0 && <div className="space-y-1">{renderTree(list)}</div>}
      </section>

      <footer className="border-t border-gray-200 p-2">
        <button
          className="w-full rounded bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
          onClick={openOptions}
        >
          Settings
        </button>
      </footer>
    </main>
  );
}
