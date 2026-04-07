import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bookmark,
  BookmarkX,
  Check,
  Copy,
  ExternalLink,
  Folder,
  FolderInput,
  FolderPlus,
  Download,
  FileJson,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { bookmarkApi } from '@src/lib/bookmarks/api';
import { useBookmarkMutations } from '@src/hooks/use-bookmark-mutations';
import { useBookmarkSearch } from '@src/hooks/use-bookmark-search';
import { useBookmarkTree } from '@src/hooks/use-bookmark-tree';
import { flattenFolders, folderIds, isRootNode, stripFirstLayer } from '@src/lib/bookmarks/tree';
import { BookmarkNode, BookmarkTransferNode } from '@src/types/bookmark';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@src/components/ui/alert';
import { Badge } from '@src/components/ui/badge';
import { Button } from '@src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@src/components/ui/card';
import { Input } from '@src/components/ui/input';
import { InputGroup, InputGroupAddon } from '@src/components/ui/input-group';
import { ScrollArea } from '@src/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@src/components/ui/select';
import { Separator } from '@src/components/ui/separator';
import { Skeleton } from '@src/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@src/components/ui/tabs';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@src/components/ui/context-menu';
import {
  Files,
  FolderContent,
  FolderItem,
  FolderTrigger,
  SubFiles,
} from '@src/components/animate-ui/components/radix/files';

function highlightText(text: string, query: string): React.ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const segments: React.ReactNode[] = [];
  let start = 0;
  let key = 0;

  while (start < text.length) {
    const foundAt = lowerText.indexOf(lowerQuery, start);
    if (foundAt === -1) {
      segments.push(text.slice(start));
      break;
    }

    if (foundAt > start) {
      segments.push(text.slice(start, foundAt));
    }

    segments.push(
      <mark key={`hl-${key++}`} className="rounded bg-amber-200 px-0.5 text-amber-950">
        {text.slice(foundAt, foundAt + normalizedQuery.length)}
      </mark>,
    );

    start = foundAt + normalizedQuery.length;
  }

  return segments;
}

function createExportFileName(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  return `bookmarks-export-${datePart}.json`;
}

function parseImportNodes(raw: string): BookmarkTransferNode[] {
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return parsed as BookmarkTransferNode[];
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'nodes' in parsed &&
    Array.isArray((parsed as { nodes: unknown }).nodes)
  ) {
    return (parsed as { nodes: BookmarkTransferNode[] }).nodes;
  }

  throw new Error('Import JSON must be an array or an object with a nodes array');
}

