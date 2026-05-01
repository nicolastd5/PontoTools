import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

const TRACKED_STATUSES = ['pending', 'in_progress'];
const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 10000,
  timeout: 15000,
};
const TRACKING_INTERVAL_MS = 30000;

function selectTrackedService(services) {
  const trackable = services.filter((service) => TRACKED_STATUSES.includes(service.status));
  return trackable.find((service) => service.status === 'in_progress') || trackable[0] || null;
}

export function useServiceLocationTracker(services = []) {
  const [lastSentAt, setLastSentAt] = useState(null);
  const [error, setError] = useState(null);
  const sendingRef = useRef(false);

  const service = useMemo(() => selectTrackedService(services), [services]);
  const hasGeolocation = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  const active = Boolean(service && hasGeolocation);

  useEffect(() => {
    if (!service || !hasGeolocation) return undefined;

    let cancelled = false;
    let intervalId = null;

    function sendLocation() {
      if (sendingRef.current || cancelled) return;

      sendingRef.current = true;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const recordedAt = new Date().toISOString();

          try {
            await api.post('/service-tracking/location', {
              service_order_id: service.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy_meters: position.coords.accuracy,
              source: 'web',
              recorded_at: recordedAt,
            });

            if (!cancelled) {
              setLastSentAt(recordedAt);
              setError(null);
            }
          } catch (err) {
            if (!cancelled) {
              setError(err.response?.data?.error || err.message || 'Erro ao compartilhar localizacao.');
            }
          } finally {
            sendingRef.current = false;
          }
        },
        (geoError) => {
          if (!cancelled) {
            setError(geoError.message || 'Erro ao obter localizacao.');
          }
          sendingRef.current = false;
        },
        GEOLOCATION_OPTIONS,
      );
    }

    sendLocation();
    intervalId = setInterval(sendLocation, TRACKING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [hasGeolocation, service?.id]);

  return { active, lastSentAt, error, service };
}
