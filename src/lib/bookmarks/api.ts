import { BookmarkAction, BookmarkNode, BookmarkTransferNode } from '@src/types/bookmark';

type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: string;
};

type ApiResponse<T> = ApiSuccess<T> | ApiError;

function sendBookmarkAction<T>(action: BookmarkAction): Promise<ApiResponse<T>> {
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

async function requestBookmarkAction<T>(action: BookmarkAction): Promise<T> {
  const response = await sendBookmarkAction<T>(action);
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data;
}

export const bookmarkApi = {
  listBookmarks(): Promise<BookmarkNode[]> {
    return requestBookmarkAction<BookmarkNode[]>({ type: 'LIST_BOOKMARKS' });
  },

  exportBookmarks(): Promise<{ exportedAt: string; nodes: BookmarkTransferNode[] }> {
    return requestBookmarkAction<{ exportedAt: string; nodes: BookmarkTransferNode[] }>({
      type: 'EXPORT_BOOKMARKS',
    });
  },

  searchBookmarks(query: string): Promise<BookmarkNode[]> {
    return requestBookmarkAction<BookmarkNode[]>({
      type: 'SEARCH_BOOKMARKS',
      payload: { query },
    });
  },

  importBookmarks(payload: {
    nodes: BookmarkTransferNode[];
    parentId?: string;
  }): Promise<{ importedBookmarks: number; importedFolders: number }> {
    return requestBookmarkAction<{ importedBookmarks: number; importedFolders: number }>({
      type: 'IMPORT_BOOKMARKS',
      payload,
    });
  },

  createBookmark(payload: { title: string; url?: string; parentId?: string }): Promise<BookmarkNode> {
    return requestBookmarkAction<BookmarkNode>({
      type: 'CREATE_BOOKMARK',
      payload,
    });
  },

  renameBookmark(payload: { id: string; title: string }): Promise<BookmarkNode> {
    return requestBookmarkAction<BookmarkNode>({
      type: 'RENAME_BOOKMARK',
      payload,
    });
  },

  moveBookmark(payload: { id: string; parentId: string; index?: number }): Promise<BookmarkNode> {
    return requestBookmarkAction<BookmarkNode>({
      type: 'MOVE_BOOKMARK',
      payload,
    });
  },

  deleteBookmark(id: string): Promise<{ id: string }> {
    return requestBookmarkAction<{ id: string }>({
      type: 'DELETE_BOOKMARK',
      payload: { id },
    });
  },
};

export { sendBookmarkAction, requestBookmarkAction };