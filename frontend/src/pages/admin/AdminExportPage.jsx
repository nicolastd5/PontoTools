import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import api           from '../../services/api';
import { useToast }  from '../../contexts/ToastContext';
import { useAuth }   from '../../contexts/AuthContext';

function Icon({ d, size = 16, color = 'currentColor', strokeWidth = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const ICON_FILE_TEXT = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8';
const ICON_GRID      = 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z';
const ICON_CLIPBOARD = 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z';
const ICON_DOWNLOAD  = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3';

function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}
function useEmployees() {
  return useQuery({ queryKey: ['employees-all'], queryFn: () => api.get('/employees', { params: { limit: 999 } }).then((r) => r.data.employees) });
}

const EXPORT_CARDS = [
  { key: 'pdf',      icon: ICON_FILE_TEXT, iconColor: '#ef4444', bg: 'rgba(239,68,68,0.08)',  title: 'Cartão de Ponto (PDF)',       desc: 'Gera o cartão de ponto mensal do funcionário com tabela de horários por dia.', adminOnly: true },
  { key: 'xls',      icon: ICON_GRID,      iconColor: '#059669', bg: 'rgba(16,185,129,0.08)', title: 'Auditoria Bruta (Excel)',      desc: 'Exporta todas as batidas com colunas completas: UTC, local, coordenadas, motivo de bloqueio.', adminOnly: true },
  { key: 'svc',      icon: ICON_CLIPBOARD, iconColor: '#7c3aed', bg: 'rgba(124,58,237,0.08)', title: 'Relatório de Serviços (PDF)',  desc: 'Exporta as ordens de serviço do período com status, horários de início/conclusão e fotos antes/depois.', adminOnly: false },
];

export default function AdminExportPage() {
  const { error } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: units = []     } = useUnits();
  const { data: employees = [] } = useEmployees();

  const [pdfForm, setPdfForm] = useState({ employeeId: '', month: '', year: new Date().getFullYear() });
  const [xlsForm, setXlsForm] = useState({ unitId: '', startDate: '', endDate: '' });
  const [svcForm, setSvcForm] = useState({ filterType: 'employee', employeeId: '', unitId: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState({ pdf: false, xls: false, svc: false });

  async function exportPdf() {
    if (!pdfForm.employeeId || !pdfForm.month) return error('Selecione funcionário e mês.');
    setLoading((p) => ({ ...p, pdf: true }));
    try {
      const res = await api.get('/admin/export/pdf', { params: { employeeId: pdfForm.employeeId, month: pdfForm.month, year: pdfForm.year }, responseType: 'blob' });
      download(res.data, `cartao_ponto_${pdfForm.month}_${pdfForm.year}.pdf`);
    } catch { error('Erro ao gerar PDF. Tente novamente.'); }
    finally { setLoading((p) => ({ ...p, pdf: false })); }
  }

  async function exportExcel() {
    if (!xlsForm.startDate || !xlsForm.endDate) return error('Selecione o intervalo de datas.');
    setLoading((p) => ({ ...p, xls: true }));
    try {
      const res = await api.get('/admin/export/excel', { params: { unitId: xlsForm.unitId || undefined, startDate: xlsForm.startDate, endDate: xlsForm.endDate }, responseType: 'blob' });
      download(res.data, `auditoria_${xlsForm.startDate}_${xlsForm.endDate}.xlsx`);
    } catch { error('Erro ao gerar Excel. Tente novamente.'); }
    finally { setLoading((p) => ({ ...p, xls: false })); }
  }

  async function exportServicesPdf() {
    if (!svcForm.startDate || !svcForm.endDate) return error('Selecione o intervalo de datas.');
    if (svcForm.filterType === 'employee' && !svcForm.employeeId) return error('Selecione o funcionário.');
    if (svcForm.filterType === 'unit' && !svcForm.unitId) return error('Selecione a unidade.');
    setLoading((p) => ({ ...p, svc: true }));
    try {
      const params = { startDate: svcForm.startDate, endDate: svcForm.endDate };
      if (svcForm.filterType === 'employee') params.employeeId = svcForm.employeeId;
      else params.unitId = svcForm.unitId;
      const res = await api.get('/admin/export/services/pdf', { params, responseType: 'blob' });
      download(res.data, `servicos_${svcForm.startDate}_${svcForm.endDate}.pdf`);
    } catch (err) {
      try { const t = await err.response?.data?.text?.(); const j = JSON.parse(t); error(j.error || 'Erro ao gerar PDF.'); }
      catch { error('Erro ao gerar PDF de serviços. Tente novamente.'); }
    } finally { setLoading((p) => ({ ...p, svc: false })); }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const months = [
    ['01','Janeiro'], ['02','Fevereiro'], ['03','Março'],
    ['04','Abril'],   ['05','Maio'],      ['06','Junho'],
    ['07','Julho'],   ['08','Agosto'],    ['09','Setembro'],
    ['10','Outubro'], ['11','Novembro'],  ['12','Dezembro'],
  ];

  const visibleCards = EXPORT_CARDS.filter((c) => isAdmin || !c.adminOnly);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-ink)', margin: '0 0 24px', letterSpacing: '-0.03em' }}>Exportar Dados</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {visibleCards.map((card) => (
          <div key={card.key} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--color-line)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
            {/* Icon badge */}
            <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Icon d={card.icon} size={22} color={card.iconColor} strokeWidth={1.6} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{card.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20, lineHeight: 1.6, flex: 1 }}>{card.desc}</p>

            {card.key === 'pdf' && (
              <ExportPdfForm form={pdfForm} setForm={setPdfForm} employees={employees} months={months}
                loading={loading.pdf} onExport={exportPdf} />
            )}
            {card.key === 'xls' && (
              <ExportXlsForm form={xlsForm} setForm={setXlsForm} units={units}
                loading={loading.xls} onExport={exportExcel} />
            )}
            {card.key === 'svc' && (
              <ExportSvcForm form={svcForm} setForm={setSvcForm} employees={employees} units={units}
                loading={loading.svc} onExport={exportServicesPdf} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportPdfForm({ form, setForm, employees, months, loading, onExport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Funcionário">
        <select value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} style={selectStyle}>
          <option value="">Selecione...</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.badge_number})</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Mês">
            <select value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))} style={selectStyle}>
              <option value="">Selecione...</option>
              {months.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label="Ano">
            <input type="number" min="2020" max="2099" value={form.year}
              onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} style={inputStyle} />
          </Field>
        </div>
      </div>
      <ExportBtn loading={loading} onExport={onExport} label="Gerar PDF" loadLabel="Gerando PDF..." bg="#ef4444" />
    </div>
  );
}

