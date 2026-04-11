// Hook de câmera ao vivo — captura via canvas (sem input file)
import { useState, useRef, useCallback } from 'react';

/**
 * Gerencia o ciclo de vida da câmera:
 * open(facing?) → stream → captura → blob → stop()
 *
 * @returns {{
 *   videoRef:      React.Ref       - ref para o elemento <video>
 *   isOpen:        boolean         - câmera ativa
 *   error:         string | null   - mensagem de erro
 *   facing:        'user'|'environment' - câmera atual
 *   open:          (facing?) => Promise   - inicia câmera
 *   stop:          () => void      - para câmera
 *   switchCamera:  () => Promise   - alterna frontal/traseira
 *   capture:       () => Promise<Blob> - captura frame atual
 * }}
 */
export function useCamera() {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [isOpen,  setIsOpen]  = useState(false);
  const [error,   setError]   = useState(null);
  const [facing,  setFacing]  = useState('user');

  const open = useCallback(async (facingMode = 'user') => {
    setError(null);

    // Para stream anterior se houver
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setFacing(facingMode);
      setIsOpen(true);
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError'  ? 'Permissão de câmera negada. Habilite a câmera nas configurações do navegador.' :
        err.name === 'NotFoundError'    ? 'Nenhuma câmera encontrada no dispositivo.' :
        err.name === 'NotReadableError' ? 'Câmera em uso por outro aplicativo.' :
                                          'Erro ao acessar a câmera.';
      setError(msg);
      setIsOpen(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsOpen(false);
  }, []);

  const switchCamera = useCallback(async () => {
    const nextFacing = facing === 'user' ? 'environment' : 'user';
    await open(nextFacing);
  }, [facing, open]);

  /**
   * Captura o frame atual do vídeo como Blob JPEG.
   * Aplica espelho horizontal somente para câmera frontal.
   */
  const capture = useCallback((currentFacing = facing) => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;

      if (!video || !isOpen || video.readyState < 2) {
        reject(new Error('Câmera não está pronta para captura.'));
        return;
      }

      const canvas  = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');

      // Espelha horizontalmente apenas para câmera frontal
      if (currentFacing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else       reject(new Error('Falha ao converter imagem.'));
        },
        'image/jpeg',
        0.85
      );
    });
  }, [isOpen, facing]);

  return { videoRef, isOpen, error, facing, open, stop, switchCamera, capture };
}
