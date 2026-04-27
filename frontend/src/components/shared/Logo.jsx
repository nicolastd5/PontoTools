import Icon from './Icon';

export default function Logo({ size = 32, theme }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
      display: 'grid', placeItems: 'center',
      flexShrink: 0,
      boxShadow: `0 2px 8px -2px ${theme.primary}60`,
    }}>
      <Icon name="logo" size={size * 0.56} color="#fff" strokeWidth={2.5} />
    </div>
  );
}