function ExportXlsForm({ form, setForm, units, loading, onExport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Unidade (opcional)">
        <select value={form.unitId} onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))} style={selectStyle}>
          <option value="">Todas as unidades</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: 10 }}>
        <Field label="Data início" style={{ flex: 1 }}>
          <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
        </Field>
        <Field label="Data fim" style={{ flex: 1 }}>
          <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} style={inputStyle} />
        </Field>
      </div>
      <ExportBtn loading={loading} onExport={onExport} label="Gerar Excel" loadLabel="Gerando Excel..." bg="#059669" />
    </div>
  );
}

function ExportSvcForm({ form, setForm, employees, units, loading, onExport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="Filtrar por">
        <select value={form.filterType} onChange={(e) => setForm((p) => ({ ...p, filterType: e.target.value, employeeId: '', unitId: '' }))} style={selectStyle}>
          <option value="employee">Funcionário</option>
          <option value="unit">Unidade</option>
        </select>
      </Field>
      {form.filterType === 'employee' ? (
        <Field label="Funcionário">
          <select value={form.employeeId} onChange={(e) => setForm((p) => ({ ...p, employeeId: e.target.value }))} style={selectStyle}>
            <option value="">Selecione...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name} ({e.badge_number})</option>)}
          </select>
        </Field>
      ) : (
        <Field label="Unidade">
          <select value={form.unitId} onChange={(e) => setForm((p) => ({ ...p, unitId: e.target.value }))} style={selectStyle}>
            <option value="">Selecione...</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Data início">
            <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} style={inputStyle} />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Data fim">
            <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} style={inputStyle} />
          </Field>
        </div>
      </div>
      <ExportBtn loading={loading} onExport={onExport} label="Gerar PDF de Serviços" loadLabel="Gerando PDF..." bg="#7c3aed" />
    </div>
  );
}

function ExportBtn({ loading, onExport, label, loadLabel, bg }) {
  return (
    <button onClick={onExport} disabled={loading} style={{ marginTop: 6, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', background: loading ? 'var(--color-subtle)' : bg, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
      {!loading && (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
        </svg>
      )}
      {loading ? loadLabel : label}
    </button>
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

const selectStyle = { padding: '9px 12px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, color: 'var(--color-ink)', background: 'var(--bg-card)', outline: 'none', width: '100%' };
const inputStyle  = { padding: '9px 12px', border: '1.5px solid var(--color-line)', borderRadius: 8, fontSize: 13, color: 'var(--color-ink)', background: 'var(--bg-card)', outline: 'none', width: '100%', boxSizing: 'border-box' };
