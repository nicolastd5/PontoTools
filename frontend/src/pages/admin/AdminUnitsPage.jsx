import { useState }  from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api           from '../../services/api';
import { useAuth }   from '../../contexts/AuthContext';
import { useToast }  from '../../contexts/ToastContext';
import UnitFormModal from '../../components/admin/UnitFormModal';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICON_MAP_PIN = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const ICON_PLUS    = 'M12 5v14M5 12h14';
const ICON_EDIT    = 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z';
const ICON_EXT_LINK = 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#4f46e5,#7c3aed)',
  'linear-gradient(135deg,#0ea5e9,#6366f1)',
  'linear-gradient(135deg,#10b981,#0ea5e9)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
];

function useContracts() {
  return useQuery({ queryKey: ['contracts'], queryFn: () => api.get('/contracts').then((r) => r.data.contracts) });
}

export default function AdminUnitsPage() {
  const queryClient  = useQueryClient();
  const { success, error } = useToast();
  const { user }     = useAuth();

  function refreshUnits() {
    queryClient.invalidateQueries({ queryKey: ['units-admin'] });
    queryClient.invalidateQueries({ queryKey: ['units'] });
  }

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['units-admin'],
    queryFn:  () => api.get('/units').then((r) => r.data.units),
  });

  const { data: contracts = [] } = useContracts();

  const [modal, setModal] = useState(null);

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/units', data),
    onSuccess: () => { refreshUnits(); success('Posto criado.'); setModal(null); },
    onError:   () => error('Erro ao criar posto.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/units/${id}`, data),
    onSuccess: () => { refreshUnits(); success('Posto atualizado.'); setModal(null); },
    onError:   () => error('Erro ao atualizar posto.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.delete(`/units/${id}`),
    onSuccess: () => { refreshUnits(); success('Posto desativado.'); },
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
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>
            Unidades
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>
            Gerencie as unidades e seus pontos de referência GPS.
          </p>
        </div>
        <button onClick={() => setModal({})} style={inkBtn}>
          <Icon d={ICON_PLUS} size={14} color="#fff" strokeWidth={2.5} />
          Novo Posto
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-muted)', padding: 24, textAlign: 'center' }}>Carregando...</p>
      ) : units.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-muted)', fontSize: 14 }}>
          Nenhuma unidade cadastrada.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {units.map((u, idx) => (
            <UnitCard
              key={u.id}
              unit={u}
              gradient={AVATAR_GRADIENTS[idx % 5]}
              onEdit={() => setModal({ unit: u })}
              onDeactivate={() => window.confirm(`Desativar "${u.name}"?`) && deactivateMutation.mutate(u.id)}
            />
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

function UnitCard({ unit: u, gradient, onEdit, onDeactivate }) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--color-line)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Colored top bar */}
      <div style={{ height: 4, background: gradient }} />

      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon d={ICON_MAP_PIN} size={16} color="#fff" strokeWidth={2} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--color-primary)',
              background: 'var(--color-primary-soft)', padding: '2px 8px', borderRadius: 4,
              fontFamily: 'var(--font-mono)',
            }}>{u.code}</span>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            background: u.active ? 'rgba(16,185,129,0.1)' : 'var(--color-hairline)',
            color: u.active ? '#059669' : 'var(--color-muted)',
          }}>
            {u.active ? 'Ativa' : 'Inativa'}
          </span>
        </div>

        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          {u.name}
        </h3>
        {u.address && (
          <p style={{ fontSize: 12, color: 'var(--color-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>{u.address}</p>
        )}

        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          {[
            { label: 'Lat', value: parseFloat(u.latitude).toFixed(5) },
            { label: 'Lng', value: parseFloat(u.longitude).toFixed(5) },
            { label: 'Raio', value: `${u.radius_meters}m` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--color-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--color-ink)', fontWeight: 600, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--color-hairline)' }}>
          <button onClick={onEdit} style={ghostBtn}>
            <Icon d={ICON_EDIT} size={13} color="var(--color-muted)" />
            Editar
          </button>
          {u.active && (
            <button onClick={onDeactivate} style={{ ...ghostBtn, color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
              Desativar
            </button>
          )}
          <a
            href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
            target="_blank" rel="noreferrer"
            style={{ ...ghostBtn, textDecoration: 'none', marginLeft: 'auto', color: 'var(--color-primary)' }}
          >
            <Icon d={ICON_EXT_LINK} size={13} color="var(--color-primary)" />
            Mapa
          </a>
        </div>
      </div>
    </div>
  );
}

const inkBtn = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '9px 16px', background: 'var(--color-primary)', border: 'none',
  borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  letterSpacing: '-0.01em',
};

const ghostBtn = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '5px 12px', background: 'none',
  border: '1.5px solid var(--color-line)', borderRadius: 7,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-muted)',
};
