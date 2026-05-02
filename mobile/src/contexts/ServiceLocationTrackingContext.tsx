import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../services/api';
import {
  useServiceLocationTracker,
  type TrackableService,
} from '../hooks/useServiceLocationTracker';

interface ServiceLocationTrackingState<T extends TrackableService = TrackableService> {
  active: boolean;
  lastSentAt: string | null;
  error: string | null;
  service: T | null;
  syncServices: (services: T[]) => void;
  refreshServices: () => Promise<void>;
}

const ServiceLocationTrackingContext = createContext<ServiceLocationTrackingState>({
  active: false,
  lastSentAt: null,
  error: null,
  service: null,
  syncServices: () => {},
  refreshServices: async () => {},
});

const SERVICE_REFRESH_INTERVAL_MS = 30000;

export function ServiceLocationTrackingProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const [services, setServices] = useState<TrackableService[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const tracking = useServiceLocationTracker(services);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const refreshServices = useCallback(async () => {
    if (!enabled || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const { data } = await api.get('/services');
      if (!mountedRef.current || !enabledRef.current) return;
      setServices(data.services || []);
      setRefreshError(null);
    } catch (err: any) {
      if (!mountedRef.current || !enabledRef.current) return;
      setRefreshError(err?.response?.data?.error || err?.message || 'Nao foi possivel atualizar os servicos rastreados.');
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [enabled]);

  const syncServices = useCallback((nextServices: TrackableService[]) => {
    if (!enabled) return;
    setServices(nextServices || []);
    setRefreshError(null);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setServices([]);
      setRefreshError(null);
      return undefined;
    }

    refreshServices();
    const interval = setInterval(refreshServices, SERVICE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, refreshServices]);

  const value = useMemo(() => ({
    ...tracking,
    error: tracking.error || refreshError,
    syncServices,
    refreshServices,
  }), [refreshError, refreshServices, syncServices, tracking]);

  return (
    <ServiceLocationTrackingContext.Provider value={value}>
      {children}
    </ServiceLocationTrackingContext.Provider>
  );
}

export function useServiceLocationTracking() {
  return useContext(ServiceLocationTrackingContext);
}
