import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGpsContext } from '../contexts/GpsContext';
import api from '../services/api';
import {
  selectTrackedService,
  shouldSendLocationUpdate,
  TRACKING_HEARTBEAT_INTERVAL_MS,
  type SentLocationSnapshot,
  type TrackableService,
} from './serviceLocationTrackerUtils';

export type { TrackableService };

interface TrackingState<T extends TrackableService> {
  active: boolean;
  lastSentAt: string | null;
  error: string | null;
  service: T | null;
}

interface TrackingOptions {
  postUpdates?: boolean;
}

export function useServiceLocationTracker<T extends TrackableService>(
  services: T[] = [],
  options: TrackingOptions = {},
): TrackingState<T> {
  const { coords } = useGpsContext();
  const postUpdates = options.postUpdates ?? true;
  const service = useMemo(() => selectTrackedService(services), [services]);
  const [active, setActive] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const coordsRef = useRef(coords);
  const serviceRef = useRef(service);
  const inFlightServiceIdsRef = useRef(new Set<string>());
  const lastSentSnapshotRef = useRef<SentLocationSnapshot | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  useEffect(() => {
    if (String(serviceRef.current?.id ?? '') !== String(service?.id ?? '')) {
      lastSentSnapshotRef.current = null;
      setActive(false);
      setLastSentAt(null);
    }
    serviceRef.current = service;
  }, [service]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const sendLocation = useCallback(async () => {
    const currentService = serviceRef.current;
    const currentCoords = coordsRef.current;

    if (!currentService) {
      if (mountedRef.current) {
        setActive(false);
        setError(null);
      }
      return;
    }

    if (!currentCoords) {
      if (mountedRef.current) {
        setActive(false);
        setError('GPS indisponivel para compartilhamento.');
      }
      return;
    }

    const serviceId = String(currentService.id);
    const latitude = Number(currentCoords.latitude);
    const longitude = Number(currentCoords.longitude);
    const accuracy = currentCoords.accuracy == null ? null : Number(currentCoords.accuracy);
    const recordedAtMs = Date.now();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      if (mountedRef.current) {
        setActive(false);
        setError('GPS indisponivel para compartilhamento.');
      }
      return;
    }

    if (!shouldSendLocationUpdate({
      previous: lastSentSnapshotRef.current,
      next: { serviceId, latitude, longitude, recordedAtMs },
    })) {
      return;
    }

    if (inFlightServiceIdsRef.current.has(serviceId)) return;
    inFlightServiceIdsRef.current.add(serviceId);

    const recordedAt = new Date(recordedAtMs).toISOString();

    try {
      if (String(serviceRef.current?.id ?? '') !== serviceId) return;

      await api.post('/service-tracking/location', {
        service_order_id: serviceId,
        latitude,
        longitude,
        accuracy_meters: Number.isFinite(accuracy) ? accuracy : null,
        source: 'mobile',
        recorded_at: recordedAt,
      });

      if (mountedRef.current && String(serviceRef.current?.id ?? '') === serviceId) {
        lastSentSnapshotRef.current = {
          serviceId,
          latitude,
          longitude,
          sentAtMs: recordedAtMs,
        };
        setActive(true);
        setLastSentAt(recordedAt);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current && String(serviceRef.current?.id ?? '') === serviceId) {
        setActive(false);
        setError(err?.response?.data?.error || err?.message || 'Nao foi possivel compartilhar a localizacao.');
      }
    } finally {
      inFlightServiceIdsRef.current.delete(serviceId);
    }
  }, []);

  useEffect(() => {
    if (!service) {
      setActive(false);
      setError(null);
      return;
    }

    if (!postUpdates) {
      setActive(true);
      setError(null);
      return;
    }

    if (!coords) {
      setActive(false);
      setError('GPS indisponivel para compartilhamento.');
      return;
    }

    setError(null);
    sendLocation();
  }, [postUpdates, service?.id, coords?.latitude, coords?.longitude, coords?.accuracy, sendLocation]);

  useEffect(() => {
    if (!postUpdates) return undefined;
    if (!service) return undefined;
    const interval = setInterval(sendLocation, TRACKING_HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [postUpdates, sendLocation, service?.id]);

  return { active, lastSentAt, error, service };
}
