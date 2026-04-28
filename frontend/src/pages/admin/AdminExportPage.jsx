import { useState, useEffect, useRef } from 'react';
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

const STEPS_SVC = [
  { label: 'Consultando serviços no banco...', duration: 1500 },
  { label: 'Carregando fotos do servidor...', duration: 6000 },
  { label: 'Obtendo endereços GPS...', duration: 4000 },
  { label: 'Montando páginas do PDF...', duration: 3000 },
  { label: 'Finalizando download...', duration: 99999 },
];

function PdfProgressModal({ visible }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [dots, setDots]       = useState('');
  const timerRef = useRef(null);
  const dotsRef  = useRef(null);

  useEffect(() => {
    if (!visible) { setStepIdx(0); setDots(''); return; }

    let idx = 0;
    function advance() {
      if (idx < STEPS_SVC.length - 1) {
        timerRef.current = setTimeout(() => { idx++; setStepIdx(idx); advance(); }, STEPS_SVC[idx].duration);
      }
    }
    advance();

    dotsRef.current = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 500);

    return () => { clearTimeout(timerRef.current); clearInterval(dotsRef.current); };
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '36px 40px', minWidth: 320, maxWidth: 420, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Spinner */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <svg width={48} height={48} viewBox="0 0 48 48" style={{ animation: 'spin 1s linear infinite' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-line)" strokeWidth="4" />
            <path d="M24 4 a20 20 0 0 1 20 20" fill="none" stroke="#7c3aed" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 8px' }}>Gerando PDF de Serviços</p>
        <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0, minHeight: 20 }}>
          {STEPS_SVC[stepIdx].label}{dots}
        </p>

        {/* Barra de progresso */}
        <div style={{ marginTop: 20, background: 'var(--color-line)', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: '#7c3aed',
            borderRadius: 99,
            width: `${Math.round(((stepIdx + 1) / STEPS_SVC.length) * 100)}%`,
            transition: 'width 0.6s ease',
          }} />
        </div>

        <p style={{ marginTop: 10, fontSize: 11, color: 'var(--color-muted)' }}>
          Etapa {stepIdx + 1} de {STEPS_SVC.length}
        </p>
      </div>
    </div>
  );
}

const ICON_FILE_TEXT = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8';
const ICON_GRID      = 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z';
const ICON_CLIPBOARD = 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z';
const ICON_DOWNLOAD  = 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3';
const ICON_WORD      = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13l2 4 2-4 2 4 2-4';
const ICON_TABLE     = 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18';

function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}
function useEmployees() {
  return useQuery({ queryKey: ['employees-all'], queryFn: () => api.get('/employees', { params: { limit: 999 } }).then((r) => r.data.employees) });
}

const EXPORT_CARDS = [
  { key: 'pdf',      icon: ICON_FILE_TEXT, iconColor: '#ef4444', bg: 'rgba(239,68,68,0.08)',   title: 'Cartão de Ponto (PDF)',          desc: 'Gera o cartão de ponto mensal do funcionário com tabela de horários por dia.', adminOnly: true },
  { key: 'xls',      icon: ICON_GRID,      iconColor: '#059669', bg: 'rgba(16,185,129,0.08)',  title: 'Auditoria Bruta (Excel)',         desc: 'Exporta todas as batidas com colunas completas: UTC, local, coordenadas, motivo de bloqueio.', adminOnly: true },
  { key: 'svc',      icon: ICON_CLIPBOARD, iconColor: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  title: 'Relatório de Serviços (PDF)',     desc: 'Exporta as ordens de serviço do período com status, horários de início/conclusão e fotos antes/depois.', adminOnly: false },
  { key: 'svc-docx', icon: ICON_WORD,      iconColor: '#2563eb', bg: 'rgba(37,99,235,0.08)',   title: 'Relatório de Serviços (Word)',    desc: 'Mesmo relatório em formato .docx editável, com fotos antes/depois incorporadas.', adminOnly: false },
  { key: 'svc-xls',  icon: ICON_TABLE,     iconColor: '#0891b2', bg: 'rgba(8,145,178,0.08)',   title: 'Serviços (Excel)',                desc: 'Exporta todas as ordens de serviço com todos os campos em planilha, sem fotos.', adminOnly: false },
];

