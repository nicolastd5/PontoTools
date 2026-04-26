export default function LogoIcon({ size = 36, radius, className, style }) {
  const r = radius ?? Math.round(size * 0.25);
  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        background: 'var(--color-primary)',
        borderRadius: r,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        width={size * 0.6}
        height={size * 0.6}
      >
        <path d="M9 5v22M9 5h8a7 7 0 0 1 0 14H9" />
      </svg>
    </span>
  );
}
