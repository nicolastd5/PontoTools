// Lista de funcionários sem registro no dia
export default function AbsentEmployeesList({ employees = [], loading }) {
  if (loading) return null;
  if (!employees.length) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>
        Sem Registro Hoje
        <span style={styles.count}>{employees.length}</span>
      </h3>
      <div style={styles.list}>
        {employees.map((emp) => (
          <div key={emp.id} style={styles.item}>
            <div style={styles.avatar}>{emp.full_name[0]}</div>
            <div style={styles.info}>
              <div style={styles.name}>{emp.full_name}</div>
              <div style={styles.sub}>{emp.badge_number} · {emp.unit_name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background:   '#fff',
    borderRadius: 12,
    border:       '1px solid #fed7aa',
    overflow:     'hidden',
    marginTop:    24,
  },
  title: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    fontSize:       15, fontWeight: 700, color: '#0f172a',
    padding:        '18px 20px',
    borderBottom:   '1px solid #fff7ed',
    background:     '#fffbeb',
  },
  count: {
    background: '#d97706', color: '#fff',
    borderRadius: 20, fontSize: 12,
    padding: '2px 10px', fontWeight: 700,
  },
  list: { maxHeight: 280, overflowY: 'auto' },
  item: {
    display:    'flex', alignItems: 'center', gap: 12,
    padding:    '10px 20px',
    borderBottom: '1px solid #fef3c7',
  },
  avatar: {
    width: 34, height: 34,
    background:     '#d97706',
    borderRadius:   '50%',
    display:        'flex', alignItems: 'center', justifyContent: 'center',
    color:          '#fff', fontWeight: 700, fontSize: 14,
    flexShrink:     0,
  },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: 600, color: '#0f172a' },
  sub:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
};
