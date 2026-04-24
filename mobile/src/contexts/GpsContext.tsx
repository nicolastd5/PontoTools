import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import Geolocation from '@react-native-community/geolocation';

type GpsStatus = 'loading' | 'granted' | 'denied' | 'unavailable';

interface GpsState {
  status: GpsStatus;
  coords: { latitude: number; longitude: number; accuracy: number } | null;
}

const GpsContext = createContext<GpsState>({ status: 'loading', coords: null });

export function GpsProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GpsStatus>('loading');
  const [coords, setCoords] = useState<GpsState['coords']>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    function onPosition(position: { coords: { latitude: number; longitude: number; accuracy: number } }) {
      if (cancelled) return;
      const { latitude, longitude, accuracy } = position.coords;
      setCoords({ latitude, longitude, accuracy });
      setStatus('granted');
    }

    function onError(err: { code: number }) {
      if (cancelled) return;
      setStatus(err.code === 1 ? 'denied' : 'unavailable');
      setCoords(null);
    }

    // 1) Fix instantâneo por rede (baixa precisão) — aparece em ~1-2s
    Geolocation.getCurrentPosition(
      onPosition,
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );

    // 2) Em paralelo, fix preciso por GPS — sobrescreve o anterior quando chegar
    Geolocation.getCurrentPosition(
      onPosition,
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );

    // 3) Watch contínuo para atualizações em tempo real
    watchIdRef.current = Geolocation.watchPosition(
      onPosition,
      onError,
      {
        enableHighAccuracy: true,
        distanceFilter: 3,
        interval: 3000,
        fastestInterval: 1000,
        timeout: 20000,
        maximumAge: 0,
      },
    );

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return <GpsContext.Provider value={{ status, coords }}>{children}</GpsContext.Provider>;
}

export function useGpsContext(): GpsState {
  return useContext(GpsContext);
}
