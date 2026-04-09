// Modal de captura de foto ao vivo — sem input file, apenas canvas
import { useEffect } from 'react';
import { useCamera } from '../../hooks/useCamera';

/**
 * @param {{ clockType: string, onCapture: (blob) => void, onCancel: () => void }} props
 */
export default function CameraCapture({ clockType, onCapture, onCancel }) {
  const { videoRef, isOpen, error, open, stop, capture } = useCamera();

  const LABELS = {
    entry: 'Entrada', exit: 'Saída',
    break_start: 'Início de Intervalo', break_end: 'Fim de Intervalo',
  };

  // Abre câmera ao montar o modal
  useEffect(() => {
    open();
    // Para a câmera ao desmontar (fechar modal)
    return () => stop();
  }, []); // eslint-disable-line

  async function handleCapture() {
    try {
      const blob = await capture();
      stop(); // para a câmera imediatamente após capturar
      onCapture(blob);
    } catch (err) {
      console.error('Erro ao capturar foto:', err);
    }
  }

  function handleCancel() {
    stop();
    onCancel();
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>
            Registrar — {LABELS[clockType] || clockType}
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
              {/* Preview da câmera ao vivo */}
              <div style={styles.videoContainer}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    ...styles.video,
                    // Espelha horizontalmente (natural para câmera frontal)
                    transform: 'scaleX(-1)',
                  }}
                />
                {!isOpen && (
                  <div style={styles.videoLoader}>
                    Iniciando câmera...
                  </div>
                )}
              </div>

              <p style={styles.hint}>
                Posicione seu rosto no centro e clique em Capturar
              </p>

              <div style={styles.actions}>
                <button onClick={handleCancel} style={styles.cancelBtn}>
                  Cancelar
                </button>
                <button
                  onClick={handleCapture}
                  disabled={!isOpen}
                  style={{
                    ...styles.captureBtn,
                    opacity: isOpen ? 1 : 0.5,
                    cursor:  isOpen ? 'pointer' : 'not-allowed',
                  }}
                >
                  📸 Capturar
                </button>
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
    position:       'fixed', inset: 0,
    background:     'rgba(0,0,0,0.85)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         1000,
    padding:        16,
  },
  modal: {
    background:   '#fff',
    borderRadius: 16,
    width:        '100%',
    maxWidth:     420,
    overflow:     'hidden',
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '16px 20px',
    borderBottom:   '1px solid #f1f5f9',
  },
  headerTitle: { fontWeight: 700, fontSize: 15, color: '#0f172a' },
  closeBtn: {
    background: 'none', border: 'none',
    fontSize: 18, cursor: 'pointer', color: '#94a3b8',
  },
  body: { padding: '20px' },
  videoContainer: {
    position:     'relative',
    background:   '#000',
    borderRadius: 12,
    overflow:     'hidden',
    aspectRatio:  '4/3',
    marginBottom: 14,
  },
  video: {
    width: '100%', height: '100%',
    objectFit: 'cover', display: 'block',
  },
  videoLoader: {
    position:       'absolute', inset: 0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          '#fff',
    fontSize:       14,
  },
  hint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 16 },
  actions: { display: 'flex', gap: 10 },
  cancelBtn: {
    flex:         1,
    padding:      '12px',
    background:   '#f1f5f9',
    border:       'none',
    borderRadius: 10,
    fontSize:     15,
    fontWeight:   600,
    cursor:       'pointer',
    color:        '#475569',
  },
  captureBtn: {
    flex:         2,
    padding:      '12px',
    background:   '#1d4ed8',
    border:       'none',
    borderRadius: 10,
    fontSize:     15,
    fontWeight:   700,
    color:        '#fff',
    transition:   'background 0.15s',
  },
  error: { textAlign: 'center', padding: '20px 0' },
  errorIcon: { fontSize: 40, marginBottom: 12 },
  errorText: { fontSize: 13, color: '#dc2626', marginBottom: 16, lineHeight: 1.6 },
};
