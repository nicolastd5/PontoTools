import { useEffect, useMemo, useRef, useState } from 'react';
import { useGpsContext } from '../contexts/GpsContext';
import api from '../services/api';

type TrackableStatus = 'pending' | 'in_progress' | string;

export interface TrackableService {
  id: number | string;
  status: TrackableStatus;
}

interface TrackingState<T extends TrackableService> {
  active: boolean;
  lastSentAt: string | null;
  error: string | null;
  service: T | null;
}

const TRACKING_INTERVAL_MS = 30000;

function pickTrackedService<T extends TrackableService>(services: T[]): T | null {
  const inProgress = services.find((service) => service.status === 'in_progress');
  if (inProgress) return inProgress;
  return services.find((service) => service.status === 'pending') ?? null;
}

export function useServiceLocationTracker<T extends TrackableService>(
  services: T[] = [],
): TrackingState<T> {
  const { coords } = useGpsContext();
  const service = useMemo(() => pickTrackedService(services), [services]);
  const [active, setActive] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const coordsRef = useRef(coords);
  const serviceRef = useRef(service);
  const inFlightServiceIdsRef = useRef(new Set<TrackableService['id']>());
  const generationRef = useRef(0);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  useEffect(() => {
    serviceRef.current = service;
  }, [service]);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function sendLocation() {
      const currentService = serviceRef.current;
      const currentCoords = coordsRef.current;

      if (!currentService) {
        setActive(false);
        setError(null);
        return;
      }

      if (!currentCoords) {
        setActive(false);
        setError('GPS indisponivel para compartilhamento.');
        return;
      }

      const serviceId = currentService.id;
      if (inFlightServiceIdsRef.current.has(serviceId)) return;

      inFlightServiceIdsRef.current.add(serviceId);
      const recordedAt = new Date().toISOString();

      try {
        if (generationRef.current !== generation || serviceRef.current?.id !== serviceId) {
          return;
        }

        await api.post('/service-tracking/location', {
          service_order_id: serviceId,
          latitude: currentCoords.latitude,
          longitude: currentCoords.longitude,
          accuracy_meters: currentCoords.accuracy,
          source: 'mobile',
          recorded_at: recordedAt,
        });

        if (generationRef.current === generation && serviceRef.current?.id === serviceId) {
          setActive(true);
          setLastSentAt(recordedAt);
          setError(null);
        }
      } catch (err: any) {
        if (generationRef.current === generation && serviceRef.current?.id === serviceId) {
          setActive(false);
          setError(err?.response?.data?.error || err?.message || 'Nao foi possivel compartilhar a localizacao.');
        }
      } finally {
        inFlightServiceIdsRef.current.delete(serviceId);
      }
    }

    setActive(false);

    if (!service) {
      setError(null);
      return () => {
        generationRef.current += 1;
      };
    }

    if (!coords) {
      setError('GPS indisponivel para compartilhamento.');
      return () => {
        generationRef.current += 1;
      };
    }

    setError(null);
    sendLocation();
    interval = setInterval(sendLocation, TRACKING_INTERVAL_MS);

    return () => {
      generationRef.current += 1;
      if (interval) clearInterval(interval);
    };
  }, [service?.id, coords !== null]);

  return { active, lastSentAt, error, service };
}
