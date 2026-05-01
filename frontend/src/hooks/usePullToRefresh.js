import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 70;
const MAX_PULL  = 110;

export default function usePullToRefresh(onRefresh) {
  const [pullY, setPullY]           = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const containerRef  = useRef(null);
  const startYRef     = useRef(null);
  const pullingRef    = useRef(false);
  const pullYRef      = useRef(0);
  const onRefreshRef  = useRef(onRefresh);

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

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
      if (delta <= 0) {
        pullingRef.current = false;
        pullYRef.current   = 0;
        setPullY(0);
        return;
      }
      e.preventDefault();
      pullingRef.current = true;
      pullYRef.current   = Math.min(delta * 0.5, MAX_PULL);
      setPullY(pullYRef.current);
    }

    function onTouchEnd() {
      if (!pullingRef.current) { startYRef.current = null; return; }
      if (pullYRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPullY(40);
        Promise.resolve(onRefreshRef.current()).finally(() => {
          setRefreshing(false);
          pullingRef.current = false;
          pullYRef.current   = 0;
          setPullY(0);
        });
      } else {
        pullingRef.current = false;
        pullYRef.current   = 0;
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
  }, []); // listeners montados uma única vez

  return { containerRef, pullY, refreshing };
}
