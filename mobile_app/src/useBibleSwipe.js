import { useSwipe } from './useSwipe';

export function useBibleSwipe(containerRef, goToBibleChapter, selectedBibleChapterIndex) {
  useSwipe(
    containerRef,
    () => goToBibleChapter(selectedBibleChapterIndex + 1),
    () => goToBibleChapter(selectedBibleChapterIndex - 1),
    { minDx: 42 },
  );
}
