import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BookmarkState {
  bookmarkedIds: string[];
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => void;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarkedIds: [],
      isBookmarked: (id) => get().bookmarkedIds.includes(id),
      toggleBookmark: (id) =>
        set((state) => ({
          bookmarkedIds: state.bookmarkedIds.includes(id)
            ? state.bookmarkedIds.filter((existingId) => existingId !== id)
            : [...state.bookmarkedIds, id],
        })),
    }),
    {
      name: "it-news-app-bookmarks",
    }
  )
);
