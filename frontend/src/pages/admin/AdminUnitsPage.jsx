import { useState }  from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api           from '../../services/api';
import { useAuth }   from '../../contexts/AuthContext';
import { useToast }  from '../../contexts/ToastContext';
import UnitFormModal from '../../components/admin/UnitFormModal';

function useContracts() {
  return useQuery({ queryKey: ['contracts'], queryFn: () => api.get('/contracts').then((r) => r.data.contracts) });
}

export default function AdminUnitsPage() {
  const queryClient  = useQueryClient();
  const { success, error } = useToast();
  const { user }     = useAuth();

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units-admin'],
    queryFn:  () => api.get('/units').then((r) => r.data.units),
  });

  const { data: contracts = [] } = useContracts();

  const [modal, setModal]   = useState(null); // null | { unit?: object }

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/units', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units-admin'] }); success('Posto criado.'); setModal(null); },
    onError:   () => error('Erro ao criar posto.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/units/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units-admin'] }); success('Posto atualizado.'); setModal(null); },
    onError:   () => error('Erro ao atualizar posto.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/units/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['units-admin'] }); success('Posto desativado.'); },
    onError:   () => error('Erro ao desativar posto.'),
  });

  function handleSave(formData) {
    if (modal?.unit?.id) {
      updateMutation.mutate({ id: modal.unit.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={styles.title}>Unidades</h1>
          <p style={styles.subtitle}>Gerencie as unidades e seus pontos de referência GPS.</p>
        </div>
        <button onClick={() => setModal({})} style={styles.newBtn}>+ Novo Posto</button>
      </div>

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div style={styles.grid}>
          {units.map((u) => (
            <div key={u.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <span style={styles.code}>{u.code}</span>
                <span style={{ ...styles.badge, background: u.active ? '#dcfce7' : '#f1f5f9', color: u.active ? '#166534' : '#64748b' }}>
                  {u.active ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <h3 style={styles.name}>{u.name}</h3>
              {u.address && <p style={styles.address}>{u.address}</p>}
              <div style={styles.coords}>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Lat</span>
                  <span style={styles.coordValue}>{parseFloat(u.latitude).toFixed(5)}</span>
                </div>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Lng</span>
                  <span style={styles.coordValue}>{parseFloat(u.longitude).toFixed(5)}</span>
                </div>
                <div style={styles.coordItem}>
                  <span style={styles.coordLabel}>Raio</span>
                  <span style={styles.coordValue}>{u.radius_meters}m</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => setModal({ unit: u })} style={styles.editBtn}>Editar</button>
                {u.active && (
                  <button
                    onClick={() => window.confirm(`Desativar "${u.name}"?`) && deactivateMutation.mutate(u.id)}
                    style={styles.deactivateBtn}
                  >
                    Desativar
                  </button>
                )}
                <a href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
                  target="_blank" rel="noreferrer" style={styles.mapLink}>
                  Ver no mapa ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <UnitFormModal
          unit={modal.unit}
          contracts={contracts}
          userRole={user?.role}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const styles = {
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 0 },
  newBtn: {
    padding: '10px 18px', background: '#1d4ed8', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  code:    { fontSize: 12, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 4 },
  badge:   { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 },
  name:    { fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  address: { fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.5 },
  coords:  { display: 'flex', gap: 12, marginBottom: 8 },
  coordItem:   { display: 'flex', flexDirection: 'column', gap: 2 },
  coordLabel:  { fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' },
  coordValue:  { fontSize: 12, color: '#374151', fontWeight: 600 },
  editBtn:     { padding: '6px 14px', background: '#f1f5f9', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' },
  deactivateBtn: { padding: '6px 14px', background: '#fef2f2', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#dc2626' },
  mapLink: { fontSize: 12, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center' },
};