export default function AdminExportPage() {
  const { error } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: units = []     } = useUnits();
  const { data: employees = [] } = useEmployees();

  const [pdfForm, setPdfForm] = useState({ employeeId: '', month: '', year: new Date().getFullYear() });
  const [xlsForm, setXlsForm] = useState({ unitId: '', startDate: '', endDate: '' });
  const [svcForm,     setSvcForm]     = useState({ filterType: 'employee', employeeId: '', unitId: '', startDate: '', endDate: '' });
  const [svcDocxForm, setSvcDocxForm] = useState({ filterType: 'employee', employeeId: '', unitId: '', startDate: '', endDate: '' });
  const [svcXlsForm,  setSvcXlsForm]  = useState({ filterType: 'employee', employeeId: '', unitId: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState({ pdf: false, xls: false, svc: false, svcDocx: false, svcXls: false });

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

  async function exportServicesDocx() {
    if (!svcDocxForm.startDate || !svcDocxForm.endDate) return error('Selecione o intervalo de datas.');
    if (svcDocxForm.filterType === 'employee' && !svcDocxForm.employeeId) return error('Selecione o funcionário.');
    if (svcDocxForm.filterType === 'unit' && !svcDocxForm.unitId) return error('Selecione a unidade.');
    setLoading((p) => ({ ...p, svcDocx: true }));
    try {
      const params = { startDate: svcDocxForm.startDate, endDate: svcDocxForm.endDate };
      if (svcDocxForm.filterType === 'employee') params.employeeId = svcDocxForm.employeeId;
      else params.unitId = svcDocxForm.unitId;
      const res = await api.get('/admin/export/services/docx', { params, responseType: 'blob' });
      download(res.data, `servicos_${svcDocxForm.startDate}_${svcDocxForm.endDate}.docx`);
    } catch (err) {
      try { const t = await err.response?.data?.text?.(); const j = JSON.parse(t); error(j.error || 'Erro ao gerar Word.'); }
      catch { error('Erro ao gerar Word de serviços. Tente novamente.'); }
    } finally { setLoading((p) => ({ ...p, svcDocx: false })); }
  }

  async function exportServicesXls() {
    if (!svcXlsForm.startDate || !svcXlsForm.endDate) return error('Selecione o intervalo de datas.');
    if (svcXlsForm.filterType === 'employee' && !svcXlsForm.employeeId) return error('Selecione o funcionário.');
    if (svcXlsForm.filterType === 'unit' && !svcXlsForm.unitId) return error('Selecione a unidade.');
    setLoading((p) => ({ ...p, svcXls: true }));
    try {
      const params = { startDate: svcXlsForm.startDate, endDate: svcXlsForm.endDate };
      if (svcXlsForm.filterType === 'employee') params.employeeId = svcXlsForm.employeeId;
      else params.unitId = svcXlsForm.unitId;
      const res = await api.get('/admin/export/services/excel', { params, responseType: 'blob' });
      download(res.data, `servicos_${svcXlsForm.startDate}_${svcXlsForm.endDate}.xlsx`);
    } catch (err) {
      try { const t = await err.response?.data?.text?.(); const j = JSON.parse(t); error(j.error || 'Erro ao gerar Excel.'); }
      catch { error('Erro ao gerar Excel de serviços. Tente novamente.'); }
    } finally { setLoading((p) => ({ ...p, svcXls: false })); }
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
      <PdfProgressModal visible={loading.svc || loading.svcDocx} />
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
                loading={loading.svc} onExport={exportServicesPdf} label="Gerar PDF de Serviços" loadLabel="Aguarde..." bg="#7c3aed" />
            )}
            {card.key === 'svc-docx' && (
              <ExportSvcForm form={svcDocxForm} setForm={setSvcDocxForm} employees={employees} units={units}
                loading={loading.svcDocx} onExport={exportServicesDocx} label="Gerar Word de Serviços" loadLabel="Gerando Word..." bg="#2563eb" />
            )}
            {card.key === 'svc-xls' && (
              <ExportSvcForm form={svcXlsForm} setForm={setSvcXlsForm} employees={employees} units={units}
                loading={loading.svcXls} onExport={exportServicesXls} label="Gerar Excel de Serviços" loadLabel="Gerando Excel..." bg="#0891b2" />
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

function ExportSvcForm({ form, setForm, employees, units, loading, onExport, label = 'Gerar PDF de Serviços', loadLabel = 'Aguarde...', bg = '#7c3aed' }) {
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
      <ExportBtn loading={loading} onExport={onExport} label={label} loadLabel={loadLabel} bg={bg} />
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