export default function Options() {
  const { tree, loading: treeLoading, loadTree } = useBookmarkTree();
  const {
    results: searchResults,
    loading: searchLoading,
    searchBookmarks,
    clearResults,
  } = useBookmarkSearch();
  const {
    createLoading,
    actionPendingId,
    createBookmark,
    renameBookmark,
    moveBookmark,
    deleteBookmark,
  } = useBookmarkMutations();

  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createType, setCreateType] = useState<'bookmark' | 'folder'>('bookmark');
  const [createTitle, setCreateTitle] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [createParentId, setCreateParentId] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [importParentId, setImportParentId] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const loading = treeLoading || searchLoading || createLoading;
  const pageBusy = loading || transferLoading;
  const isSearching = searchQuery.trim().length > 0;
  const visibleTree = useMemo(() => stripFirstLayer(tree), [tree]);
  const shownNodes = isSearching ? searchResults : visibleTree;
  const folders = useMemo(() => flattenFolders(tree), [tree]);

  const summary = useMemo(() => {
    let bookmarkCount = 0;
    let folderCount = 0;

    const walk = (nodes: BookmarkNode[]) => {
      nodes.forEach((node) => {
        if (node.url) {
          bookmarkCount += 1;
        } else {
          folderCount += 1;
        }
        if (node.children?.length) {
          walk(node.children);
        }
      });
    };

    walk(visibleTree);
    return { bookmarkCount, folderCount };
  }, [visibleTree]);

  useEffect(() => {
    void refreshList();
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => setSuccess(null), 2800);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function refreshList() {
    setError(null);

    try {
      const nextTree = await loadTree();
      const ids = folderIds(stripFirstLayer(nextTree));
      setOpenFolders((prev) => {
        if (prev.length === 0) {
          return ids;
        }

        const prevSet = new Set(prev);
        const persisted = ids.filter((id) => prevSet.has(id));
        const appended = ids.filter((id) => !prevSet.has(id));
        return [...persisted, ...appended];
      });

      if (!createParentId && nextTree.length > 0) {
        const defaultFolder = flattenFolders(nextTree)[0];
        if (defaultFolder) {
          setCreateParentId(defaultFolder.id);
        }
      }

      if (!importParentId && nextTree.length > 0) {
        const defaultFolder = flattenFolders(nextTree)[0];
        if (defaultFolder) {
          setImportParentId(defaultFolder.id);
        }
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to load bookmarks';
      setError(message);
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
      clearResults();
      await refreshList();
      return;
    }

    setError(null);

    try {
      await searchBookmarks(query);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Search failed';
      setError(message);
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

    try {
      await createBookmark({
        title: createTitle,
        url: createType === 'bookmark' ? createUrl : undefined,
        parentId: createParentId || undefined,
      });

      setCreateTitle('');
      setCreateUrl('');
      setSuccess(`${createType === 'bookmark' ? 'Bookmark' : 'Folder'} created`);
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Create operation failed';
      setError(message);
    }
  }

  async function handleDelete(node: BookmarkNode) {
    const confirmDelete = window.confirm(`Delete "${node.title || 'Untitled'}"?`);
    if (!confirmDelete) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await deleteBookmark(node.id);

      setSuccess('Item deleted');
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Delete operation failed';
      setError(message);
    }
  }

  async function handleRename(node: BookmarkNode) {
    if (!editingTitle.trim()) {
      setError('Title is required');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await renameBookmark(node.id, editingTitle);

      setEditingId(null);
      setEditingTitle('');
      setSuccess('Item renamed');
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Rename operation failed';
      setError(message);
    }
  }

  async function handleMoveToFolder(node: BookmarkNode, parentId: string) {
    setError(null);
    setSuccess(null);

    try {
      await moveBookmark(node.id, parentId);
      setSuccess('Item moved');
      await refreshCurrentView();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Move operation failed';
      setError(message);
    }
  }

  async function handleExportBookmarks() {
    setError(null);
    setSuccess(null);
    setTransferLoading(true);

    try {
      const exported = await bookmarkApi.exportBookmarks();
      const payload = JSON.stringify(exported, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = createExportFileName();
      anchor.click();
      URL.revokeObjectURL(objectUrl);

      setSuccess(`Export completed: ${exported.nodes.length} top-level nodes`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Export failed';
      setError(message);
    } finally {
      setTransferLoading(false);
    }
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setImportFileName(selectedFile.name);
    setError(null);
    setSuccess(null);
    setTransferLoading(true);

    try {
      const fileContent = await selectedFile.text();
      const nodes = parseImportNodes(fileContent);
      const imported = await bookmarkApi.importBookmarks({
        nodes,
        parentId: importParentId || undefined,
      });

      event.target.value = '';
      await refreshCurrentView();
      setSuccess(
        `Import completed: ${imported.importedBookmarks} bookmarks, ${imported.importedFolders} folders`,
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Import failed';
      setError(message);
    } finally {
      setTransferLoading(false);
    }
  }

  function renderContextMenu(node: BookmarkNode, content: React.ReactNode): React.ReactNode {
    const isRoot = isRootNode(node);
    if (isRoot) {
      return content;
    }

    const availableFolders = folders.filter((folder) => folder.id !== node.id);

    return (
      <ContextMenu key={node.id}>
        <ContextMenuTrigger className="block">{content}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel className="text-xs font-semibold text-zinc-500">
            {node.title || '(Untitled)'}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          {node.url && (
            <>
              <ContextMenuItem onClick={() => window.open(node.url, '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="size-4" />
                在新标签页打开
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void navigator.clipboard.writeText(node.url!)}>
                <Copy className="size-4" />
                复制链接
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            onClick={() => {
              setEditingId(node.id);
              setEditingTitle(node.title);
            }}
          >
            <Pencil className="size-4" />
            重命名
          </ContextMenuItem>

          {availableFolders.length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderInput className="size-4" />
                移动到文件夹
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="max-h-72 overflow-y-auto">
                {availableFolders.map((folder) => (
                  <ContextMenuItem key={folder.id} onClick={() => void handleMoveToFolder(node, folder.id)}>
                    <Folder className="size-3.5 text-amber-500" />
                    {folder.title || '(Untitled Folder)'}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => void handleDelete(node)}>
            <Trash2 className="size-4" />
            删除
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  function renderInlineRename(node: BookmarkNode): React.ReactNode {
    const isPending = actionPendingId === node.id;
    return (
      <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50/60 px-3 py-2">
        <Input
          autoFocus
          className="h-7 min-w-0 flex-1 text-sm"
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleRename(node);
            if (e.key === 'Escape') {
              setEditingId(null);
              setEditingTitle('');
            }
          }}
        />
        <Button size="icon-xs" onClick={() => void handleRename(node)} disabled={isPending}>
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
        </Button>
        <Button
          size="icon-xs"
          variant="outline"
          onClick={() => {
            setEditingId(null);
            setEditingTitle('');
          }}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  function renderLeafNode(node: BookmarkNode): React.ReactNode {
    const isFolder = !node.url;
    const isRoot = isRootNode(node);
    const isEditing = editingId === node.id;

    const card = (
      <div
        key={node.id}
        className="group mb-1 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/90 transition-colors hover:border-zinc-300 hover:shadow-sm"
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              isFolder ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            {isFolder ? <Folder className="size-4" /> : <Bookmark className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-900">
              {highlightText(node.title || '(Untitled)', searchQuery)}
            </span>
            {node.url && (
              <a
                href={node.url}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 block truncate text-xs text-zinc-400 transition hover:text-indigo-600"
                onClick={(e) => e.stopPropagation()}
              >
                {highlightText(node.url, searchQuery)}
              </a>
            )}
          </span>
          {!isRoot && !isEditing && (
            <span className="invisible flex shrink-0 items-center gap-0.5 group-hover:visible">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-zinc-400 hover:text-zinc-700"
                onClick={() => {
                  setEditingId(node.id);
                  setEditingTitle(node.title);
                }}
                title="重命名"
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-zinc-400 hover:text-red-600"
                onClick={() => void handleDelete(node)}
                title="删除"
              >
                <Trash2 className="size-3" />
              </Button>
            </span>
          )}
        </div>
        {isEditing && renderInlineRename(node)}
      </div>
    );

    return renderContextMenu(node, card);
  }

  function renderTree(nodes: BookmarkNode[]): React.ReactNode {
    return nodes.map((node) => {
      const isFolder = !node.url;
      const isRoot = isRootNode(node);
      const hasChildren = !!node.children?.length;
      const isEditing = editingId === node.id;

      if (isFolder && hasChildren && !isSearching) {
        const folderCard = (
          <FolderItem
            key={node.id}
            value={node.id}
            className="group mb-1 overflow-hidden rounded-xl border border-zinc-200/80 bg-white/90 transition-colors hover:border-zinc-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-2 px-2">
              <FolderTrigger className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-1 text-sm font-medium text-zinc-900">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Folder className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {highlightText(node.title || '(Untitled Folder)', searchQuery)}
                </span>
              </FolderTrigger>
              {!isRoot && !isEditing && (
                <span className="invisible flex shrink-0 items-center gap-0.5 pr-1 group-hover:visible">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-zinc-400 hover:text-zinc-700"
                    onClick={() => {
                      setEditingId(node.id);
                      setEditingTitle(node.title);
                    }}
                    title="重命名"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-zinc-400 hover:text-red-600"
                    onClick={() => void handleDelete(node)}
                    title="删除"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </span>
              )}
            </div>
            {isEditing && renderInlineRename(node)}
            <FolderContent className="px-2 pb-2">
              <div className="rounded-lg border border-dashed border-zinc-200/60 bg-zinc-50/40 p-1.5">
                <SubFiles className="w-full">
                  {renderTree(node.children || [])}
                </SubFiles>
              </div>
            </FolderContent>
          </FolderItem>
        );

        return renderContextMenu(node, folderCard);
      }

      return renderLeafNode(node);
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_420px_at_50%_-12%,rgba(251,191,36,0.22),transparent),radial-gradient(900px_360px_at_100%_10%,rgba(34,211,238,0.18),transparent),linear-gradient(180deg,#fffdf5_0%,#fafafa_55%,#f4fbff_100%)] px-4 py-6 text-zinc-900 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <Card className="overflow-visible border-amber-200/70 bg-white/92 shadow-xl shadow-amber-100/40">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-amber-300">
                    <Settings2 className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl tracking-tight">Bookmark Atelier</CardTitle>
                    <CardDescription className="text-zinc-600">
                      Editorial style workspace for organizing folders, links, and quick actions.
                    </CardDescription>
                  </div>
                </div>
                <Badge className="gap-1 bg-zinc-900 text-amber-300">
                  <Sparkles className="size-3" />
                  Refined Mode
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pb-1 sm:grid-cols-3">
              <Card size="sm" className="border border-zinc-200/80 bg-amber-50/50 py-2">
                <CardHeader className="gap-0 border-b border-amber-200/50">
                  <CardDescription className="text-zinc-600">Bookmarks</CardDescription>
                  <CardTitle className="text-lg">{summary.bookmarkCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm" className="border border-zinc-200/80 bg-cyan-50/50 py-2">
                <CardHeader className="gap-0 border-b border-cyan-200/50">
                  <CardDescription className="text-zinc-600">Folders</CardDescription>
                  <CardTitle className="text-lg">{summary.folderCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm" className="border border-zinc-200/80 bg-white/80 py-2">
                <CardHeader className="gap-0 border-b border-zinc-200/60">
                  <CardDescription className="text-zinc-600">Current List</CardDescription>
                  <CardTitle className="text-lg">{isSearching ? searchResults.length : shownNodes.length}</CardTitle>
                </CardHeader>
              </Card>
            </CardContent>
          </Card>
        </motion.section>

        <Card className="border-zinc-200/80 bg-white/90 shadow-md">
          <CardContent className="pt-4">
            <Tabs defaultValue="search" className="w-full">
              <TabsList className="mb-4 w-full justify-start" variant="line">
                <TabsTrigger value="search" className="gap-1.5"> 
                  <Search className="size-4" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="create" className="gap-1.5">
                  <Plus className="size-4" />
                  Create
                </TabsTrigger>
                <TabsTrigger value="transfer" className="gap-1.5">
                  <FileJson className="size-4" />
                  Transfer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="search">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <InputGroup className="h-10 border-zinc-300 bg-white">
                    <InputGroupAddon side="start">
                      <Search className="size-4 text-zinc-400" />
                    </InputGroupAddon>
                    <Input
                      className="h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder="Search by title or URL"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void handleSearch();
                        }
                      }}
                    />
                    {searchQuery && (
                      <InputGroupAddon side="end">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setSearchQuery('');
                            clearResults();
                            void refreshList();
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                  <Button className="h-10 gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800" onClick={() => void handleSearch()} disabled={loading}>
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    Search
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 gap-1.5 border-zinc-300"
                    onClick={() => {
                      setSearchQuery('');
                      clearResults();
                      void refreshList();
                    }}
                  >
                    <X className="size-4" />
                    Reset
                  </Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge variant="secondary">{isSearching ? `${searchResults.length} matches` : 'Search all bookmarks'}</Badge>
                  {isSearching && <Badge variant="outline">Query: {searchQuery.trim()}</Badge>}
                </div>
              </TabsContent>

              <TabsContent value="create">
                <form className="grid gap-2" onSubmit={(event) => void handleCreate(event)}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={createType} onValueChange={(value) => setCreateType(value as 'bookmark' | 'folder')}>
                      <SelectTrigger className="h-10 w-full border-zinc-300">
                        <SelectValue placeholder="Item type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bookmark">Bookmark</SelectItem>
                        <SelectItem value="folder">Folder</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={createParentId || undefined} onValueChange={(value) => setCreateParentId(value ?? '')}>
                      <SelectTrigger className="h-10 w-full border-zinc-300">
                        <SelectValue placeholder="Default folder" />
                      </SelectTrigger>
                      <SelectContent>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.title || '(Untitled Folder)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Input
                    className="h-10 border-zinc-300 bg-white"
                    placeholder="Title"
                    value={createTitle}
                    onChange={(event) => setCreateTitle(event.target.value)}
                  />

                  {createType === 'bookmark' && (
                    <Input
                      className="h-10 border-zinc-300 bg-white"
                      placeholder="https://example.com"
                      value={createUrl}
                      onChange={(event) => setCreateUrl(event.target.value)}
                    />
                  )}

                  <Button
                    type="submit"
                    className="mt-1 h-10 gap-1.5 bg-amber-500 text-zinc-900 hover:bg-amber-400"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : createType === 'folder' ? (
                      <FolderPlus className="size-4" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Create {createType === 'folder' ? 'Folder' : 'Bookmark'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="transfer">
                <div className="grid gap-3">
                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3">
                    <p className="text-sm font-semibold text-zinc-800">Export Bookmarks</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Download current bookmark tree as JSON for backup or migration.
                    </p>
                    <Button
                      className="mt-3 h-9 gap-1.5 bg-zinc-900 text-white hover:bg-zinc-800"
                      onClick={() => void handleExportBookmarks()}
                      disabled={pageBusy}
                    >
                      {transferLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                      Export JSON
                    </Button>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3">
                    <p className="text-sm font-semibold text-zinc-800">Import Bookmarks</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Import from exported JSON. Imported data will be placed under selected folder.
                    </p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Select value={importParentId || undefined} onValueChange={(value) => setImportParentId(value ?? '')}>
                        <SelectTrigger className="h-10 w-full border-zinc-300">
                          <SelectValue placeholder="Import target folder" />
                        </SelectTrigger>
                        <SelectContent>
                          {folders.map((folder) => (
                            <SelectItem key={folder.id} value={folder.id}>
                              {folder.title || '(Untitled Folder)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        variant="outline"
                        className="h-10 gap-1.5 border-zinc-300"
                        onClick={() => importInputRef.current?.click()}
                        disabled={pageBusy}
                      >
                        {transferLoading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        Select JSON
                      </Button>
                    </div>

                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(event) => void handleImportFile(event)}
                    />

                    <p className="mt-2 text-xs text-zinc-500">
                      {importFileName ? `Selected file: ${importFileName}` : 'No file selected'}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <AnimatePresence>
          {error && (
            <motion.div key="error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Alert variant="destructive" className="border-red-300/70 bg-red-50/90">
                <BookmarkX className="size-4" />
                <AlertTitle>Operation failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <AlertAction>
                  <Button variant="ghost" size="icon-xs" onClick={() => setError(null)}>
                    <X className="size-3" />
                  </Button>
                </AlertAction>
              </Alert>
            </motion.div>
          )}

          {success && (
            <motion.div key="success" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Alert className="border-emerald-300/70 bg-emerald-50/90 text-emerald-800">
                <Check className="size-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{success}</AlertDescription>
                <AlertAction>
                  <Button variant="ghost" size="icon-xs" onClick={() => setSuccess(null)}>
                    <X className="size-3" />
                  </Button>
                </AlertAction>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="border-zinc-200/80 bg-white/90 shadow-md">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{isSearching ? 'Search Results' : 'Bookmark Files View'}</CardTitle>
                <Badge variant={isSearching ? 'secondary' : 'outline'}>
                  {isSearching ? searchResults.length : shownNodes.length}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">右键书签可快速操作</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-zinc-300"
                  onClick={() => void refreshList()}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-4">
            {loading && shownNodes.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : shownNodes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 py-12 text-center">
                <Bookmark className="mx-auto mb-2 size-9 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-600">
                  {isSearching ? 'No search results found.' : 'No bookmarks available yet.'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {isSearching ? 'Try a broader keyword.' : 'Create a bookmark from the Create tab to start.'}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[64vh] min-h-96 pr-2">
                <Files open={openFolders} onOpenChange={setOpenFolders} className="w-full rounded-2xl border border-zinc-200/70 bg-white/70 p-2">
                  {renderTree(shownNodes)}
                </Files>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
