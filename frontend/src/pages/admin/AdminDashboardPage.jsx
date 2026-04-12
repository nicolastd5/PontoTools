import { useState }          from 'react';
import { useQuery }          from '@tanstack/react-query';
import { useNavigate }       from 'react-router-dom';
import api                   from '../../services/api';
import ClocksByUnitChart     from '../../components/admin/ClocksByUnitChart';
import RecentClocksTable     from '../../components/admin/RecentClocksTable';
import AbsentEmployeesList   from '../../components/admin/AbsentEmployeesList';

function useDashboard(unitId) {
  return useQuery({
    queryKey:  ['dashboard', unitId],
    queryFn:   () => api.get('/admin/dashboard', { params: unitId ? { unitId } : {} }).then((r) => r.data),
    refetchInterval: 60 * 1000,
  });
}

function useAbsences(unitId) {
  return useQuery({
    queryKey: ['absences', unitId],
    queryFn:  () => api.get('/admin/dashboard/absences', { params: unitId ? { unitId } : {} }).then((r) => r.data),
    refetchInterval: 60 * 1000,
  });
}

function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn:  () => api.get('/units').then((r) => r.data.units),
  });
}

const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'Com ressalvas',
  problem:          'Problema',
};
const STATUS_COLOR = {
  pending:          { bg: '#f1f5f9', color: '#475569' },
  in_progress:      { bg: '#dbeafe', color: '#1d4ed8' },
  done:             { bg: '#dcfce7', color: '#16a34a' },
  done_with_issues: { bg: '#fef9c3', color: '#854d0e' },
  problem:          { bg: '#fee2e2', color: '#dc2626' },
};

export default function AdminDashboardPage() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const navigate = useNavigate();
  const unitId = selectedUnit ? parseInt(selectedUnit, 10) : null;

  const { data: dashData,  isLoading: loadingDash }    = useDashboard(unitId);
  const { data: absentData, isLoading: loadingAbsent } = useAbsences(unitId);
  const { data: units = [] } = useUnits();

  const now = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const summary  = dashData?.summary  || {};
  const services = dashData?.services || {};

  return (
    <div>
      {/* Cabeçalho */}
      <div style={st.header}>
        <div>
          <h1 style={st.pageTitle}>Dashboard</h1>
          <p style={st.pageDate}>{now}</p>
        </div>
        <div style={st.headerRight}>
          <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} style={st.select}>
            <option value="">Todas as unidades</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button onClick={() => window.location.reload()} style={st.refreshBtn} title="Atualizar">↻</button>
        </div>
      </div>

      {/* ── Seção: Ponto ── */}
      <SectionTitle label="Ponto Eletrônico" icon="🕐" />
      <div style={st.statsGrid}>
        <StatCard label="Batidas hoje"          value={summary.totalClocks    ?? 0} icon="🕐" color="#1d4ed8" bg="#eff6ff" loading={loadingDash} />
        <StatCard label="Presentes hoje"        value={summary.activeToday    ?? 0} icon="✅" color="#16a34a" bg="#f0fdf4" loading={loadingDash} />
        <StatCard label="Sem registro hoje"     value={summary.absentToday    ?? 0} icon="⚠️" color="#d97706" bg="#fffbeb" loading={loadingDash}
          onClick={() => navigate('/admin/clocks')} />
        <StatCard label="Bloqueios hoje"        value={summary.totalBlocked   ?? 0} icon="⛔" color="#dc2626" bg="#fef2f2" loading={loadingDash}
          onClick={() => navigate('/admin/blocked')} />
        <StatCard label="Total funcionários"    value={summary.totalEmployees ?? 0} icon="👤" color="#7c3aed" bg="#f5f3ff" loading={loadingDash}
          onClick={() => navigate('/admin/employees')} />
      </div>

      {/* ── Seção: Serviços ── */}
      <SectionTitle label="Ordens de Serviço" icon="🔧" action={{ label: 'Ver todos', onClick: () => navigate('/admin/services') }} />
      <div style={st.statsGrid}>
        <StatCard label="Pendentes"      value={services.pending      ?? 0} icon="🕐" color="#475569" bg="#f1f5f9" loading={loadingDash} onClick={() => navigate('/admin/services')} />
        <StatCard label="Em andamento"   value={services.in_progress  ?? 0} icon="🔄" color="#1d4ed8" bg="#dbeafe" loading={loadingDash} onClick={() => navigate('/admin/services')} />
        <StatCard label="Concluídos"     value={services.done         ?? 0} icon="✅" color="#16a34a" bg="#dcfce7" loading={loadingDash} onClick={() => navigate('/admin/services')} />
        <StatCard label="Com ressalvas"  value={services.done_with_issues ?? 0} icon="⚠️" color="#854d0e" bg="#fef9c3" loading={loadingDash} onClick={() => navigate('/admin/services')} />
        <StatCard label="Atrasados"      value={services.late         ?? 0} icon="🚨" color="#dc2626" bg="#fee2e2" loading={loadingDash} onClick={() => navigate('/admin/services')} />
      </div>

      {/* Serviços abertos próximos do prazo */}
      {(services.openServices?.length ?? 0) > 0 && (
        <OpenServicesCard services={services.openServices} />
      )}

      {/* ── Gráfico + Ausentes ── */}
      <SectionTitle label="Batidas por Unidade (hoje)" icon="📊" />
      <div style={st.twoCol}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <ClocksByUnitChart data={dashData?.clocksByUnit || []} />
          {dashData?.blockedByReason?.length > 0 && (
            <BlockedByReasonCard data={dashData.blockedByReason} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <AbsentEmployeesList employees={absentData?.employees || []} loading={loadingAbsent} />
        </div>
      </div>

      {/* ── Últimos registros ── */}
      <SectionTitle label="Últimos Registros de Ponto" icon="📋" />
      <RecentClocksTable records={dashData?.recentClocks || []} loading={loadingDash} />
    </div>
  );
}

