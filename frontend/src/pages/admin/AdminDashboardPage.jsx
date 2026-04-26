import { useState }        from 'react';
import { useQuery }        from '@tanstack/react-query';
import { useNavigate }     from 'react-router-dom';
import api                 from '../../services/api';
import ClocksByUnitChart   from '../../components/admin/ClocksByUnitChart';
import RecentClocksTable   from '../../components/admin/RecentClocksTable';
import AbsentEmployeesList from '../../components/admin/AbsentEmployeesList';
import TodayServicesTable  from '../../components/admin/TodayServicesTable';

/* ── Icon helper ── */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  clock:     'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z M12 6v6l4 2',
  users:     'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  absent:    'M12 9v4M12 17h.01 M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  blocked:   'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M4.93 4.93l14.14 14.14',
  employee:  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  pending:   'M12 2a10 10 0 1 1 0 20A10 10 0 0 1 12 2z M12 6v6l4 2',
  progress:  'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  done:      'M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3',
  issues:    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4M12 17h.01',
  late:      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 8v4M12 16h.01',
  services:  'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  chart:     'M18 20V10M12 20V4M6 20v-6',
  refresh:   'M1 4v6h6M23 20v-6h-6 M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15',
  export:    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
};

/* ── Sparkline ── */
function Sparkline({ value, color }) {
  const seed = (value || 0) % 100;
  const pts  = [30, 55, 40, 70, 50, 45, 80, 60, seed % 80 + 20].map((v, i) => {
    const jitter = ((seed * (i + 1)) % 30) - 15;
    return Math.max(4, Math.min(32, v * 0.4 + jitter));
  });
  const last  = value > 0 ? 8 : pts[pts.length - 1];
  const all   = [...pts.slice(-6), last];
  const w     = 72, h = 36;
  const step  = w / (all.length - 1);
  const coords = all.map((v, i) => `${i * step},${h - v}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx={(all.length - 1) * step} cy={h - last} r="2.5" fill={color} />
    </svg>
  );
}

/* ── Queries ── */
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
function useTodayServices(unitId) {
  return useQuery({
    queryKey:        ['services-today', unitId],
    queryFn:         () => api.get('/admin/services/today', { params: unitId ? { unitId } : {} }).then((r) => r.data.services),
    refetchInterval: 60 * 1000,
  });
}

/* ── Cores de status de serviço ── */
const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'Com ressalvas',
  problem:          'Problema',
};
const STATUS_COLOR = {
  pending:          { bg: 'var(--color-surface)', color: 'var(--color-muted)' },
  in_progress:      { bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  done:             { bg: 'var(--color-ok-soft)', color: 'var(--color-ok)' },
  done_with_issues: { bg: 'var(--color-warn-soft)', color: 'var(--color-warn)' },
  problem:          { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
};

/* ── Page ── */
export default function AdminDashboardPage() {
  const [selectedUnit, setSelectedUnit] = useState('');
  const navigate = useNavigate();
  const unitId   = selectedUnit ? parseInt(selectedUnit, 10) : null;

  const { data: dashData,   isLoading: loadingDash }    = useDashboard(unitId);
  const { data: absentData, isLoading: loadingAbsent }  = useAbsences(unitId);
  const { data: units = [] }                            = useUnits();
  const { data: todayServices = [], isLoading: loadingServices } = useTodayServices(unitId);

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
          <button onClick={() => window.location.reload()} style={st.refreshBtn} title="Atualizar">
            <Icon d={ICONS.refresh} size={16} />
          </button>
        </div>
      </div>

      {/* ── Ponto Eletrônico ── */}
      <SectionTitle label="Ponto Eletrônico" />
      <div style={st.statsGrid}>
        <StatCard label="Batidas hoje"       value={summary.totalClocks    ?? 0} icon="clock"    color="var(--color-primary)" loading={loadingDash} />
        <StatCard label="Presentes hoje"     value={summary.activeToday    ?? 0} icon="users"    color="var(--color-ok)"      loading={loadingDash} />
        <StatCard label="Sem registro hoje"  value={summary.absentToday    ?? 0} icon="absent"   color="var(--color-warn)"    loading={loadingDash} onClick={() => navigate('/admin/clocks')} />
        <StatCard label="Bloqueios hoje"     value={summary.totalBlocked   ?? 0} icon="blocked"  color="var(--color-danger)"  loading={loadingDash} onClick={() => navigate('/admin/blocked')} />
        <StatCard label="Funcionários"       value={summary.totalEmployees ?? 0} icon="employee" color="var(--color-violet)"  loading={loadingDash} onClick={() => navigate('/admin/employees')} />
      </div>

      {/* ── Serviços — pills ── */}
      <SectionTitle label="Ordens de Serviço" action={{ label: 'Ver todos', onClick: () => navigate('/admin/services') }} />
      <div style={st.pillsRow}>
        <ServicePill label="Pendentes"     value={services.pending          ?? 0} color="var(--color-muted)"   onClick={() => navigate('/admin/services')} />
        <ServicePill label="Andamento"     value={services.in_progress      ?? 0} color="var(--color-primary)" onClick={() => navigate('/admin/services')} />
        <ServicePill label="Concluídos"    value={services.done             ?? 0} color="var(--color-ok)"      onClick={() => navigate('/admin/services')} />
        <ServicePill label="Com ressalvas" value={services.done_with_issues ?? 0} color="var(--color-warn)"    onClick={() => navigate('/admin/services')} />
        <ServicePill label="Atrasados"     value={services.late             ?? 0} color="var(--color-danger)"  onClick={() => navigate('/admin/services')} />
      </div>

      {/* Serviços urgentes */}
      {(services.openServices?.length ?? 0) > 0 && (
        <OpenServicesCard services={services.openServices} />
      )}

      {/* ── Gráfico + Ausentes ── */}
      <SectionTitle label="Batidas por Unidade (hoje)" />
      <div style={st.twoCol}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <ClocksByUnitChart data={dashData?.clocksByUnit || []} />
          {dashData?.blockedByReason?.length > 0 && (
            <BlockedByReasonCard data={dashData.blockedByReason} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <AbsentEmployeesList employees={absentData?.employees || []} loading={loadingAbsent} />
        </div>
      </div>

      {/* ── Últimos Registros ── */}
      <SectionTitle label="Últimos Registros de Ponto" />
      <RecentClocksTable records={dashData?.recentClocks || []} loading={loadingDash} />

      <TodayServicesTable services={todayServices} loading={loadingServices} />
    </div>
  );
}

/* ── Sub-componentes ── */

function SectionTitle({ label, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 28 }}>
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-subtle)' }}>
        {label}
      </h2>
      {action && (
        <button onClick={action.onClick} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {action.label} →
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, loading, onClick }) {
  /* converte CSS var para hex puro para o alpha — usa inline para hover */
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        border: '1px solid var(--border-default)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.transform    = 'translateY(-2px)';
        e.currentTarget.style.boxShadow    = 'var(--shadow-lg)';
        e.currentTarget.style.borderColor  = 'var(--color-line)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform   = 'translateY(0)';
        e.currentTarget.style.boxShadow   = 'none';
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
    >
      {/* Barra colorida no topo */}
      <div style={{ height: 3, background: color, borderRadius: '12px 12px 0 0' }} />

      {loading ? (
        <div style={{ padding: '18px 20px', height: 88, display: 'flex', alignItems: 'center' }}>
          <div style={{ height: 16, borderRadius: 6, background: 'var(--color-line)', width: '60%' }} />
        </div>
      ) : (
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-subtle)' }}>
              {label}
            </span>
            {/* Ícone em quadrado colorido suave */}
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color,
            }}>
              <Icon d={ICONS[icon] || ICONS.clock} size={14} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 30, fontWeight: 600, lineHeight: 1, color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {value}
            </span>
            <Sparkline value={value} color={color} />
          </div>
        </div>
      )}
    </div>
  );
}

function ServicePill({ label, value, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: 120,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '14px 12px', borderRadius: 10,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-subtle)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

function OpenServicesCard({ services }) {
  function fmtPrazo(scheduled_date, due_time) {
    if (!scheduled_date) return '—';
    const dateStr = scheduled_date.slice(0, 10);
    const today   = new Date().toISOString().slice(0, 10);
    const isPast  = dateStr < today;
    const isToday = dateStr === today;
    const dateFmt = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const timeFmt = due_time ? due_time.slice(0, 5) : null;
    if (isPast)  return `Atrasado — ${dateFmt}${timeFmt ? ` ${timeFmt}` : ''}`;
    if (isToday) return `Hoje${timeFmt ? ` ${timeFmt}` : ''}`;
    return `${dateFmt}${timeFmt ? ` ${timeFmt}` : ''}`;
  }

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Serviços mais urgentes
        </span>
      </div>
      {services.map((s) => {
        const isLate = s.scheduled_date && s.scheduled_date.slice(0, 10) < new Date().toISOString().slice(0, 10);
        const sc     = STATUS_COLOR[s.status] || STATUS_COLOR.pending;
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: '1px solid var(--color-hairline)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
              {STATUS_LABEL[s.status] || s.status}
            </span>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>{s.unit_name}{s.assigned_to ? ` · ${s.assigned_to}` : ''}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: isLate ? 'var(--color-danger)' : 'var(--color-muted)', whiteSpace: 'nowrap' }}>
              {fmtPrazo(s.scheduled_date, s.due_time)}
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
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-default)', padding: '18px 20px', marginTop: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'baseline', gap: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Bloqueios por motivo
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--color-subtle)', textTransform: 'none', letterSpacing: 0 }}>
          (últimos 7 dias)
        </span>
      </h3>
      {data.map((item) => {
        const pct = Math.round((item.total / total) * 100);
        return (
          <div key={item.block_reason} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', width: 140, flexShrink: 0 }}>
              {REASON_LABELS[item.block_reason] || item.block_reason}
            </div>
            <div style={{ flex: 1, height: 6, background: 'var(--color-hairline)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--color-danger)', borderRadius: 'var(--radius-full)', width: `${pct}%`, minWidth: 4, transition: 'width 0.4s' }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-danger)', width: 28, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
              {item.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Estilos ── */
const st = {
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 16 },
  pageTitle:   { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.03em' },
  pageDate:    { fontSize: 12, color: 'var(--color-muted)', textTransform: 'capitalize' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  select: {
    padding: '7px 11px', border: '1px solid var(--border-default)', borderRadius: 8,
    fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-card)',
    cursor: 'pointer', outline: 'none', fontFamily: 'var(--font-sans)',
  },
  refreshBtn: {
    width: 34, height: 34, background: 'var(--bg-card)',
    border: '1px solid var(--border-default)', borderRadius: 8,
    cursor: 'pointer', color: 'var(--color-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 4 },
  pillsRow:  { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' },
  twoCol:    { display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 },
};
