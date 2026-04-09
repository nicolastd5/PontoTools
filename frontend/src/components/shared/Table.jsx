// Tabela genérica paginada e responsiva
export default function Table({ columns, rows, pagination, onPageChange, emptyMessage = 'Nenhum registro encontrado.' }) {
  return (
    <div>
      {/* Wrapper scroll horizontal para mobile */}
      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0' }}>
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
                <tr key={row.id ?? i} style={i % 2 === 0 ? {} : { background: '#f8fafc' }}>
                  {columns.map((col) => (
                    <td key={col.key} style={styles.td}>
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
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
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', fontSize: 13 },
  th: {
    padding:     '11px 14px',
    textAlign:   'left',
    fontSize:    12,
    fontWeight:  600,
    color:       '#64748b',
    background:  '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    whiteSpace:  'nowrap',
  },
  td: {
    padding:     '10px 14px',
    borderBottom: '1px solid #f1f5f9',
    color:       '#374151',
    verticalAlign: 'middle',
  },
  empty: {
    padding:   '40px 20px',
    textAlign: 'center',
    color:     '#94a3b8',
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
  pageInfo: { fontSize: 13, color: '#64748b' },
  pageButtons: { display: 'flex', gap: 8 },
  pageBtn: {
    padding:      '6px 14px',
    background:   '#fff',
    border:       '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize:     13,
    cursor:       'pointer',
    color:        '#374151',
    transition:   'all 0.15s',
  },
};
