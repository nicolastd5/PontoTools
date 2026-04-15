import './ServiceStatusBadge.css';

const STATUS_THEME = {
  pending:          { bg: '#fef9c3', color: '#854d0e' },
  in_progress:      { bg: '#dbeafe', color: '#1e40af' },
  done:             { bg: '#dcfce7', color: '#166534' },
  done_with_issues: { bg: '#fff7ed', color: '#c2410c' },
  problem:          { bg: '#fee2e2', color: '#991b1b' },
};

export default function ServiceStatusBadge({ status, label }) {
  const theme = STATUS_THEME[status] || STATUS_THEME.pending;
  return (
    <span
      className={`service-status-badge service-status-badge--${status || 'pending'}`}
      style={{ '--badge-bg': theme.bg, '--badge-color': theme.color }}
    >
      {label}
    </span>
  );
}