/* ── Sub-componentes ── */

function SectionTitle({ label, icon, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{label}
      </h2>
      {action && (
        <button onClick={action.onClick} style={{ background: 'none', border: 'none', color: '#1d4ed8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          {action.label} →
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, bg, loading, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ padding: '18px 20px', borderRadius: 12, background: bg, border: `1px solid ${color}20`, cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.1s', }}
      onMouseEnter={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {loading ? (
        <div style={{ height: 60, background: '#e2e8f0', borderRadius: 8 }} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: color + 'cc' }}>{label}</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color }}>{value}</div>
        </>
      )}
    </div>
  );
}

function OpenServicesCard({ services }) {
  function fmtDeadline(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    const now = new Date();
    const diffH = Math.round((d - now) / 3600000);
    if (diffH < 0)   return `Atrasado ${Math.abs(diffH)}h`;
    if (diffH < 24)  return `Hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Serviços abertos mais urgentes</span>
      </div>
      {services.map((s) => {
        const isLate = s.deadline && new Date(s.deadline) < new Date();
        const sc = STATUS_COLOR[s.status] || STATUS_COLOR.pending;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f8fafc', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
              {STATUS_LABEL[s.status] || s.status}
            </span>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.unit_name}{s.assigned_to ? ` · ${s.assigned_to}` : ''}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: isLate ? '#dc2626' : '#64748b', whiteSpace: 'nowrap' }}>
              {isLate ? '🚨 ' : '⏰ '}{fmtDeadline(s.deadline)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BlockedByReasonCard({ data }) {
  const REASON_LABELS = {
    gps_disabled:    'GPS desligado',
    outside_zone:    'Fora da zona',
    camera_denied:   'Câmera negada',
    rate_limited:    'Limite excedido',
    invalid_payload: 'Dados inválidos',
  };
  const total = data.reduce((s, d) => s + parseInt(d.total, 10), 0);
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '20px 24px', marginTop: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        Bloqueios por Motivo <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>(últimos 7 dias)</span>
      </h3>
      {data.map((item) => {
        const pct = Math.round((item.total / total) * 100);
        return (
          <div key={item.block_reason} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: '#374151', width: 140, flexShrink: 0 }}>{REASON_LABELS[item.block_reason] || item.block_reason}</div>
            <div style={{ flex: 1, height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#dc2626', borderRadius: 5, width: `${pct}%`, minWidth: 4, transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', width: 32, textAlign: 'right' }}>{item.total}</div>
          </div>
        );
      })}
    </div>
  );
}

const st = {
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 },
  pageTitle:   { fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 },
  pageDate:    { fontSize: 13, color: '#64748b', textTransform: 'capitalize' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  select:      { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' },
  refreshBtn:  { width: 36, height: 36, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 18, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 8 },
  twoCol:      { display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 4 },
};
