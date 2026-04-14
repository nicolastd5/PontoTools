import { useState }  from 'react';
import { useQuery }  from '@tanstack/react-query';
import api           from '../../services/api';
import { useToast }  from '../../contexts/ToastContext';

function useUnits() {
  return useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then((r) => r.data.units) });
}

function useEmployees() {
  return useQuery({ queryKey: ['employees-all'], queryFn: () => api.get('/employees', { params: { limit: 999 } }).then((r) => r.data.employees) });
}

export default function AdminExportPage() {
  const { error } = useToast();
  const { data: units = []     } = useUnits();
  const { data: employees = [] } = useEmployees();

  // Estado do form PDF
  const [pdfForm, setPdfForm] = useState({ employeeId: '', month: '', year: new Date().getFullYear() });
  // Estado do form Excel
  const [xlsForm, setXlsForm] = useState({ unitId: '', startDate: '', endDate: '' });
  const [svcForm, setSvcForm] = useState({ filterType: 'employee', employeeId: '', unitId: '', startDate: '', endDate: '' });

  async function exportPdf() {
    if (!pdfForm.employeeId || !pdfForm.month) {
      return error('Selecione funcionário e mês.');
    }
    try {
      const res = await api.get('/admin/export/pdf', {
        params:       { employeeId: pdfForm.employeeId, month: pdfForm.month, year: pdfForm.year },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `cartao_ponto_${pdfForm.month}_${pdfForm.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      error('Erro ao gerar PDF. Tente novamente.');
    }
  }

  async function exportExcel() {
    if (!xlsForm.startDate || !xlsForm.endDate) {
      return error('Selecione o intervalo de datas.');
    }
    try {
      const res = await api.get('/admin/export/excel', {
        params:       { unitId: xlsForm.unitId || undefined, startDate: xlsForm.startDate, endDate: xlsForm.endDate },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${xlsForm.startDate}_${xlsForm.endDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      error('Erro ao gerar Excel. Tente novamente.');
    }
  }

  async function exportServicesPdf() {
    if (!svcForm.startDate || !svcForm.endDate) {
      return error('Selecione o intervalo de datas.');
    }
    if (svcForm.filterType === 'employee' && !svcForm.employeeId) {
      return error('Selecione o funcionário.');
    }
    if (svcForm.filterType === 'unit' && !svcForm.unitId) {
      return error('Selecione a unidade.');
    }
    try {
      const params = { startDate: svcForm.startDate, endDate: svcForm.endDate };
      if (svcForm.filterType === 'employee') params.employeeId = svcForm.employeeId;
      else params.unitId = svcForm.unitId;

      const res = await api.get('/admin/export/services/pdf', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `servicos_${svcForm.startDate}_${svcForm.endDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      error('Erro ao gerar PDF de serviços. Tente novamente.');
    }
  }

  const months = [
    ['01','Janeiro'], ['02','Fevereiro'], ['03','Março'],
    ['04','Abril'],   ['05','Maio'],      ['06','Junho'],
    ['07','Julho'],   ['08','Agosto'],    ['09','Setembro'],
    ['10','Outubro'], ['11','Novembro'],  ['12','Dezembro'],
  ];

  return (
    <div>
      <h1 style={styles.title}>Exportar Dados</h1>

      <div style={styles.grid}>
        {/* PDF — Cartão de Ponto */}
        <div style={styles.card}>
          <div style={styles.cardIcon}>📄</div>
          <h2 style={styles.cardTitle}>Cartão de Ponto (PDF)</h2>
          <p style={styles.cardDesc}>
            Gera o cartão de ponto mensal do funcionário com tabela de horários por dia.
          </p>

          <div style={styles.field}>
            <label style={styles.label}>Funcionário</label>
            <select
              value={pdfForm.employeeId}
              onChange={(e) => setPdfForm((p) => ({ ...p, employeeId: e.target.value }))}
              style={styles.select}
            >
              <option value="">Selecione...</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.badge_number})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Mês</label>
              <select
                value={pdfForm.month}
                onChange={(e) => setPdfForm((p) => ({ ...p, month: e.target.value }))}
                style={styles.select}
              >
                <option value="">Selecione...</option>
                {months.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div style={{ ...styles.field, width: 90 }}>
              <label style={styles.label}>Ano</label>
              <input
                type="number" min="2020" max="2099"
                value={pdfForm.year}
                onChange={(e) => setPdfForm((p) => ({ ...p, year: e.target.value }))}
                style={styles.input}
              />
            </div>
          </div>

          <button onClick={exportPdf} style={styles.btn}>
            Gerar PDF
          </button>
        </div>

        {/* Excel — Auditoria bruta */}
        <div style={styles.card}>
          <div style={styles.cardIcon}>📊</div>
          <h2 style={styles.cardTitle}>Auditoria Bruta (Excel)</h2>
          <p style={styles.cardDesc}>
            Exporta todas as batidas com colunas completas: UTC, local, coordenadas, motivo de bloqueio.
          </p>

          <div style={styles.field}>
            <label style={styles.label}>Unidade (opcional)</label>
            <select
              value={xlsForm.unitId}
              onChange={(e) => setXlsForm((p) => ({ ...p, unitId: e.target.value }))}
              style={styles.select}
            >
              <option value="">Todas as unidades</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Data início</label>
              <input
                type="date" value={xlsForm.startDate}
                onChange={(e) => setXlsForm((p) => ({ ...p, startDate: e.target.value }))}
                style={styles.input}
              />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Data fim</label>
              <input
                type="date" value={xlsForm.endDate}
                onChange={(e) => setXlsForm((p) => ({ ...p, endDate: e.target.value }))}
                style={styles.input}
              />
            </div>
          </div>

          <button onClick={exportExcel} style={{ ...styles.btn, background: '#16a34a' }}>
            Gerar Excel
          </button>
        </div>

        {/* PDF — Relatório de Serviços */}
        <div style={styles.card}>
          <div style={styles.cardIcon}>📋</div>
          <h2 style={styles.cardTitle}>Relatório de Serviços (PDF)</h2>
          <p style={styles.cardDesc}>
            Exporta os serviços (turnos completos) com fotos de entrada e saída de cada funcionário.
          </p>

          <div style={styles.field}>
            <label style={styles.label}>Filtrar por</label>
            <select
              value={svcForm.filterType}
              onChange={(e) => setSvcForm((p) => ({ ...p, filterType: e.target.value, employeeId: '', unitId: '' }))}
              style={styles.select}
            >
              <option value="employee">Funcionário</option>
              <option value="unit">Unidade</option>
            </select>
          </div>

          {svcForm.filterType === 'employee' ? (
            <div style={styles.field}>
              <label style={styles.label}>Funcionário</label>
              <select
                value={svcForm.employeeId}
                onChange={(e) => setSvcForm((p) => ({ ...p, employeeId: e.target.value }))}
                style={styles.select}
              >
                <option value="">Selecione...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name} ({e.badge_number})</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={styles.field}>
              <label style={styles.label}>Unidade</label>
              <select
                value={svcForm.unitId}
                onChange={(e) => setSvcForm((p) => ({ ...p, unitId: e.target.value }))}
                style={styles.select}
              >
                <option value="">Selecione...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Data início</label>
              <input type="date" value={svcForm.startDate}
                onChange={(e) => setSvcForm((p) => ({ ...p, startDate: e.target.value }))}
                style={styles.input} />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Data fim</label>
              <input type="date" value={svcForm.endDate}
                onChange={(e) => setSvcForm((p) => ({ ...p, endDate: e.target.value }))}
                style={styles.input} />
            </div>
          </div>

          <button onClick={exportServicesPdf} style={{ ...styles.btn, background: '#7c3aed' }}>
            Gerar PDF de Serviços
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  title:    { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 24 },
  grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 },
  card:     { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '28px 28px' },
  cardIcon: { fontSize: 32, marginBottom: 12 },
  cardTitle:{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#64748b', marginBottom: 20, lineHeight: 1.6 },
  field:    { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  label:    { fontSize: 13, fontWeight: 600, color: '#374151' },
  select: {
    padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', outline: 'none',
  },
  input: {
    padding: '9px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#374151', outline: 'none',
  },
  btn: {
    marginTop: 8, width: '100%',
    padding: '11px', background: '#1d4ed8',
    border: 'none', borderRadius: 8,
    color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};
