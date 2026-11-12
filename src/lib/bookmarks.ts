import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CawItem } from './api';

// Bookmarks are a purely on-device feature in this version: the bookmarked
// caw ids plus a snapshot of the post are kept in AsyncStorage. They work
// offline and across nodes, and nothing is sent to (or claimed to sync
// with) any server.
const BOOKMARKS_KEY = 'ethcaw.bookmarks.v1';

export interface Bookmark {
  id: string;
  /** When the user bookmarked it (ms epoch) — the list is sorted by this. */
  bookmarkedAt: number;
  /** Snapshot of the post as it looked when bookmarked. */
  item: CawItem;
}

export async function loadBookmarks(): Promise<Bookmark[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((b) => b && typeof b.id === 'string' && b.item)
      .sort((a, b) => b.bookmarkedAt - a.bookmarkedAt);
  } catch {
    return [];
  }
}

export async function saveBookmarks(bookmarks: Bookmark[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    // Best-effort local storage; a failed write just loses the change.
  }
}

/** Toggle one post. Returns the new list (newest-bookmarked first). */
export async function toggleBookmark(
  bookmarks: Bookmark[],
  item: CawItem,
): Promise<Bookmark[]> {
  const exists = bookmarks.some((b) => b.id === item.id);
  const next = exists
    ? bookmarks.filter((b) => b.id !== item.id)
    : [{ id: item.id, bookmarkedAt: Date.now(), item }, ...bookmarks];
  await saveBookmarks(next);
  return next;
}
