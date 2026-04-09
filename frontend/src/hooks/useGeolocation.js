// Hook de geolocalização contínua com validação de zona
import { useState, useEffect, useRef, useCallback } from 'react';

// Fórmula de Haversine para calcular distância (mesma do backend)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Monitoramento de GPS em tempo real.
 *
 * @param {{ latitude: number, longitude: number, radiusMeters: number }} unit
 *   Coordenadas e raio da unidade para validação de zona.
 *
 * @returns {{
 *   status:         'loading' | 'granted' | 'denied' | 'unavailable',
 *   coords:         { latitude, longitude, accuracy } | null,
 *   distanceMeters: number | null,
 *   isInsideZone:   boolean,
 * }}
 */
export function useGeolocation(unit) {
  const [status,          setStatus]          = useState('loading');
  const [coords,          setCoords]          = useState(null);
  const [distanceMeters,  setDistanceMeters]  = useState(null);
  const watchIdRef = useRef(null);

  const handleSuccess = useCallback((position) => {
    const { latitude, longitude, accuracy } = position.coords;
    setCoords({ latitude, longitude, accuracy });
    setStatus('granted');

    if (unit?.latitude && unit?.longitude) {
      const dist = haversineDistance(latitude, longitude, unit.latitude, unit.longitude);
      setDistanceMeters(Math.round(dist * 10) / 10);
    }
  }, [unit]);

  const handleError = useCallback((err) => {
    // Código 1 = PERMISSION_DENIED
    if (err.code === 1) {
      setStatus('denied');
    } else {
      // Código 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
      setStatus('unavailable');
    }
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    // Verifica permissão atual antes de iniciar o watch
    navigator.permissions?.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'denied') {
        setStatus('denied');
        return;
      }

      // Inicia monitoramento contínuo
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge:         0,         // nunca usa cache
          timeout:            15000,     // 15s para obter posição
        }
      );
    }).catch(() => {
      // Fallback: tenta watchPosition diretamente (navegadores sem permissions API)
      watchIdRef.current = navigator.geolocation.watchPosition(
        handleSuccess,
        handleError,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [handleSuccess, handleError]);

  const isInsideZone = Boolean(
    unit?.radiusMeters &&
    distanceMeters !== null &&
    distanceMeters <= unit.radiusMeters
  );

  return { status, coords, distanceMeters, isInsideZone };
}
