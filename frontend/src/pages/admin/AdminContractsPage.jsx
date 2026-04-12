import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then((r) => r.data),
  });
}

const EMPTY_CONTRACT = { name: '', code: '', description: '' };
const EMPTY_UNIT = { name: '', code: '', latitude: '', longitude: '', radius_meters: '100', address: '', contract_id: '' };

export default function AdminContractsPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const { data, isLoading } = useContracts();

  const [expanded, setExpanded]         = useState({});
  const [contractModal, setContractModal] = useState(null); // null | { mode: 'create'|'edit', data? }
  const [unitModal, setUnitModal]         = useState(null); // null | { mode: 'create'|'edit', contractId, data? }
  const [contractForm, setContractForm]   = useState(EMPTY_CONTRACT);
  const [unitForm, setUnitForm]           = useState(EMPTY_UNIT);
  const [editContractId, setEditContractId] = useState(null);
  const [editUnitId, setEditUnitId]         = useState(null);

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

  const createUnit = useMutation({
    mutationFn: (body) => api.post('/units', body),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); queryClient.invalidateQueries(['units']); success('Posto criado.'); closeUnitModal(); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao criar posto.'),
  });

  const updateUnit = useMutation({
    mutationFn: ({ id, body }) => api.put(`/units/${id}`, body),
    onSuccess: () => { queryClient.invalidateQueries(['contracts']); queryClient.invalidateQueries(['units']); success('Posto atualizado.'); closeUnitModal(); },
    onError: (e) => error(e.response?.data?.error || 'Erro ao atualizar posto.'),
  });

  function openCreateContract() {
    setContractForm(EMPTY_CONTRACT);
    setEditContractId(null);
    setContractModal('form');
  }

  function openEditContract(c) {
    setContractForm({ name: c.name, code: c.code, description: c.description || '' });
    setEditContractId(c.id);
    setContractModal('form');
  }

  function closeContractModal() {
    setContractModal(null);
    setContractForm(EMPTY_CONTRACT);
    setEditContractId(null);
  }

  function openCreateUnit(contractId) {
    setUnitForm({ ...EMPTY_UNIT, contract_id: contractId });
    setEditUnitId(null);
    setUnitModal('form');
  }

  function openEditUnit(u) {
    setUnitForm({
      name: u.name, code: u.code,
      latitude: u.latitude, longitude: u.longitude,
      radius_meters: u.radius_meters, address: u.address || '',
      contract_id: u.contract_id || '',
    });
    setEditUnitId(u.id);
    setUnitModal('form');
  }

  function closeUnitModal() {
    setUnitModal(null);
    setUnitForm(EMPTY_UNIT);
    setEditUnitId(null);
  }

  async function handleContractSubmit(e) {
    e.preventDefault();
    if (editContractId) {
      updateContract.mutate({ id: editContractId, body: contractForm });
    } else {
      createContract.mutate(contractForm);
    }
  }

  async function handleUnitSubmit(e) {
    e.preventDefault();
    const body = {
      ...unitForm,
      radius_meters: parseInt(unitForm.radius_meters, 10),
      contract_id: unitForm.contract_id || null,
    };
    if (editUnitId) {
      updateUnit.mutate({ id: editUnitId, body });
    } else {
      createUnit.mutate(body);
    }
  }

  function toggleExpand(id) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  const contracts = data?.contracts || [];
  const unassigned = data?.unassigned || [];
  const isSavingContract = createContract.isLoading || updateContract.isLoading;
  const isSavingUnit = createUnit.isLoading || updateUnit.isLoading;

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Contratos</h1>
          <p style={styles.subtitle}>Gerencie contratos e seus postos de trabalho.</p>
        </div>
        <button onClick={openCreateContract} style={styles.primaryBtn}>+ Novo Contrato</button>
      </div>

      {isLoading ? (
        <p style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contracts.map((c) => (
            <div key={c.id} style={styles.contractCard}>
              {/* Cabeçalho do contrato */}
              <div style={styles.contractHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <button
                    onClick={() => toggleExpand(c.id)}
                    style={styles.expandBtn}
                  >
                    {expanded[c.id] ? '▾' : '▸'}
                  </button>
                  <span style={styles.contractCode}>{c.code}</span>
                  <div>
                    <div style={styles.contractName}>{c.name}</div>
                    {c.description && <div style={styles.contractDesc}>{c.description}</div>}
                  </div>
                  <span style={{
                    ...styles.badge,
                    background: c.active ? '#dcfce7' : '#f1f5f9',
                    color: c.active ? '#166534' : '#64748b',
                  }}>
                    {c.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span style={styles.unitCount}>{c.units.length} posto{c.units.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openCreateUnit(c.id)} style={styles.outlineBtn}>+ Posto</button>
                  <button onClick={() => openEditContract(c)} style={styles.outlineBtn}>Editar</button>
                  {c.active && (
                    <button onClick={() => deactivateContract.mutate(c.id)} style={styles.dangerBtn}>Desativar</button>
                  )}
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir o contrato "${c.name}" permanentemente?\n\nIsso irá remover o contrato do banco de dados. Os postos vinculados perderão o vínculo.`))
                        destroyContract.mutate(c.id);
                    }}
                    style={{ ...styles.dangerBtn, background: '#fee2e2' }}>
                    Excluir
                  </button>
                </div>
              </div>

              {/* Lista de postos */}
              {expanded[c.id] && (
                <div style={styles.unitsList}>
                  {c.units.length === 0 ? (
                    <p style={styles.emptyUnits}>Nenhum posto neste contrato. <button onClick={() => openCreateUnit(c.id)} style={styles.linkBtn}>Adicionar posto</button></p>
                  ) : (
                    c.units.map((u) => (
                      <div key={u.id} style={styles.unitRow}>
                        <span style={styles.unitCode}>{u.code}</span>
                        <div style={{ flex: 1 }}>
                          <div style={styles.unitName}>{u.name}</div>
                          {u.address && <div style={styles.unitAddress}>{u.address}</div>}
                        </div>
                        <span style={styles.unitRadius}>{u.radius_meters}m</span>
                        <a
                          href={`https://maps.google.com/?q=${u.latitude},${u.longitude}`}
                          target="_blank" rel="noreferrer"
                          style={styles.mapLink}
                        >
                          Mapa ↗
                        </a>
                        <button onClick={() => openEditUnit(u)} style={styles.outlineBtn}>Editar</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Postos sem contrato */}
          {unassigned.length > 0 && (
            <div style={{ ...styles.contractCard, borderColor: '#fbbf24' }}>
              <div style={styles.contractHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <button onClick={() => toggleExpand('unassigned')} style={styles.expandBtn}>
                    {expanded['unassigned'] ? '▾' : '▸'}
                  </button>
                  <div style={{ ...styles.contractName, color: '#92400e' }}>Postos sem contrato</div>
                  <span style={styles.unitCount}>{unassigned.length} posto{unassigned.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              {expanded['unassigned'] && (
                <div style={styles.unitsList}>
                  {unassigned.map((u) => (
                    <div key={u.id} style={styles.unitRow}>
                      <span style={styles.unitCode}>{u.code}</span>
                      <div style={{ flex: 1 }}>
                        <div style={styles.unitName}>{u.name}</div>
                        {u.address && <div style={styles.unitAddress}>{u.address}</div>}
                      </div>
                      <span style={styles.unitRadius}>{u.radius_meters}m</span>
                      <button onClick={() => openEditUnit(u)} style={styles.outlineBtn}>Editar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {contracts.length === 0 && unassigned.length === 0 && (
            <div style={styles.emptyState}>
              <p>Nenhum contrato cadastrado.</p>
              <button onClick={openCreateContract} style={styles.primaryBtn}>+ Criar primeiro contrato</button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Contrato */}
      {contractModal === 'form' && (
        <div style={overlay} onClick={closeContractModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>{editContractId ? 'Editar Contrato' : 'Novo Contrato'}</h2>
            <form onSubmit={handleContractSubmit} style={formStyle}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Nome *</label>
                <input value={contractForm.name} onChange={(e) => setContractForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Nome do contrato" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Código *</label>
                <input value={contractForm.code} onChange={(e) => setContractForm((p) => ({ ...p, code: e.target.value }))} required placeholder="CONT001" style={inputStyle} />
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Descrição</label>
                <textarea value={contractForm.description} onChange={(e) => setContractForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição opcional" style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }} />
              </div>
              <div style={modalActions}>
                <button type="button" onClick={closeContractModal} style={styles.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={isSavingContract} style={{ ...styles.primaryBtn, opacity: isSavingContract ? 0.7 : 1 }}>
                  {isSavingContract ? 'Salvando...' : editContractId ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Posto */}
      {unitModal === 'form' && (
        <div style={overlay} onClick={closeUnitModal}>
          <div style={{ ...modalCard, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>{editUnitId ? 'Editar Posto' : 'Novo Posto'}</h2>
            <form onSubmit={handleUnitSubmit} style={formStyle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Nome *</label>
                  <input value={unitForm.name} onChange={(e) => setUnitForm((p) => ({ ...p, name: e.target.value }))} required placeholder="Nome do posto" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Código *</label>
                  <input value={unitForm.code} onChange={(e) => setUnitForm((p) => ({ ...p, code: e.target.value }))} required placeholder="POSTO001" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Latitude *</label>
                  <input value={unitForm.latitude} onChange={(e) => setUnitForm((p) => ({ ...p, latitude: e.target.value }))} required placeholder="-23.5505" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Longitude *</label>
                  <input value={unitForm.longitude} onChange={(e) => setUnitForm((p) => ({ ...p, longitude: e.target.value }))} required placeholder="-46.6333" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Raio (metros)</label>
                  <input type="number" value={unitForm.radius_meters} onChange={(e) => setUnitForm((p) => ({ ...p, radius_meters: e.target.value }))} min="10" style={inputStyle} />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Contrato</label>
                  <select value={unitForm.contract_id} onChange={(e) => setUnitForm((p) => ({ ...p, contract_id: e.target.value }))} style={inputStyle}>
                    <option value="">Sem contrato</option>
                    {(data?.contracts || []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={fieldStyle}>
                <label style={labelStyle}>Endereço</label>
                <input value={unitForm.address} onChange={(e) => setUnitForm((p) => ({ ...p, address: e.target.value }))} placeholder="Endereço completo" style={inputStyle} />
              </div>
              <div style={modalActions}>
                <button type="button" onClick={closeUnitModal} style={styles.outlineBtn}>Cancelar</button>
                <button type="submit" disabled={isSavingUnit} style={{ ...styles.primaryBtn, opacity: isSavingUnit ? 0.7 : 1 }}>
                  {isSavingUnit ? 'Salvando...' : editUnitId ? 'Salvar' : 'Criar Posto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
};
const modalCard = {
  background: '#fff', borderRadius: 12, padding: '28px 24px',
  width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  maxHeight: '90vh', overflowY: 'auto',
};
const modalTitle = { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 20 };
const formStyle  = { display: 'flex', flexDirection: 'column', gap: 14 };
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 5 };
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#374151' };
const inputStyle = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none' };
const modalActions = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 };

const styles = {
  header:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' },
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b' },
  contractCard: {
    background: '#fff', borderRadius: 12,
    border: '1px solid #e2e8f0', overflow: 'hidden',
  },
  contractHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', flexWrap: 'wrap', gap: 10,
  },
  expandBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 18, color: '#64748b', padding: '0 4px',
  },
  contractCode: {
    fontSize: 11, fontWeight: 700, color: '#1d4ed8',
    background: '#eff6ff', padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
  },
  contractName: { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  contractDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' },
  unitCount: { fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' },
  unitsList: { borderTop: '1px solid #f1f5f9', padding: '8px 0' },
  unitRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 20px 10px 52px', flexWrap: 'wrap',
  },
  unitCode: {
    fontSize: 11, fontWeight: 700, color: '#475569',
    background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
  },
  unitName:    { fontSize: 13, fontWeight: 600, color: '#0f172a' },
  unitAddress: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  unitRadius:  { fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' },
  mapLink:     { fontSize: 12, color: '#1d4ed8', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' },
  emptyUnits:  { padding: '12px 20px 12px 52px', fontSize: 13, color: '#94a3b8' },
  emptyState:  { textAlign: 'center', padding: '60px 20px', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  primaryBtn: {
    padding: '8px 16px', border: 'none', borderRadius: 8,
    fontSize: 14, cursor: 'pointer', color: '#fff', background: '#1d4ed8', fontWeight: 600,
  },
  outlineBtn: {
    padding: '6px 12px', border: '1.5px solid #1d4ed8', borderRadius: 8,
    fontSize: 13, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600,
  },
  dangerBtn: {
    padding: '6px 12px', border: '1.5px solid #dc2626', borderRadius: 8,
    fontSize: 13, cursor: 'pointer', color: '#dc2626', background: '#fff', fontWeight: 600,
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#1d4ed8',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0,
  },
};
