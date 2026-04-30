import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL  = 110;

export default function usePullToRefresh(onRefresh) {
  const [pulling, setPulling]     = useState(false);
  const [pullY, setPullY]         = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current || window;

    function getScrollTop() {
      if (containerRef.current) return containerRef.current.scrollTop;
      return window.scrollY || document.documentElement.scrollTop;
    }

    function onTouchStart(e) {
      if (getScrollTop() > 0) return;
      startYRef.current = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (startYRef.current === null) return;
      if (getScrollTop() > 0) { startYRef.current = null; return; }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) { setPulling(false); setPullY(0); return; }
      e.preventDefault();
      setPulling(true);
      setPullY(Math.min(delta * 0.5, MAX_PULL));
    }

    function onTouchEnd() {
      if (!pulling) { startYRef.current = null; return; }
      if (pullY >= THRESHOLD) {
        setRefreshing(true);
        setPullY(40);
        Promise.resolve(onRefresh()).finally(() => {
          setRefreshing(false);
          setPulling(false);
          setPullY(0);
        });
      } else {
        setPulling(false);
        setPullY(0);
      }
      startYRef.current = null;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [pulling, pullY, onRefresh]);

  return { containerRef, pulling, pullY, refreshing };
}
