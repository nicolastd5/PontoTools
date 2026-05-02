import { useState, useEffect, useRef } from 'react';

interface Coords { latitude: number; longitude: number; }

export function useReverseGeocode(coords: Coords | null) {
  const [address, setAddress] = useState<string | null>(null);
  const lastFetchRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!coords) { setAddress(null); return; }

    const { latitude: lat, longitude: lon } = coords;

    // Só re-busca se moveu mais de ~50m (≈0.0005 grau) para evitar spam na API
    const last = lastFetchRef.current;
    if (last && Math.abs(last.lat - lat) < 0.0005 && Math.abs(last.lon - lon) < 0.0005) return;

    lastFetchRef.current = { lat, lon };
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const doFetch = (attempt: number): Promise<void> =>
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt-BR&zoom=18`,
        { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'PontoTools/1.0 (pontotools.shop)' } },
      )
        .then((r) => {
          if (!r.ok) throw new Error(`Reverse geocode failed: ${r.status}`);
          return r.json();
        })
        .then((data) => {
          if (cancelled) return;
          const a = data.address ?? {};
          const parts = [
            a.road ?? a.pedestrian ?? a.footway,
            a.house_number,
            a.suburb ?? a.neighbourhood ?? a.quarter,
            a.city ?? a.town ?? a.village ?? a.municipality,
            a.state,
          ].filter(Boolean);
          setAddress(parts.length ? parts.join(', ') : data.display_name ?? null);
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 1) return doFetch(attempt + 1);
          setAddress(null);
        });

    doFetch(0).finally(() => clearTimeout(timeoutId));

    return () => { cancelled = true; clearTimeout(timeoutId); controller.abort(); };
  }, [coords?.latitude, coords?.longitude]);

  return address;
}
