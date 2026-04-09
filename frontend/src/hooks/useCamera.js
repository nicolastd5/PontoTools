// Hook de câmera ao vivo — captura via canvas (sem input file)
import { useState, useRef, useCallback } from 'react';

/**
 * Gerencia o ciclo de vida da câmera:
 * open() → stream → captura → blob → stop()
 *
 * @returns {{
 *   videoRef:  React.Ref       - ref para o elemento <video>
 *   isOpen:    boolean         - câmera ativa
 *   error:     string | null   - mensagem de erro
 *   open:      () => Promise   - inicia câmera
 *   stop:      () => void      - para câmera
 *   capture:   () => Promise<Blob> - captura frame atual
 * }}
 */
export function useCamera() {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [isOpen,  setIsOpen]  = useState(false);
  const [error,   setError]   = useState(null);

  const open = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',  // câmera frontal por padrão
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

  /**
   * Captura o frame atual do vídeo como Blob JPEG.
   * Retorna null se o vídeo não estiver ativo.
   */
  const capture = useCallback(() => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;

      if (!video || !isOpen || video.readyState < 2) {
        reject(new Error('Câmera não está pronta para captura.'));
        return;
      }

      // Cria canvas com as dimensões reais do vídeo
      const canvas  = document.createElement('canvas');
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');

      // Espelha horizontalmente para câmera frontal (efeito espelho natural)
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);

      // Converte para Blob JPEG (qualidade 85%)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else       reject(new Error('Falha ao converter imagem.'));
        },
        'image/jpeg',
        0.85
      );
    });
  }, [isOpen]);

  return { videoRef, isOpen, error, open, stop, capture };
}
