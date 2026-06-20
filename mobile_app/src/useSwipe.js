import { useEffect, useRef } from 'react';

/**
 * Attaches a reliable horizontal swipe detector to a scrollable container.
 * Uses refs for callbacks so listeners are attached once on mount — no
 * mid-gesture teardown when parent state changes.
 *
 * @param {React.RefObject} containerRef - ref of the element to watch
 * @param {() => void} onSwipeLeft  - fired on left swipe (finger moves left)
 * @param {() => void} onSwipeRight - fired on right swipe (finger moves right)
 * @param {{ minDx?: number }} options
 */
export function useSwipe(containerRef, onSwipeLeft, onSwipeRight, { minDx = 50 } = {}) {
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  const minDxRef = useRef(minDx);

  // Keep refs current on every render — no re-attachment needed
  useEffect(() => {
    onSwipeLeftRef.current = onSwipeLeft;
    onSwipeRightRef.current = onSwipeRight;
    minDxRef.current = minDx;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const startX = { v: null };
    const startY = { v: null };
    const dir = { v: null }; // 'h' | 'v' | null

    const reset = () => { startX.v = null; startY.v = null; dir.v = null; };

    const onTouchStart = (e) => {
      startX.v = e.touches[0].clientX;
      startY.v = e.touches[0].clientY;
      dir.v = null;
    };

    const onTouchMove = (e) => {
      if (startX.v === null) return;
      const dx = Math.abs(e.touches[0].clientX - startX.v);
      const dy = Math.abs(e.touches[0].clientY - startY.v);
      if (!dir.v && (dx > 20 || dy > 20)) {
        dir.v = dy > dx * 2 ? 'v' : 'h';
      }
      if (dir.v === 'h') e.preventDefault();
    };

    const onTouchEnd = (e) => {
      if (startX.v === null || dir.v !== 'h') { reset(); return; }
      const dx = e.changedTouches[0].clientX - startX.v;
      const dy = e.changedTouches[0].clientY - startY.v;
      reset();
      if (Math.abs(dy) > Math.abs(dx) * 1.5) return;
      if (Math.abs(dx) < minDxRef.current) return;
      if (dx < 0) onSwipeLeftRef.current?.();
      else onSwipeRightRef.current?.();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', reset, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', reset);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);
}
