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
          {error ? (
            <div style={styles.error}>
              <div style={styles.errorIcon}>📷</div>
              <div style={styles.errorText}>{error}</div>
              <button onClick={handleCancel} style={styles.cancelBtn}>Fechar</button>
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
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#fff', borderRadius: 16,
    width: '100%', maxWidth: 420, overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
  },
  headerTitle: { fontWeight: 700, fontSize: 15, color: '#0f172a' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#94a3b8' },
  body: { padding: '20px' },
  videoContainer: {
    position: 'relative', background: '#000',
    borderRadius: 12, overflow: 'hidden',
    aspectRatio: '4/3', marginBottom: 14,
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoLoader: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 14,
  },
  switchBtn: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(0,0,0,0.5)', border: 'none',
    borderRadius: '50%', width: 40, height: 40,
    fontSize: 18, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
  },
  hint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 12 },
  thumbRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8, objectFit: 'cover', display: 'block', border: '1px solid #e2e8f0' },
  thumbRemove: {
    position: 'absolute', top: -6, right: -6,
    background: '#dc2626', border: 'none', borderRadius: '50%',
    width: 20, height: 20, color: '#fff', fontSize: 11,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 'bold',
  },
  photoCount: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 12 },
  actions: { display: 'flex', gap: 8 },
  cancelBtn: {
    flex: 1, padding: '12px', background: '#f1f5f9', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#475569',
  },
  captureBtn: {
    flex: 2, padding: '12px', background: '#1d4ed8', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#fff', transition: 'background 0.15s',
  },
  confirmBtn: {
    flex: 2, padding: '12px', background: '#16a34a', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
  error: { textAlign: 'center', padding: '20px 0' },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { fontSize: 13, color: '#dc2626', marginBottom: 16, lineHeight: 1.6 },
};
