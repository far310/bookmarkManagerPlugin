import React, { useEffect, useMemo, useState } from 'react';
import '@pages/options/Options.css';
import { ApiResponse, BookmarkAction, BookmarkNode } from '@src/types/bookmark';

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
    return nodes.map((node) => {
      const isFolder = !node.url;
      const isRoot = isRootNode(node);
      const isPending = actionPendingId === node.id;
      const canShowChildren = !isSearching && !!node.children?.length;

      return (
        <div key={node.id}>
          <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0" style={{ paddingLeft: `${depth * 14}px` }}>
                <div className="text-sm text-gray-500">{isFolder ? 'Folder' : 'Bookmark'}</div>
                {editingId === node.id ? (
                  <div className="mt-1 flex gap-2">
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                    />
                    <button
                      className="rounded bg-blue-600 px-2 py-1 text-sm text-white"
                      onClick={() => void handleRename(node)}
                      disabled={isPending}
                    >
                      Save
                    </button>
                    <button
                      className="rounded border border-gray-300 px-2 py-1 text-sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditingTitle('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="truncate text-base font-semibold text-gray-900">
                      {node.title || '(Untitled)'}
                    </div>
                    {node.url && (
                      <a
                        href={node.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-sm text-blue-600 hover:underline"
                      >
                        {node.url}
                      </a>
                    )}
                  </>
                )}
              </div>

              {!isRoot && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
                    onClick={() => {
                      setEditingId(node.id);
                      setEditingTitle(node.title);
                    }}
                    disabled={isPending}
                  >
                    Rename
                  </button>

                  <select
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                    value={moveTargets[node.id] || ''}
                    onChange={(event) =>
                      setMoveTargets((prev) => ({ ...prev, [node.id]: event.target.value }))
                    }
                    disabled={isPending}
                  >
                    <option value="">Move to...</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.title || '(Untitled Folder)'}
                      </option>
                    ))}
                  </select>

                  <button
                    className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
                    onClick={() => void handleMove(node)}
                    disabled={isPending}
                  >
                    Move
                  </button>

                  <button
                    className="rounded bg-red-600 px-2 py-1 text-sm text-white"
                    onClick={() => void handleDelete(node)}
                    disabled={isPending}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {canShowChildren && <div className="mt-2 space-y-2">{renderNodes(node.children || [], depth + 1)}</div>}
        </div>
      );
    });
  }

  return (
    <main className="container mx-auto max-w-6xl space-y-4 px-4 py-6 text-gray-900">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Bookmark Manager</h1>
        <p className="text-sm text-gray-600">
          Manage bookmarks and folders from one place. Data is loaded from the background service.
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Search</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="Search by title or URL"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleSearch();
              }
            }}
          />
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={() => void handleSearch()}>
            Search
          </button>
          <button
            className="rounded border border-gray-300 px-4 py-2"
            onClick={() => {
              setSearchQuery('');
              setSearchResults([]);
              void refreshList();
            }}
          >
            Clear
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Create</h2>
        <form className="grid gap-2 md:grid-cols-4" onSubmit={(event) => void handleCreate(event)}>
          <select
            className="rounded border border-gray-300 px-3 py-2"
            value={createType}
            onChange={(event) => setCreateType(event.target.value as 'bookmark' | 'folder')}
          >
            <option value="bookmark">Bookmark</option>
            <option value="folder">Folder</option>
          </select>

          <input
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="Title"
            value={createTitle}
            onChange={(event) => setCreateTitle(event.target.value)}
          />

          <input
            className="rounded border border-gray-300 px-3 py-2"
            placeholder="https://example.com"
            value={createUrl}
            onChange={(event) => setCreateUrl(event.target.value)}
            disabled={createType === 'folder'}
          />

          <select
            className="rounded border border-gray-300 px-3 py-2"
            value={createParentId}
            onChange={(event) => setCreateParentId(event.target.value)}
          >
            <option value="">Default folder</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.title || '(Untitled Folder)'}
              </option>
            ))}
          </select>

          <button className="rounded bg-green-600 px-4 py-2 text-white md:col-span-4" type="submit">
            Create
          </button>
        </form>
      </section>

      {loading && <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Loading...</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Items</h2>
        {shownNodes.length === 0 && !loading ? (
          <div className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            {isSearching ? 'No search result found' : 'No bookmarks found'}
          </div>
        ) : (
          <div className="space-y-2">{renderNodes(shownNodes)}</div>
        )}
      </section>
    </main>
  );
}
