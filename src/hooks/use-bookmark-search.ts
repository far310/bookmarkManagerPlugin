import { useState } from 'react';
import { bookmarkApi } from '@src/lib/bookmarks/api';
import { BookmarkNode } from '@src/types/bookmark';

type UseBookmarkSearchOptions = {
  filter?: (node: BookmarkNode) => boolean;
};

export function useBookmarkSearch(options?: UseBookmarkSearchOptions) {
  const [results, setResults] = useState<BookmarkNode[]>([]);
  const [loading, setLoading] = useState(false);

  async function searchBookmarks(rawQuery: string): Promise<BookmarkNode[]> {
    const query = rawQuery.trim();
    if (!query) {
      setResults([]);
      return [];
    }

    setLoading(true);
    try {
      const data = await bookmarkApi.searchBookmarks(query);
      const nextResults = options?.filter ? data.filter(options.filter) : data;
      setResults(nextResults);
      return nextResults;
    } finally {
      setLoading(false);
    }
  }

  function clearResults() {
    setResults([]);
  }

  return {
    results,
    setResults,
    loading,
    searchBookmarks,
    clearResults,
  };
}