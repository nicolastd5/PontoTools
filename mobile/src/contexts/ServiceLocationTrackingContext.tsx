import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { BASE_URL } from '../services/api';
import { getAuthTokensUpdatedAt, saveAuthTokens } from '../services/authTokenStorage';
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
const ACCESS_BACKGROUND_LOCATION = 'android.permission.ACCESS_BACKGROUND_LOCATION' as any;
const nativeTracker = Platform.OS === 'android'
  ? NativeModules.BackgroundLocationTracking
  : null;
const hasNativeBackgroundTracker = Boolean(nativeTracker?.startTracking);

export function ServiceLocationTrackingProvider({
  children,
  enabled,
  userId,
}: {
  children: React.ReactNode;
  enabled: boolean;
  userId: number | string;
}) {
  const [services, setServices] = useState<TrackableService[]>([]);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [nativeStartedAt, setNativeStartedAt] = useState<string | null>(null);
  const [nativeLastSentAt, setNativeLastSentAt] = useState<string | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [nativeConfigVersion, setNativeConfigVersion] = useState(0);
  const tracking = useServiceLocationTracker(services, {
    postUpdates: !hasNativeBackgroundTracker,
  });
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const refreshInFlightRef = useRef(false);
  const nativeServiceIdRef = useRef<string | null>(null);
  const backgroundPermissionRequestedRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const syncNativeTokensToStorage = useCallback(async () => {
    if (!hasNativeBackgroundTracker || !nativeTracker?.getStoredTokens) return;

    const tokens = await nativeTracker.getStoredTokens();
    if (String(tokens?.userId ?? '') !== String(userId)) return;
    if (
      mountedRef.current &&
      tokens?.lastSentAt &&
      String(tokens?.serviceId ?? '') === String(nativeServiceIdRef.current ?? '')
    ) {
      setNativeLastSentAt(tokens.lastSentAt);
    }

    if (!tokens?.accessToken || !tokens?.refreshToken) return;

    const nativeUpdatedAt = Number(tokens?.updatedAtMs ?? 0);
    const localUpdatedAt = await getAuthTokensUpdatedAt();
    if (!Number.isFinite(nativeUpdatedAt) || nativeUpdatedAt <= localUpdatedAt) return;

    await saveAuthTokens(tokens.accessToken, tokens.refreshToken, nativeUpdatedAt);
  }, [userId]);

  const ensureBackgroundLocationPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 29) return true;

    const alreadyGranted = await PermissionsAndroid.check(ACCESS_BACKGROUND_LOCATION);
    if (alreadyGranted) {
      backgroundPermissionRequestedRef.current = false;
      return true;
    }

    if (backgroundPermissionRequestedRef.current) return false;
    backgroundPermissionRequestedRef.current = true;

    const result = await PermissionsAndroid.request(
      ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Localizacao em segundo plano',
        message: 'Permita a localizacao o tempo todo para rastrear somente enquanto houver servico pendente ou em andamento.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Negar',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const refreshServices = useCallback(async () => {
    if (!enabled || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      await syncNativeTokensToStorage();
      const { data } = await api.get('/services');
      if (!mountedRef.current || !enabledRef.current) return;
      setServices(data.services || []);
      setRefreshError(null);
      if (hasNativeBackgroundTracker) {
        setNativeConfigVersion((version) => version + 1);
      }
    } catch (err: any) {
      if (!mountedRef.current || !enabledRef.current) return;
      setRefreshError(err?.response?.data?.error || err?.message || 'Nao foi possivel atualizar os servicos rastreados.');
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [enabled, syncNativeTokensToStorage]);

  const syncServices = useCallback((nextServices: TrackableService[]) => {
    if (!enabled) return;
    setServices(nextServices || []);
    setRefreshError(null);
    if (hasNativeBackgroundTracker) {
      setNativeConfigVersion((version) => version + 1);
    }
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

  useEffect(() => {
    if (!hasNativeBackgroundTracker) return undefined;

    let cancelled = false;
    const serviceId = tracking.service?.id;

    async function syncNativeService() {
      if (!enabled || !serviceId) {
        await nativeTracker.stopTracking().catch(() => {});
        if (!cancelled) {
          nativeServiceIdRef.current = null;
          setNativeStartedAt(null);
          setNativeLastSentAt(null);
          setNativeError(null);
        }
        return;
      }

      try {
        await syncNativeTokensToStorage();
        const hasBackgroundPermission = await ensureBackgroundLocationPermission();
        if (!hasBackgroundPermission) {
          throw new Error('Permita a localizacao o tempo todo para rastrear este servico em segundo plano.');
        }

        const [accessToken, refreshToken] = await Promise.all([
          AsyncStorage.getItem('accessToken'),
          AsyncStorage.getItem('refreshToken'),
        ]);

        if (!accessToken || !refreshToken) {
          throw new Error('Tokens ausentes para rastreamento em segundo plano.');
        }

        await nativeTracker.startTracking({
          baseUrl: BASE_URL,
          serviceId: String(serviceId),
          userId: String(userId),
          accessToken,
          refreshToken,
        });

        if (!cancelled) {
          const nextServiceId = String(serviceId);
          const serviceChanged = nativeServiceIdRef.current !== nextServiceId;
          nativeServiceIdRef.current = nextServiceId;
          if (serviceChanged) {
            setNativeLastSentAt(null);
          }
          setNativeStartedAt((current) => (serviceChanged || !current ? new Date().toISOString() : current));
          setNativeError(null);
        }
      } catch (err: any) {
        nativeTracker.stopTracking().catch(() => {});
        if (!cancelled) {
          nativeServiceIdRef.current = null;
          setNativeStartedAt(null);
          setNativeLastSentAt(null);
          setNativeError(err?.message || 'Nao foi possivel iniciar o rastreamento em segundo plano.');
        }
      }
    }

    syncNativeService();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    ensureBackgroundLocationPermission,
    nativeConfigVersion,
    syncNativeTokensToStorage,
    tracking.service?.id,
    userId,
  ]);

  useEffect(() => () => {
    if (hasNativeBackgroundTracker) {
      nativeTracker.stopTracking().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!enabled || !hasNativeBackgroundTracker) return undefined;
    const interval = setInterval(() => {
      syncNativeTokensToStorage().catch(() => {});
    }, SERVICE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, syncNativeTokensToStorage]);

  useEffect(() => {
    if (!enabled || !hasNativeBackgroundTracker) return undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        backgroundPermissionRequestedRef.current = false;
        syncNativeTokensToStorage()
          .then(refreshServices)
          .catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [enabled, refreshServices, syncNativeTokensToStorage]);

  const value = useMemo(() => ({
    ...tracking,
    active: hasNativeBackgroundTracker
      ? Boolean(tracking.service && nativeStartedAt && !nativeError)
      : tracking.active,
    lastSentAt: hasNativeBackgroundTracker
      ? nativeLastSentAt
      : tracking.lastSentAt,
    error: nativeError || tracking.error || refreshError,
    syncServices,
    refreshServices,
  }), [nativeError, nativeLastSentAt, nativeStartedAt, refreshError, refreshServices, syncServices, tracking]);

  return (
    <ServiceLocationTrackingContext.Provider value={value}>
      {children}
    </ServiceLocationTrackingContext.Provider>
  );
}

export function useServiceLocationTracking() {
  return useContext(ServiceLocationTrackingContext);
}
