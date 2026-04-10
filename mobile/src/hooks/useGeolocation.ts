import { useState, useEffect, useRef } from 'react';

interface Unit {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

type GpsStatus = 'loading' | 'granted' | 'denied' | 'unavailable';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeolocation(unit: Unit | null | undefined) {
  const [status, setStatus]                 = useState<GpsStatus>('loading');
  const [coords, setCoords]                 = useState<Coords | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({ latitude, longitude, accuracy });
        setStatus('granted');
        if (unit?.latitude && unit?.longitude) {
          const dist = haversineDistance(latitude, longitude, unit.latitude, unit.longitude);
          setDistanceMeters(Math.round(dist * 10) / 10);
        }
      },
      (err) => {
        setStatus(err.code === 1 ? 'denied' : 'unavailable');
        setCoords(null);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current!);
    };
  }, [unit]);

  const isInsideZone = Boolean(
    unit?.radiusMeters && distanceMeters !== null && distanceMeters <= unit.radiusMeters,
  );

  return { status, coords, distanceMeters, isInsideZone };
}
