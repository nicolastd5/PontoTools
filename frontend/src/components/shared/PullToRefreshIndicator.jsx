export default function PullToRefreshIndicator({ pullY, refreshing, threshold = 70 }) {
  const visible = pullY > 0 || refreshing;
  if (!visible) return null;

  const progress = Math.min(pullY / threshold, 1);
  const ready    = progress >= 1 || refreshing;

  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: pullY || (refreshing ? 40 : 0),
      overflow: 'hidden',
      transition: refreshing ? 'height 0.2s ease' : 'none',
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      <div style={{
        width: 32, height: 32,
        borderRadius: '50%',
        backgroundColor: 'var(--color-surface, #fff)',
        border: '1.5px solid var(--color-border, #e5e7eb)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: `rotate(${refreshing ? 0 : progress * 360}deg)`,
        transition: refreshing ? 'none' : 'transform 0.05s linear',
        animation: refreshing ? 'ptr-spin 0.7s linear infinite' : 'none',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={ready ? 'var(--color-primary, #4f46e5)' : 'var(--color-text-muted, #9ca3af)'}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      </div>
      <style>{`
        @keyframes ptr-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
