// Modal de captura de foto ao vivo — suporta múltiplas fotos
import { useState, useEffect } from 'react';
import { useCamera } from '../../hooks/useCamera';

/**
 * @param {{
 *   clockType:  string,
 *   maxPhotos:  number,
 *   onCapture:  (blobs: Blob[]) => void,
 *   onCancel:   () => void
 * }} props
 */
export default function CameraCapture({ clockType, maxPhotos = 1, onCapture, onCancel }) {
  const { videoRef, isOpen, error, facing, open, stop, switchCamera, capture } = useCamera();
  const [blobs, setBlobs]       = useState([]);
  const [previews, setPreviews] = useState([]);

  const LABELS = {
    entry: 'Entrada', exit: 'Saída',
    break_start: 'Início de Intervalo', break_end: 'Fim de Intervalo',
  };

  useEffect(() => {
    open('user');
    return () => {
      stop();
      setPreviews((prev) => { prev.forEach(URL.revokeObjectURL); return []; });
    };
  }, []); // eslint-disable-line

  async function handleCapture() {
    try {
      const blob = await capture(facing);
      const url  = URL.createObjectURL(blob);
      setBlobs((prev) => [...prev, blob]);
      setPreviews((prev) => [...prev, url]);
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
    }
  }

  function removePhoto(index) {
    URL.revokeObjectURL(previews[index]);
    setBlobs((prev)    => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm() {
    stop();
    onCapture(blobs.length === 0 ? [] : blobs);
  }

  function handleCancel() {
    stop();
    previews.forEach(URL.revokeObjectURL);
    onCancel();
  }

  const canAddMore = blobs.length < maxPhotos;
  const hasPhotos  = blobs.length > 0;

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* ── Topo fixo ── */}
        <div style={s.header}>
          <span style={s.headerTitle}>{LABELS[clockType] || clockType || 'Foto'}</span>
          <button onClick={handleCancel} style={s.closeBtn}>✕</button>
        </div>

        {/* ── Vídeo (cresce para preencher o espaço) ── */}
        {error ? (
          <div style={s.errorBox}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📷</div>
            <div style={s.errorText}>{error}</div>
            <button onClick={handleCancel} style={{ ...s.cancelBtn, maxWidth: 200 }}>Fechar</button>
          </div>
        ) : (
          <>
            {canAddMore && (
              <div style={s.videoWrap}>
                <video
                  ref={videoRef}
                  autoPlay playsInline muted
                  style={{ ...s.video, transform: facing === 'user' ? 'scaleX(-1)' : 'none' }}
                />
                {!isOpen && <div style={s.videoLoader}>Iniciando câmera...</div>}
                {isOpen && (
                  <button onClick={switchCamera} style={s.switchBtn} title="Trocar câmera">🔄</button>
                )}
                <div style={s.hint}>
                  {facing === 'user' ? 'Câmera frontal' : 'Câmera traseira'}
                </div>
              </div>
            )}

            {/* Miniaturas */}
            {hasPhotos && (
              <div style={s.thumbRow}>
                {previews.map((url, i) => (
                  <div key={i} style={s.thumbWrap}>
                    <img src={url} alt={`Foto ${i + 1}`} style={s.thumb} />
                    <button style={s.thumbRemove} onClick={() => removePhoto(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {maxPhotos > 1 && (
              <p style={s.photoCount}>
                {blobs.length}/{maxPhotos} foto{maxPhotos > 1 ? 's' : ''}
                {canAddMore ? ' — capture mais ou confirme' : ' — limite atingido'}
              </p>
            )}

            {/* ── Botões fixos no fundo ── */}
            <div style={s.actions}>
              <button onClick={handleCancel} style={s.cancelBtn}>Cancelar</button>
              {canAddMore && (
                <button
                  onClick={handleCapture}
                  disabled={!isOpen}
                  style={{ ...s.captureBtn, opacity: isOpen ? 1 : 0.5, cursor: isOpen ? 'pointer' : 'not-allowed' }}
                >
                  📸 {hasPhotos ? 'Mais uma' : 'Capturar'}
                </button>
              )}
              {hasPhotos && (
                <button onClick={handleConfirm} style={s.confirmBtn}>
                  ✓ Confirmar {blobs.length > 1 ? `(${blobs.length})` : ''}
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0,
    background: '#000',
    display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    width: '100%', maxWidth: 640,
    display: 'flex', flexDirection: 'column',
    background: '#000',
  },
  // ── topo ──
  header: {
    flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    background: 'rgba(0,0,0,0.8)',
  },
  headerTitle: { fontWeight: 700, fontSize: 15, color: '#fff' },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)', border: 'none',
    borderRadius: '50%', width: 36, height: 36,
    fontSize: 18, cursor: 'pointer', color: '#fff',
  },
  // ── vídeo ──
  videoWrap: {
    flex: 1, position: 'relative', overflow: 'hidden', background: '#000',
    minHeight: 0, // necessário para flex fill funcionar em Safari
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoLoader: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 14,
  },
  switchBtn: {
    position: 'absolute', top: 12, right: 12,
    background: 'rgba(0,0,0,0.5)', border: 'none',
    borderRadius: '50%', width: 46, height: 46,
    fontSize: 20, cursor: 'pointer', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    fontSize: 12, color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', padding: '6px 0',
    background: 'rgba(0,0,0,0.4)',
  },
  // ── miniaturas ──
  thumbRow: {
    flexShrink: 0,
    display: 'flex', gap: 8, flexWrap: 'wrap',
    padding: '10px 16px', background: 'rgba(0,0,0,0.7)',
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 8, objectFit: 'cover', border: '2px solid #fff' },
  thumbRemove: {
    position: 'absolute', top: -6, right: -6,
    background: '#dc2626', border: 'none', borderRadius: '50%',
    width: 20, height: 20, color: '#fff', fontSize: 11,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold',
  },
  photoCount: {
    flexShrink: 0,
    fontSize: 12, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', padding: '4px 0',
    background: 'rgba(0,0,0,0.6)', margin: 0,
  },
  // ── botões ──
  actions: {
    flexShrink: 0,
    display: 'flex', gap: 10,
    padding: '14px 16px',
    background: '#111',
  },
  cancelBtn: {
    flex: 1, padding: '14px', background: '#374151', border: 'none',
    borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
  },
  captureBtn: {
    flex: 2, padding: '14px', background: '#1d4ed8', border: 'none',
    borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff',
  },
  confirmBtn: {
    flex: 2, padding: '14px', background: '#16a34a', border: 'none',
    borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
  // ── erro ──
  errorBox: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px', color: '#fff', gap: 12,
  },
  errorText: { fontSize: 14, color: '#fca5a5', textAlign: 'center', lineHeight: 1.6 },
};
