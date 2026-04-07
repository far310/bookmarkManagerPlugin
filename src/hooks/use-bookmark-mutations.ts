import { useState } from 'react';
import { bookmarkApi } from '@src/lib/bookmarks/api';
import { BookmarkNode } from '@src/types/bookmark';

export function useBookmarkMutations() {
  const [createLoading, setCreateLoading] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);

  async function createBookmark(payload: { title: string; url?: string; parentId?: string }): Promise<BookmarkNode> {
    setCreateLoading(true);
    try {
      return await bookmarkApi.createBookmark(payload);
    } finally {
      setCreateLoading(false);
    }
  }

  async function renameBookmark(id: string, title: string): Promise<BookmarkNode> {
    setActionPendingId(id);
    try {
      return await bookmarkApi.renameBookmark({ id, title });
    } finally {
      setActionPendingId(null);
    }
  }

  async function moveBookmark(id: string, parentId: string, index?: number): Promise<BookmarkNode> {
    setActionPendingId(id);
    try {
      return await bookmarkApi.moveBookmark({ id, parentId, index });
    } finally {
      setActionPendingId(null);
    }
  }

  async function deleteBookmark(id: string): Promise<{ id: string }> {
    setActionPendingId(id);
    try {
      return await bookmarkApi.deleteBookmark(id);
    } finally {
      setActionPendingId(null);
    }
  }

  return {
    createLoading,
    actionPendingId,
    createBookmark,
    renameBookmark,
    moveBookmark,
    deleteBookmark,
  };
}