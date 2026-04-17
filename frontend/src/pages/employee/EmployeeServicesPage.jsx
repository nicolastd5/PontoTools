import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import CameraCapture from '../../components/employee/CameraCapture';
import ServiceStatusBadge from '../../components/shared/ServiceStatusBadge';

const STATUS_LABEL = {
  pending:          'Pendente',
  in_progress:      'Em andamento',
  done:             'Concluído',
  done_with_issues: 'Concluído c/ ressalvas',
  problem:          'Problema',
};
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

  // GPS contínuo — já começa a monitorar assim que a página abre, então quando
  // o usuário tira a foto as coordenadas já estão disponíveis (sem novo fix na hora).
  const { coords } = useGeolocation(user?.unit);

  const { data: services = [], isLoading } = useMyServices();

  const [detail, setDetail]       = useState(null);
  const [photoSrc, setPhotoSrc]   = useState({});
  const [cameraPhase, setCameraPhase] = useState(null); // null | 'before' | 'after' | 'issues'
  const [problemModal, setProblemModal]   = useState(false);
  const [problemText, setProblemText]     = useState('');
  const [issuesModal, setIssuesModal]     = useState(false);
  const [issuesText, setIssuesText]       = useState('');
  const [lightbox, setLightbox]           = useState(null); // src da foto ampliada

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status, problem_description }) =>
      api.patch(`/services/${id}/status`, { status, problem_description }),
    onSuccess: (res) => {
      success('Status atualizado.');
      queryClient.invalidateQueries(['my-services']);
      setDetail(res.data);
      setProblemModal(false);
      setProblemText('');
    },
    onError: (err) => error(err.response?.data?.error || 'Erro ao atualizar status.'),
  });

  function openCamera(phase) {
    setCameraPhase(phase);
  }

  // Photo upload mutation
  const photoMutation = useMutation({
    mutationFn: async ({ id, phase, blob }) => {
      const fd = new FormData();
      fd.append('photo', blob, 'photo.jpg');
      fd.append('phase', phase);
      if (coords?.latitude != null && coords?.longitude != null) {
        fd.append('latitude',  String(coords.latitude));
        fd.append('longitude', String(coords.longitude));
      }
      return api.post(`/services/${id}/photos`, fd);
    },
    onSuccess: async (_, vars) => {
      const phase = vars.phase;
      setCameraPhase(null);
      if (detail) {
        const res = await api.get(`/services/${detail.id}`);
        setDetail(res.data);
        setPhotoSrc({});
        if (phase === 'before') success('Foto enviada. Serviço iniciado automaticamente.');
        else if (phase === 'after') success('Foto enviada. Serviço marcado como concluído.');
        else success('Foto enviada.');
        // Após foto de ressalvas, finaliza o status
        if (phase === 'issues') {
          await statusMutation.mutateAsync({ id: vars.id, status: 'done_with_issues', issue_description: issuesText });
        }
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
  }

  async function loadPhoto(photo) {
    if (photoSrc[photo.id]) return;
    try {
      const res = await api.get(`/services/${photo.service_order_id}/photos/${photo.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      setPhotoSrc((prev) => ({ ...prev, [photo.id]: url }));
    } catch {}
  }

  function handlePhotoCapture(blobs) {
    if (!detail || !cameraPhase) return;
    // Fase 'issues': foto é opcional — se não tirou, só muda status
    const phase = cameraPhase === 'issues' ? 'after' : cameraPhase;
    if (blobs.length === 0) {
      if (cameraPhase === 'issues') {
        setCameraPhase(null);
        statusMutation.mutate({ id: detail.id, status: 'done_with_issues', issue_description: issuesText });
      }
      return;
    }
    blobs.reduce((promise, blob) =>
      promise.then(() => photoMutation.mutateAsync({ id: detail.id, phase, blob })),
      Promise.resolve()
    ).catch(() => {});
  }

  const allPhotos    = detail ? [...(detail.photos || [])] : [];
  const beforePhotos = allPhotos.filter((p) => p.phase === 'before');
  const afterPhotos  = allPhotos.filter((p) => p.phase === 'after');

  const isActive   = detail && (detail.status === 'pending' || detail.status === 'in_progress');
  const canIssues  = detail && detail.status === 'in_progress';
  const canProblem = detail && (detail.status === 'in_progress' || detail.status === 'pending');

  return (
    <div>
      <h1 style={s.title}>Meus Serviços</h1>

      {isLoading ? (
        <p style={s.empty}>Carregando...</p>
      ) : services.length === 0 ? (
        <div style={s.emptyCard}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <p style={{ color: '#64748b' }}>Nenhum serviço atribuído a você.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {services.map((sv) => {
            return (
              <div key={sv.id} style={s.card} onClick={() => openDetail(sv)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={s.cardTitle}>{sv.title}</div>
                    {sv.description && <div style={s.cardDesc}>{sv.description.slice(0, 80)}{sv.description.length > 80 ? '…' : ''}</div>}
                  </div>
                  <ServiceStatusBadge status={sv.status} label={STATUS_LABEL[sv.status]} />
                </div>
                <div style={s.cardMeta}>
                  <span>📅 {new Date(sv.scheduled_date).toLocaleDateString('pt-BR')}</span>
                  {sv.due_time && <span>⏰ até {sv.due_time.slice(0, 5)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && !cameraPhase && (
        <div style={overlay} onClick={() => setDetail(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={modalTitle}>{detail.title}</h2>
                <ServiceStatusBadge status={detail.status} label={STATUS_LABEL[detail.status]} />
              </div>
              <button onClick={() => setDetail(null)} style={closeBtn}>✕</button>
            </div>

            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>📅 {new Date(detail.scheduled_date).toLocaleDateString('pt-BR')}</span>
              {detail.due_time && <span>⏰ até {detail.due_time.slice(0, 5)}</span>}
            </div>
            {(detail.started_at || detail.finished_at) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, marginBottom: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                {detail.started_at && (
                  <span style={{ color: '#166534' }}>▶ Iniciado em: <strong>{new Date(detail.started_at).toLocaleString('pt-BR')}</strong></span>
                )}
                {detail.finished_at && (
                  <span style={{ color: '#166534' }}>✔ Concluído em: <strong>{new Date(detail.finished_at).toLocaleString('pt-BR')}</strong></span>
                )}
              </div>
            )}

            {detail.description && (
              <div style={descBox}>{detail.description}</div>
            )}

            {detail.issue_description && (
              <div style={{ ...descBox, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', marginBottom: 12 }}>
                <strong>Ressalvas:</strong> {detail.issue_description}
              </div>
            )}

            {detail.problem_description && (
              <div style={{ ...descBox, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', marginBottom: 12 }}>
                <strong>Problema:</strong> {detail.problem_description}
              </div>
            )}

            {/* Photo sections */}
            <PhotoSection title="Fotos — Antes" photos={beforePhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detail.id} onOpen={setLightbox} />
            <PhotoSection title="Fotos — Depois" photos={afterPhotos} photoSrc={photoSrc} onLoad={loadPhoto} serviceId={detail.id} onOpen={setLightbox} />

            {/* Action buttons */}
            {isActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', margin: 0 }}>Ações</p>

                {/* Foto antes — inicia automaticamente */}
                {detail.status === 'pending' && (
                  <button onClick={() => openCamera('before')} style={{ ...primaryBtn, background: '#1d4ed8' }}>
                    📷 Enviar Foto de Início
                  </button>
                )}

                {/* Foto depois — conclui automaticamente */}
                {detail.status === 'in_progress' && (
                  <button onClick={() => openCamera('after')} style={{ ...primaryBtn, background: '#16a34a' }}>
                    📷 Enviar Foto de Conclusão
                  </button>
                )}

                {/* Concluído com ressalvas */}
                {canIssues && (
                  <button onClick={() => setIssuesModal(true)}
                    style={{ ...primaryBtn, background: '#ea580c' }}>
                    ⚠️ Concluir com Ressalvas
                  </button>
                )}

                {/* Reportar problema */}
                {canProblem && (
                  <button onClick={() => setProblemModal(true)}
                    style={{ ...primaryBtn, background: '#dc2626' }}>
                    🚨 Reportar Problema
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera capture overlay */}
      {cameraPhase && detail && (
        <CameraCapture
          maxPhotos={3}
          onCapture={(blobs) => handlePhotoCapture(blobs)}
          onCancel={() => setCameraPhase(null)}
        />
      )}

      {/* Modal: concluir com ressalvas */}
      {issuesModal && detail && (
        <div style={overlay} onClick={() => setIssuesModal(false)}>
          <div style={{ ...modalCard, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Concluir com Ressalvas</h2>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Descreva as ressalvas. Você pode tirar uma foto (opcional).</p>
            <textarea
              value={issuesText}
              onChange={(e) => setIssuesText(e.target.value)}
              rows={3}
              placeholder="Descreva as ressalvas ou observações..."
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { setIssuesModal(false); openCamera('issues'); }}
                disabled={!issuesText.trim()}
                style={{ ...primaryBtn, background: '#ea580c', opacity: !issuesText.trim() ? 0.6 : 1 }}>
                📷 Tirar Foto e Concluir
              </button>
              <button
                onClick={() => { setIssuesModal(false); statusMutation.mutate({ id: detail.id, status: 'done_with_issues', issue_description: issuesText }); }}
                disabled={!issuesText.trim() || statusMutation.isLoading}
                style={{ ...outlineBtn, borderColor: '#ea580c', color: '#ea580c', width: '100%', opacity: !issuesText.trim() ? 0.6 : 1 }}>
                Concluir Sem Foto
              </button>
              <button onClick={() => setIssuesModal(false)} style={{ ...outlineBtn, width: '100%' }}>Cancelar</button>
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

      {/* Modal: reportar problema */}
      {problemModal && detail && (
        <div style={overlay} onClick={() => setProblemModal(false)}>
          <div style={{ ...modalCard, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={modalTitle}>Reportar Problema</h2>
            <textarea
              value={problemText}
              onChange={(e) => setProblemText(e.target.value)}
              rows={4}
              placeholder="Descreva o problema encontrado..."
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setProblemModal(false)} style={outlineBtn}>Cancelar</button>
              <button
                onClick={() => statusMutation.mutate({ id: detail.id, status: 'problem', problem_description: problemText })}
                disabled={!problemText.trim() || statusMutation.isLoading}
                style={{ ...primaryBtn, background: '#dc2626', opacity: !problemText.trim() || statusMutation.isLoading ? 0.6 : 1 }}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoSection({ title, photos, photoSrc, onLoad, serviceId, onOpen }) {
  if (photos.length === 0) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>{title}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {photos.map((photo) => {
          onLoad({ ...photo, service_order_id: serviceId });
          const src = photoSrc[photo.id];
          return (
            <div key={photo.id}
              onClick={() => src && onOpen && onOpen(src)}
              style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: src ? 'zoom-in' : 'default' }}>
              {src
                ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1', fontSize: 12 }}>…</div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

const overlay   = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 };
const modalCard = { background: '#fff', borderRadius: 12, padding: '24px 20px', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' };
const modalTitle = { fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 };
const closeBtn   = { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' };
const descBox    = { padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#374151', marginBottom: 12 };
const primaryBtn = { padding: '10px 16px', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#fff', fontWeight: 600, width: '100%' };
const outlineBtn = { padding: '10px 16px', border: '1.5px solid #1d4ed8', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#1d4ed8', background: '#fff', fontWeight: 600 };
const photoActionBtn = { flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, cursor: 'pointer', background: '#f8fafc', color: '#374151', fontWeight: 600 };
const inputStyle = { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', width: '100%', boxSizing: 'border-box' };

const s = {
  title:     { fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 20 },
  empty:     { color: '#64748b', padding: 24 },
  emptyCard: { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '48px 24px', textAlign: 'center' },
  card:      { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 18px', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 },
  cardDesc:  { fontSize: 13, color: '#64748b', marginBottom: 8 },
  cardMeta:  { display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' },
};
