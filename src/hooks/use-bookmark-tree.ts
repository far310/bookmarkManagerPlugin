import { useState } from 'react';
import { bookmarkApi } from '@src/lib/bookmarks/api';
import { BookmarkNode } from '@src/types/bookmark';

export function useBookmarkTree() {
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadTree(): Promise<BookmarkNode[]> {
    setLoading(true);
    try {
      const data = await bookmarkApi.listBookmarks();
      setTree(data);
      return data;
    } finally {
      setLoading(false);
    }
  }

  return {
    tree,
    setTree,
    loading,
    loadTree,
  };
}