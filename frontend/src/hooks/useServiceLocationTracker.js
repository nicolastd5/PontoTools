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
  const [sharingActive, setSharingActive] = useState(false);
  const sendingRef = useRef(false);
  const currentServiceRef = useRef(null);

  const service = useMemo(() => selectTrackedService(services), [services]);
  currentServiceRef.current = service;

  const hasGeolocation = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  const active = Boolean(service && hasGeolocation && sharingActive);

  useEffect(() => {
    setSharingActive(false);

    if (!service || !hasGeolocation) return undefined;

    let cancelled = false;
    let intervalId = null;
    const trackedServiceId = service.id;

    function isCurrentTrackedService() {
      return !cancelled && currentServiceRef.current?.id === trackedServiceId;
    }

    function sendLocation() {
      if (sendingRef.current || cancelled) return;

      sendingRef.current = true;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const recordedAt = new Date().toISOString();

          if (!isCurrentTrackedService()) {
            sendingRef.current = false;
            return;
          }

          try {
            await api.post('/service-tracking/location', {
              service_order_id: trackedServiceId,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy_meters: position.coords.accuracy,
              source: 'web',
              recorded_at: recordedAt,
            });

            if (isCurrentTrackedService()) {
              setLastSentAt(recordedAt);
              setError(null);
              setSharingActive(true);
            }
          } catch (err) {
            if (isCurrentTrackedService()) {
              setError(err.response?.data?.error || err.message || 'Erro ao compartilhar localizacao.');
              setSharingActive(false);
            }
          } finally {
            sendingRef.current = false;
          }
        },
        (geoError) => {
          if (isCurrentTrackedService()) {
            setError(geoError.message || 'Erro ao obter localizacao.');
            setSharingActive(false);
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
