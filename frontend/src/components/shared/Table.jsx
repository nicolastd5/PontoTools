// Tabela genérica paginada e responsiva
export default function Table({ columns, rows, pagination, onPageChange, emptyMessage = 'Nenhum registro encontrado.' }) {
  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ ...styles.th, width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={styles.empty}>{emptyMessage}</td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i} style={i % 2 !== 0 ? { background: 'var(--color-hairline)' } : {}}>
                  {columns.map((col) => (
                    <td key={col.key} style={styles.td}>
                      {col.render ? col.render(row[col.key], row, i) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div style={styles.pagination}>
          <span style={styles.pageInfo}>
            Página {pagination.page} de {pagination.totalPages}
            {' '}({pagination.total} registros)
          </span>
          <div style={styles.pageButtons}>
            <button
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
              style={{ ...styles.pageBtn, opacity: pagination.page <= 1 ? 0.4 : 1 }}
            >← Anterior</button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
              style={{ ...styles.pageBtn, opacity: pagination.page >= pagination.totalPages ? 0.4 : 1 }}
            >Próxima →</button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', background: 'var(--bg-card)', fontSize: 13 },
  th: {
    padding:      '11px 14px',
    textAlign:    'left',
    fontSize:     12,
    fontWeight:   600,
    color:        'var(--color-muted)',
    background:   'var(--color-surface)',
    borderBottom: '1px solid var(--border-default)',
    whiteSpace:   'nowrap',
  },
  td: {
    padding:      '10px 14px',
    borderBottom: '1px solid var(--border-light)',
    color:        'var(--text-primary)',
    verticalAlign: 'middle',
  },
  empty: {
    padding:   '40px 20px',
    textAlign: 'center',
    color:     'var(--color-subtle)',
    fontSize:  14,
  },
  pagination: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '12px 4px',
    flexWrap:       'wrap',
    gap:            8,
  },
  pageInfo:    { fontSize: 13, color: 'var(--color-muted)' },
  pageButtons: { display: 'flex', gap: 8 },
  pageBtn: {
    padding:      '6px 14px',
    background:   'var(--bg-card)',
    border:       '1px solid var(--border-default)',
    borderRadius: 6,
    fontSize:     13,
    cursor:       'pointer',
    color:        'var(--text-primary)',
    transition:   'all 0.15s',
  },
};
