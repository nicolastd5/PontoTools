import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useReverseGeocode } from '../../hooks/useReverseGeocode';
import CameraCapture from '../../components/employee/CameraCapture';
import ServiceStatusBadge from '../../components/shared/ServiceStatusBadge';
import PushBanner from '../../components/employee/PushBanner';

const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'Concluído c/ ressalvas',
  problem:          'Problema',
};

function statusColor(status, theme) {
  switch (status) {
    case 'pending':          return theme.textSecondary;
    case 'in_progress':      return theme.warning;
    case 'done':             return theme.success;
    case 'done_with_issues': return '#ea580c';
    case 'problem':          return theme.danger;
    default:                 return theme.textMuted;
  }
}

function statusBg(status, theme) {
  switch (status) {
    case 'pending':          return theme.elevated;
    case 'in_progress':      return theme.warning + '22';
    case 'done':             return theme.success + '22';
    case 'done_with_issues': return '#ea580c22';
    case 'problem':          return theme.danger + '22';
    default:                 return theme.elevated;
  }
}

function fmtDate(dateStr) {
  const [y, m, d] = dateStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function useMyServices() {
  return useQuery({
    queryKey: ['my-services'],
    queryFn:  () => api.get('/services').then((r) => r.data.services),
    refetchInterval: 30000,
  });
}

export default function EmployeeServicesPage() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();
  const { user } = useAuth();
  const { theme } = useTheme();

  const { status: gpsStatus, coords } = useGeolocation(user?.unit);
  const address = useReverseGeocode(coords);

  const { data: services = [], isLoading } = useMyServices();

  const [detail, setDetail]           = useState(null);
  const [photoSrc, setPhotoSrc]       = useState({});
  const [cameraPhase, setCameraPhase] = useState(null);
  const [problemModal, setProblemModal]   = useState(false);
  const [problemText, setProblemText]     = useState('');
  const [issuesModal, setIssuesModal]     = useState(false);
  const [issuesText, setIssuesText]       = useState('');
  const [lightbox, setLightbox]           = useState(null);
  const [posto, setPosto]                 = useState('');

  const statusMutation = useMutation({
    mutationFn: ({ id, status, problem_description, issue_description }) =>
      api.patch(`/services/${id}/status`, { status, problem_description, issue_description }),
    onSuccess: (res) => {
      success('Status atualizado.');
      queryClient.invalidateQueries(['my-services']);
      setDetail(res.data);
      setProblemModal(false);
      setProblemText('');
      setIssuesModal(false);
      setIssuesText('');
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar status.'),
  });

  const photoMutation = useMutation({
    mutationFn: async ({ id, phase, blob }) => {
      const fd = new FormData();
      fd.append('photo', blob, 'photo.jpg');
      fd.append('phase', phase);
      if (coords?.latitude != null) fd.append('latitude',  String(coords.latitude));
      if (coords?.longitude != null) fd.append('longitude', String(coords.longitude));
      if (phase === 'before' && posto.trim()) fd.append('employee_posto', posto.trim());
      return api.post(`/services/${id}/photos`, fd);
    },
    onSuccess: async (_, vars) => {
      const { phase, originalPhase } = vars;
      setCameraPhase(null);
      if (detail) {
        if (originalPhase === 'issues') {
          await statusMutation.mutateAsync({ id: vars.id, status: 'done_with_issues', issue_description: issuesText });
        }
        const res = await api.get(`/services/${detail.id}`);
        setDetail(res.data);
        setPhotoSrc({});
        if (phase === 'before') success('Foto enviada. Serviço iniciado.');
        else if (originalPhase === 'issues') success('Serviço concluído com ressalvas.');
        else if (phase === 'after') success('Foto enviada. Serviço concluído.');
        else success('Foto enviada.');
      }
      queryClient.invalidateQueries(['my-services']);
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao enviar foto.'),
  });

  async function openDetail(service) {
    const res = await api.get(`/services/${service.id}`);
    setDetail(res.data);
    setPhotoSrc({});
    setCameraPhase(null);
    setPosto(res.data.employee_posto || '');
  }

  async function loadPhoto(photo) {
    if (photoSrc[photo.id]) return;
    try {
      const res = await api.get(`/services/${photo.service_order_id}/photos/${photo.id}`, { responseType: 'blob' });
      setPhotoSrc((prev) => ({ ...prev, [photo.id]: URL.createObjectURL(res.data) }));
    } catch {}
  }

  function handlePhotoCapture(blobs) {
    if (!detail || !cameraPhase) return;
    const phase = cameraPhase === 'issues' ? 'after' : cameraPhase;
    if (blobs.length === 0) {
      if (cameraPhase === 'issues') {
        setCameraPhase(null);
        statusMutation.mutate({ id: detail.id, status: 'done_with_issues', issue_description: issuesText });
      }
      return;
    }
    blobs.reduce(
      (p, blob) => p.then(() => photoMutation.mutateAsync({ id: detail.id, phase, blob, originalPhase: cameraPhase })),
      Promise.resolve(),
    ).catch(() => {});
  }

  const allPhotos    = detail ? [...(detail.photos || [])] : [];
  const beforePhotos = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos  = allPhotos.filter((p) => p.phase === 'after');
  const isActive     = detail && (detail.status === 'pending' || detail.status === 'in_progress');
  const canIssues    = detail && detail.status === 'in_progress';
  const canProblem   = detail && (detail.status === 'in_progress' || detail.status === 'pending');

  // ── estilos dinâmicos (dependem do theme) ──────────────────────────────────
  const gpsColor = gpsStatus === 'granted' ? theme.success
    : gpsStatus === 'loading'              ? theme.warning
    : theme.danger;

  const gpsText = gpsStatus === 'loading'     ? 'Obtendo localização GPS...'
    : gpsStatus === 'denied'                  ? 'GPS negado — habilite nas configurações do navegador'
    : gpsStatus === 'unavailable'             ? 'GPS indisponível'
    : coords
      ? `GPS ativo${coords.accuracy != null ? ` — prec. ${Math.round(coords.accuracy)}m` : ''}`
      : 'GPS ativo';

  const card = {
    background: theme.surface, borderRadius: 12,
    border: `1px solid ${theme.border}`, padding: '16px 18px',
    cursor: 'pointer', marginBottom: 10,
  };

  const modalCard = {
    background: theme.surface, borderRadius: 16,
    padding: '24px 20px', width: '100%', maxWidth: 520,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    maxHeight: '90vh', overflowY: 'auto',
    border: `1px solid ${theme.border}`,
  };

  const descBox = {
    padding: '10px 14px', background: theme.elevated,
    borderRadius: 8, border: `1px solid ${theme.border}`,
    fontSize: 13, color: theme.textSecondary, marginBottom: 12,
  };

  const inputStyle = {
    padding: '10px 12px', border: `1.5px solid ${theme.border}`,
    borderRadius: 8, fontSize: 14, color: theme.textPrimary,
    background: theme.elevated, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  const primaryBtn = {
    padding: '12px 16px', border: 'none', borderRadius: 10,
    fontSize: 14, cursor: 'pointer', color: '#fff',
    fontWeight: 700, width: '100%',
  };

  const outlineBtn = {
    padding: '12px 16px', borderRadius: 10, fontSize: 14,
    cursor: 'pointer', fontWeight: 600, background: theme.elevated,
    border: `1.5px solid ${theme.border}`, color: theme.textSecondary,
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textPrimary, marginBottom: 16 }}>
        Meus Serviços
      </h1>

      <PushBanner />

      {/* Painel GPS */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '10px 14px', borderRadius: 10, marginBottom: 16,
        border: `1px solid ${gpsColor}55`,
        background: `${gpsColor}18`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: gpsColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>{gpsText}</span>
        </div>
        {address ? (
          <span style={{ fontSize: 12, color: theme.textSecondary, paddingLeft: 16 }}>📍 {address}</span>
        ) : gpsStatus === 'granted' ? (
          <span style={{ fontSize: 12, color: theme.textMuted, paddingLeft: 16 }}>Obtendo endereço...</span>
        ) : null}
      </div>

      {/* Lista de serviços */}
      {isLoading ? (
        <p style={{ color: theme.textMuted, padding: 24 }}>Carregando...</p>
      ) : services.length === 0 ? (
        <div style={{ background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}`, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <p style={{ color: theme.textMuted }}>Nenhum serviço atribuído a você.</p>
        </div>
      ) : (
        <div>
          {services.map((sv, idx) => (
            <div key={sv.id} style={card} onClick={() => openDetail(sv)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: theme.textPrimary, flex: 1, marginRight: 12 }}>
                  #{idx + 1} {sv.title}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 700, borderRadius: 10,
                  padding: '3px 10px', whiteSpace: 'nowrap',
                  background: statusBg(sv.status, theme),
                  color: statusColor(sv.status, theme),
                }}>
                  {STATUS_LABEL[sv.status]}
                </span>
              </div>
              {sv.description && (
                <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 6, marginTop: 0 }}>
                  {sv.description.slice(0, 80)}{sv.description.length > 80 ? '…' : ''}
                </p>
              )}
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: theme.textMuted }}>
                <span>📅 {fmtDate(sv.scheduled_date)}</span>
                {sv.due_time && <span>⏰ até {sv.due_time.slice(0, 5)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalhe */}
      {detail && !cameraPhase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={() => setDetail(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>

            {/* Cabeçalho */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ flex: 1, marginRight: 12 }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: theme.textPrimary, margin: '0 0 8px' }}>{detail.title}</h2>
                <span style={{
                  fontSize: 12, fontWeight: 700, borderRadius: 10,
                  padding: '3px 10px', display: 'inline-block',
                  background: statusBg(detail.status, theme),
                  color: statusColor(detail.status, theme),
                }}>
                  {STATUS_LABEL[detail.status]}
                </span>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: theme.textMuted, lineHeight: 1 }}>✕</button>
            </div>

            {/* Datas */}
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>
              <span>📅 {fmtDate(detail.scheduled_date)}</span>
              {detail.due_time && <span>⏰ até {detail.due_time.slice(0, 5)}</span>}
            </div>

            {/* Timestamps */}
            {(detail.started_at || detail.finished_at) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, marginBottom: 12, padding: '10px 14px', background: theme.success + '15', borderRadius: 8, border: `1px solid ${theme.success}40` }}>
                {detail.started_at && <span style={{ color: theme.success }}>▶ Iniciado em: <strong>{new Date(detail.started_at).toLocaleString('pt-BR')}</strong></span>}
                {detail.finished_at && <span style={{ color: theme.success }}>✔ Concluído em: <strong>{new Date(detail.finished_at).toLocaleString('pt-BR')}</strong></span>}
              </div>
            )}

            {detail.description && <div style={descBox}>{detail.description}</div>}

            {detail.issue_description && (
              <div style={{ ...descBox, background: '#ea580c15', border: '1px solid #ea580c40', color: '#ea580c' }}>
                <strong>Ressalvas:</strong> {detail.issue_description}
              </div>
            )}

            {detail.problem_description && (
              <div style={{ ...descBox, background: theme.danger + '15', border: `1px solid ${theme.danger}40`, color: theme.danger }}>
                <strong>Problema:</strong> {detail.problem_description}
              </div>
            )}

            {/* Fotos */}
            <PhotoSection title="Fotos — Antes"  photos={beforePhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detail.id} onOpen={setLightbox} theme={theme} />
            <PhotoSection title="Fotos — Depois" photos={afterPhotos}  photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detail.id} onOpen={setLightbox} theme={theme} />

            {/* Campo Posto */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 6 }}>Posto *</label>
              {detail.employee_posto && detail.status !== 'pending' ? (
                <div style={descBox}>{detail.employee_posto}</div>
              ) : (
                <input value={posto} onChange={(e) => setPosto(e.target.value)}
                  placeholder="Informe o posto de trabalho" style={inputStyle} />
              )}
            </div>

            {/* Ações */}
            {isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', margin: 0 }}>Ações</p>

                {detail.status === 'pending' && (
                  <button onClick={() => { if (!posto.trim()) { error('Preencha o campo Posto.'); return; } setCameraPhase('before'); }}
                    style={{ ...primaryBtn, background: theme.accent }}>
                    📷 Enviar Foto de Início
                  </button>
                )}

                {detail.status === 'in_progress' && (
                  <button onClick={() => setCameraPhase('after')}
                    style={{ ...primaryBtn, background: theme.success }}>
                    📷 Enviar Foto de Conclusão
                  </button>
                )}

                {canIssues && (
                  <button onClick={() => setIssuesModal(true)}
                    style={{ ...primaryBtn, background: '#ea580c' }}>
                    ⚠️ Concluir com Ressalvas
                  </button>
                )}

                {canProblem && (
                  <button onClick={() => setProblemModal(true)}
                    style={{ ...primaryBtn, background: theme.danger }}>
                    🚨 Reportar Problema
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Câmera */}
      {cameraPhase && detail && (
        <CameraCapture maxPhotos={3} onCapture={handlePhotoCapture} onCancel={() => setCameraPhase(null)} />
      )}

      {/* Modal: ressalvas */}
      {issuesModal && detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setIssuesModal(false)}>
          <div style={{ ...modalCard, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: theme.textPrimary, marginBottom: 8 }}>Concluir com Ressalvas</h2>
            <p style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 12 }}>Descreva as ressalvas. Você pode tirar uma foto (opcional).</p>
            <textarea value={issuesText} onChange={(e) => setIssuesText(e.target.value)} rows={3}
              placeholder="Descreva as ressalvas..." style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => { setIssuesModal(false); setCameraPhase('issues'); }}
                disabled={!issuesText.trim()}
                style={{ ...primaryBtn, background: '#ea580c', opacity: !issuesText.trim() ? 0.5 : 1 }}>
                📷 Tirar Foto e Concluir
              </button>
              <button onClick={() => { setIssuesModal(false); statusMutation.mutate({ id: detail.id, status: 'done_with_issues', issue_description: issuesText }); }}
                disabled={!issuesText.trim() || statusMutation.isLoading}
                style={{ ...outlineBtn, width: '100%', borderColor: '#ea580c', color: '#ea580c', opacity: !issuesText.trim() ? 0.5 : 1 }}>
                Concluir Sem Foto
              </button>
              <button onClick={() => setIssuesModal(false)} style={{ ...outlineBtn, width: '100%' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: problema */}
      {problemModal && detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={() => setProblemModal(false)}>
          <div style={{ ...modalCard, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: theme.textPrimary, marginBottom: 12 }}>Reportar Problema</h2>
            <textarea value={problemText} onChange={(e) => setProblemText(e.target.value)} rows={4}
              placeholder="Descreva o problema..." style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setProblemModal(false)} style={{ ...outlineBtn, flex: 1 }}>Cancelar</button>
              <button onClick={() => statusMutation.mutate({ id: detail.id, status: 'problem', problem_description: problemText })}
                disabled={!problemText.trim() || statusMutation.isLoading}
                style={{ ...primaryBtn, background: theme.danger, flex: 1, opacity: !problemText.trim() ? 0.5 : 1 }}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" style={{ maxWidth: '95vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 40, height: 40, color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}

function PhotoSection({ title, photos, photoSrc, onLoad, serviceId, onOpen, theme }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>{title}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((photo) => {
          onLoad({ ...photo, service_order_id: serviceId });
          const src = photoSrc[photo.id];
          return (
            <div key={photo.id} onClick={() => src && onOpen && onOpen(src)}
              style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.border}`, background: theme.elevated, cursor: src ? 'zoom-in' : 'default' }}>
              {src
                ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.textMuted, fontSize: 12 }}>…</div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
