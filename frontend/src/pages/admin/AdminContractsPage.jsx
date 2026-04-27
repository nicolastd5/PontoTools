import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import UnitFormModal from '../../components/admin/UnitFormModal';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICON_PLUS     = 'M12 5v14M5 12h14';
const ICON_CLOSE    = 'M18 6 6 18M6 6l12 12';
const ICON_CHEVRON_DOWN = 'M6 9l6 6 6-6';
const ICON_CHEVRON_RIGHT = 'M9 18l6-6-6-6';
const ICON_MAP_PIN  = 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';
const ICON_EXT_LINK = 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14L21 3';

function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then((r) => r.data),
  });
}

const EMPTY_CONTRACT = { name: '', code: '', description: '' };

export default function AdminContractsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const { data, isLoading } = useContracts();

  const [expanded, setExpanded]           = useState({});
  const [contractModal, setContractModal] = useState(null);
  const [unitModal, setUnitModal]         = useState(null);
  const [contractForm, setContractForm]   = useState(EMPTY_CONTRACT);
  const [editContractId, setEditContractId] = useState(null);

  const createContract = useMutation({
    mutationFn: (body) => api.post('/contracts', body),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); success('Contrato criado.'); closeContractModal(); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao criar contrato.'),
  });
  const updateContract = useMutation({
    mutationFn: ({ id, body }) => api.put(`/contracts/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); success('Contrato atualizado.'); closeContractModal(); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao atualizar contrato.'),
  });
  const deactivateContract = useMutation({
    mutationFn: (id) => api.delete(`/contracts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); success('Contrato desativado.'); },
    onError: () => error('Erro ao desativar contrato.'),
  });
  const destroyContract = useMutation({
    mutationFn: (id) => api.delete(`/contracts/${id}/destroy`),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); success('Contrato excluído permanentemente.'); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao excluir contrato.'),
  });
  const destroyUnit = useMutation({
    mutationFn: (id) => api.delete(`/units/${id}/destroy`),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); queryClient.invalidateQueries(['units']); success('Posto excluído permanentemente.'); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao excluir posto.'),
  });
  const createUnit = useMutation({
    mutationFn: (body) => api.post('/units', body),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); queryClient.invalidateQueries(['units']); success('Posto criado.'); setUnitModal(null); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao criar posto.'),
  });
  const updateUnit = useMutation({
    mutationFn: ({ id, body }) => api.put(`/units/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); queryClient.invalidateQueries(['units']); success('Posto atualizado.'); setUnitModal(null); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao atualizar posto.'),
  });

  function handleUnitSave(formData) {
    const unitId = unitModal?.unit?.id;
    if (unitId) updateUnit.mutate({ id: unitId, body: formData });
    else createUnit.mutate(formData);
  }

  function openCreateContract() { setContractForm(EMPTY_CONTRACT); setEditContractId(null); setContractModal('form'); }
  function openEditContract(c) { setContractForm({ name: c.name, code: c.code, description: c.description || '' }); setEditContractId(c.id); setContractModal('form'); }
  function closeContractModal() { setContractModal(null); setContractForm(EMPTY_CONTRACT); setEditContractId(null); }
  function toggleExpand(id) { setExpanded((p) => ({ ...p, [id]: !p[id] })); }

  const contracts  = data?.contracts || [];
  const unassigned = data?.unassigned || [];
  const isSaving   = createContract.isLoading || updateContract.isLoading;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>Contratos</h1>
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>Gerencie contratos e seus postos de trabalho.</p>
        </div>
        <button onClick={openCreateContract} style={inkBtn}>
          <Icon d={ICON_PLUS} size={14} color="#fff" strokeWidth={2.5} /> Novo Contrato
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--color-muted)', padding: 24 }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {contracts.map((c) => (
            <div key={c.id} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--color-line)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <button onClick={() => toggleExpand(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-muted)', display: 'flex', alignItems: 'center' }}>
                    <Icon d={expanded[c.id] ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT} size={16} color="var(--color-muted)" />
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-soft)', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                    {c.code}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>{c.description}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: c.active ? 'rgba(16,185,129,0.1)' : 'var(--color-hairline)', color: c.active ? '#059669' : 'var(--color-muted)' }}>
                    {c.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-subtle)', whiteSpace: 'nowrap' }}>
                    {c.units.length} posto{c.units.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => setUnitModal({ unit: { contract_id: c.id } })} style={ghostBtn}>
                    <Icon d={ICON_PLUS} size={13} color="var(--color-primary)" /> Posto
                  </button>
                  <button onClick={() => openEditContract(c)} style={ghostBtn}>Editar</button>
                  {c.active && (
                    <button onClick={() => deactivateContract.mutate(c.id)} style={{ ...ghostBtn, color: 'var(--color-warn)' }}>Desativar</button>
                  )}
                  <button
                    onClick={() => { if (window.confirm(`Excluir o contrato "${c.name}" permanentemente?`)) destroyContract.mutate(c.id); }}
                    style={{ ...ghostBtn, color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.2)' }}>Excluir</button>
                </div>
              </div>

              {expanded[c.id] && (
                <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
                  {c.units.length === 0 ? (
                    <p style={{ padding: '12px 18px 12px 52px', fontSize: 13, color: 'var(--color-subtle)' }}>
                      Nenhum posto neste contrato.{' '}
                      <button onClick={() => setUnitModal({ unit: { contract_id: c.id } })} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                        Adicionar posto
                      </button>
                    </p>
                  ) : (
                    c.units.map((u) => (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 48px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-hairline)' }}>
                        <Icon d={ICON_MAP_PIN} size={14} color="var(--color-subtle)" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', background: 'var(--color-hairline)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{u.code}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{u.name}</div>
                          {u.address && <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 1 }}>{u.address}</div>}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{u.radius_meters}m</span>
                        <a href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <Icon d={ICON_EXT_LINK} size={12} color="var(--color-primary)" /> Mapa
                        </a>
                        <button onClick={() => setUnitModal({ unit: u })} style={ghostBtn}>Editar</button>
                        <button onClick={() => { if (window.confirm(`Excluir o posto "${u.name}"?`)) destroyUnit.mutate(u.id); }}
                          style={{ ...ghostBtn, color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.2)' }}>Excluir</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Unassigned units */}
          {unassigned.length > 0 && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid rgba(245,158,11,0.4)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => toggleExpand('unassigned')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
                  <Icon d={expanded['unassigned'] ? ICON_CHEVRON_DOWN : ICON_CHEVRON_RIGHT} size={16} color="var(--color-warn)" />
                </button>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>Postos sem contrato</div>
                <span style={{ fontSize: 12, color: 'var(--color-subtle)' }}>{unassigned.length} posto{unassigned.length !== 1 ? 's' : ''}</span>
              </div>
              {expanded['unassigned'] && (
                <div style={{ borderTop: '1px solid var(--color-hairline)' }}>
                  {unassigned.map((u) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px 10px 48px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-hairline)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', background: 'var(--color-hairline)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{u.code}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{u.name}</div>
                        {u.address && <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 1 }}>{u.address}</div>}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{u.radius_meters}m</span>
                      <button onClick={() => setUnitModal({ unit: u })} style={ghostBtn}>Editar</button>
                      <button onClick={() => { if (window.confirm(`Excluir o posto "${u.name}"?`)) destroyUnit.mutate(u.id); }}
                        style={{ ...ghostBtn, color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.2)' }}>Excluir</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contracts.length === 0 && unassigned.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <p>Nenhum contrato cadastrado.</p>
              <button onClick={openCreateContract} style={inkBtn}>
                <Icon d={ICON_PLUS} size={14} color="#fff" strokeWidth={2.5} /> Criar primeiro contrato
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Contrato */}
      {contractModal === 'form' && (
        <div style={overlay} onClick={closeContractModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.03em' }}>
                {editContractId ? 'Editar Contrato' : 'Novo Contrato'}
              </h2>
              <button onClick={closeContractModal} style={iconCloseBtn}>
                <Icon d={ICON_CLOSE} size={16} color="var(--color-muted)" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); editContractId ? updateContract.mutate({ id: editContractId, body: contractForm }) : createContract.mutate(contractForm); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nome *">
                <input value={contractForm.name} onChange={(e) => setContractForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Nome do contrato" style={inputStyle} />
              </Field>
              <Field label="Código *">
                <input value={contractForm.code} onChange={(e) => setContractForm((p) => ({ ...p, code: e.target.value }))} required placeholder="CONT001" style={inputStyle} />
              </Field>
              <Field label="Descrição">
                <textarea value={contractForm.description} onChange={(e) => setContractForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição opcional" style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} />
              </Field>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeContractModal} style={outlineBtn}>Cancelar</button>
                <button type="submit" disabled={isSaving} style={{ ...inkBtn, opacity: isSaving ? 0.7 : 1 }}>
                  {isSaving ? 'Salvando...' : editContractId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {unitModal !== null && (
        <UnitFormModal
          unit={unitModal.unit}
          contracts={contracts}
          userRole="admin"
          onSave={handleUnitSave}
          onClose={() => setUnitModal(null)}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  );
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard  = { background: 'var(--bg-card)', borderRadius: 16, padding: '28px 24px', width: '100%', maxWidth: 460, boxShadow: '0 24px 64px -12px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' };
const inputStyle = { padding: '9px 12px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 14, color: 'var(--color-ink)', outline: 'none', background: 'var(--bg-card)' };
const inkBtn     = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'var(--color-primary)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--color-ink)', background: 'var(--bg-card)', fontWeight: 600 };
const ghostBtn   = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'none', border: '1.5px solid var(--color-line)', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-muted)' };
const iconCloseBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center' };
