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
  const [blobs, setBlobs]       = useState([]); // fotos capturadas
  const [previews, setPreviews] = useState([]); // object URLs para exibir

  const LABELS = {
    entry: 'Entrada', exit: 'Saída',
    break_start: 'Início de Intervalo', break_end: 'Fim de Intervalo',
  };

  useEffect(() => {
    open('user');
    return () => {
      stop();
      // Libera object URLs ao desmontar
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
    // Se nenhuma foto foi tirada, passa um blob vazio (placeholder)
    if (blobs.length === 0) {
      onCapture([]);
    } else {
      onCapture(blobs);
    }
  }

  function handleCancel() {
    stop();
    previews.forEach(URL.revokeObjectURL);
    onCancel();
  }

  const canAddMore  = blobs.length < maxPhotos;
  const hasPhotos   = blobs.length > 0;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>
            {LABELS[clockType] || clockType}
          </span>
          <button onClick={handleCancel} style={styles.closeBtn}>✕</button>
        </div>

        <div style={styles.body}>
          {/* Header flutuante sobre o vídeo */}
          <div style={styles.header}>
            <span style={styles.headerTitle}>
              {LABELS[clockType] || clockType || 'Foto'}
            </span>
            <button onClick={handleCancel} style={styles.closeBtn}>✕</button>
          </div>

          {error ? (
            <div style={styles.error}>
              <div style={styles.errorIcon}>📷</div>
              <div style={styles.errorText}>{error}</div>
              <button onClick={handleCancel} style={{ ...styles.cancelBtn, maxWidth: 200, margin: '0 auto' }}>Fechar</button>
            </div>
          ) : (
            <>
              {/* Preview ao vivo — só mostra se ainda pode adicionar fotos */}
              {canAddMore && (
                <>
                  <div style={styles.videoContainer}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        ...styles.video,
                        transform: facing === 'user' ? 'scaleX(-1)' : 'none',
                      }}
                    />
                    {!isOpen && (
                      <div style={styles.videoLoader}>Iniciando câmera...</div>
                    )}
                    {isOpen && (
                      <button onClick={switchCamera} style={styles.switchBtn} title="Trocar câmera">
                        🔄
                      </button>
                    )}
                  </div>

                  <p style={styles.hint}>
                    {facing === 'user'
                      ? 'Câmera frontal — posicione seu rosto no centro'
                      : 'Câmera traseira — aponte para o que deseja registrar'}
                  </p>
                </>
              )}

              {/* Miniaturas das fotos já tiradas */}
              {hasPhotos && (
                <div style={styles.thumbRow}>
                  {previews.map((url, i) => (
                    <div key={i} style={styles.thumbWrap}>
                      <img src={url} alt={`Foto ${i + 1}`} style={styles.thumb} />
                      <button style={styles.thumbRemove} onClick={() => removePhoto(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {maxPhotos > 1 && (
                <p style={styles.photoCount}>
                  {blobs.length}/{maxPhotos} foto{maxPhotos > 1 ? 's' : ''}
                  {canAddMore ? ' — capture mais ou confirme' : ' — limite atingido'}
                </p>
              )}

              <div style={styles.actions}>
                <button onClick={handleCancel} style={styles.cancelBtn}>
                  Cancelar
                </button>
                {canAddMore && (
                  <button
                    onClick={handleCapture}
                    disabled={!isOpen}
                    style={{
                      ...styles.captureBtn,
                      opacity: isOpen ? 1 : 0.5,
                      cursor:  isOpen ? 'pointer' : 'not-allowed',
                    }}
                  >
                    📸 {hasPhotos ? 'Mais uma' : 'Capturar'}
                  </button>
                )}
                {hasPhotos && (
                  <button onClick={handleConfirm} style={styles.confirmBtn}>
                    ✓ Confirmar {blobs.length > 1 ? `(${blobs.length})` : ''}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.92)',
    display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#000',
    width: '100%', maxWidth: 640,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px',
    background: 'rgba(0,0,0,0.7)',
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  headerTitle: { fontWeight: 700, fontSize: 15, color: '#fff' },
  closeBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', fontSize: 18, cursor: 'pointer', color: '#fff', borderRadius: '50%', width: 36, height: 36 },
  body: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  videoContainer: {
    position: 'relative', background: '#000',
    flex: 1, overflow: 'hidden',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoLoader: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 14,
  },
  switchBtn: {
    position: 'absolute', top: 60, right: 16,
    background: 'rgba(0,0,0,0.5)', border: 'none',
    borderRadius: '50%', width: 46, height: 46,
    fontSize: 20, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
  },
  hint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '6px 0', background: 'rgba(0,0,0,0.5)', margin: 0 },
  thumbRow: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 16px', background: 'rgba(0,0,0,0.6)' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 8, objectFit: 'cover', display: 'block', border: '2px solid #fff' },
  thumbRemove: {
    position: 'absolute', top: -6, right: -6,
    background: '#dc2626', border: 'none', borderRadius: '50%',
    width: 20, height: 20, color: '#fff', fontSize: 11,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold',
  },
  photoCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '4px 0', background: 'rgba(0,0,0,0.6)', margin: 0 },
  actions: { display: 'flex', gap: 10, padding: '14px 16px', background: '#111', paddingBottom: 'env(safe-area-inset-bottom, 14px)' },
  cancelBtn: {
    flex: 1, padding: '14px', background: '#374151', border: 'none',
    borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
  },
  captureBtn: {
    flex: 2, padding: '14px', background: '#1d4ed8', border: 'none',
    borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', transition: 'background 0.15s',
  },
  confirmBtn: {
    flex: 2, padding: '14px', background: '#16a34a', border: 'none',
    borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
  error: { textAlign: 'center', padding: '40px 20px', color: '#fff' },
  errorIcon: { fontSize: 48, marginBottom: 16 },
  errorText: { fontSize: 14, color: '#fca5a5', marginBottom: 20, lineHeight: 1.6 },
};
