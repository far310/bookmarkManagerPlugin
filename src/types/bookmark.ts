export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiError = {
  ok: false;
  error: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type BookmarkNode = {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  dateAdded?: number;
  children?: BookmarkNode[];
};

export type BrowserHistoryItem = {
  id: string;
  title: string;
  url: string;
  lastVisitTime?: number;
  visitCount?: number;
};

export type BookmarkTransferNode = {
  title: string;
  url?: string;
  children?: BookmarkTransferNode[];
};

export type BookmarkAction =
  | { type: 'LIST_BOOKMARKS' }
  | { type: 'EXPORT_BOOKMARKS' }
  | { type: 'SEARCH_BOOKMARKS'; payload: { query: string } }
  | { type: 'SEARCH_BROWSER_HISTORY'; payload: { query: string; maxResults?: number } }
  | {
      type: 'IMPORT_BOOKMARKS';
      payload: { nodes: BookmarkTransferNode[]; parentId?: string };
    }
  | {
      type: 'CREATE_BOOKMARK';
      payload: { title: string; url?: string; parentId?: string };
    }
  | { type: 'RENAME_BOOKMARK'; payload: { id: string; title: string } }
  | {
      type: 'MOVE_BOOKMARK';
      payload: { id: string; parentId: string; index?: number };
    }
  | { type: 'DELETE_BOOKMARK'; payload: { id: string } };
