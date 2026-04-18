import { useState, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

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

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Permissão de Localização',
        message: 'O app precisa acessar sua localização para registrar.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Negar',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: permissão é pedida automaticamente pelo sistema ao chamar watchPosition
  return true;
}

export function useGeolocation(unit: Unit | null | undefined) {
  const [status, setStatus]                 = useState<GpsStatus>('loading');
  const [coords, setCoords]                 = useState<Coords | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const hasPermission = await requestLocationPermission();
      if (cancelled) return;

      if (!hasPermission) {
        setStatus('denied');
        return;
      }

      watchIdRef.current = Geolocation.watchPosition(
        (position) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy } = position.coords;
          setCoords({ latitude, longitude, accuracy });
          setStatus('granted');
          if (unit?.latitude != null && unit?.longitude != null) {
            const dist = haversineDistance(latitude, longitude, unit.latitude, unit.longitude);
            setDistanceMeters(Math.round(dist * 10) / 10);
          }
        },
        (err) => {
          if (cancelled) return;
          // code 1 = PERMISSION_DENIED, code 2 = POSITION_UNAVAILABLE
          setStatus(err.code === 1 ? 'denied' : 'unavailable');
          setCoords(null);
        },
        { enableHighAccuracy: true, distanceFilter: 5, interval: 5000, fastestInterval: 2000 },
      );
    })();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [unit]);

  const isInsideZone = Boolean(
    unit?.radiusMeters && distanceMeters !== null && distanceMeters <= unit.radiusMeters,
  );

  return { status, coords, distanceMeters, isInsideZone };
}
