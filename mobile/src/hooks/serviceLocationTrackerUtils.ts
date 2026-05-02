export type TrackableStatus = 'pending' | 'in_progress' | string;

export interface TrackableService {
  id: number | string;
  status: TrackableStatus;
}

export interface SentLocationSnapshot {
  serviceId: number | string;
  latitude: number;
  longitude: number;
  sentAtMs: number;
}

export interface PendingLocationSnapshot {
  serviceId: number | string;
  latitude: number;
  longitude: number;
  recordedAtMs: number;
}

export const TRACKED_STATUSES = ['pending', 'in_progress'];
export const REALTIME_MIN_SEND_INTERVAL_MS = 5000;
export const TRACKING_HEARTBEAT_INTERVAL_MS = 30000;
export const REALTIME_MIN_DISTANCE_METERS = 5;

export function selectTrackedService<T extends TrackableService>(services: T[]): T | null {
  const trackable = services.filter((service) => TRACKED_STATUSES.includes(service.status));
  return trackable.find((service) => service.status === 'in_progress') || trackable[0] || null;
}

export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusMeters = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function shouldSendLocationUpdate({
  previous,
  next,
  minIntervalMs = REALTIME_MIN_SEND_INTERVAL_MS,
  minDistanceMeters = REALTIME_MIN_DISTANCE_METERS,
  heartbeatIntervalMs = TRACKING_HEARTBEAT_INTERVAL_MS,
}: {
  previous: SentLocationSnapshot | null;
  next: PendingLocationSnapshot;
  minIntervalMs?: number;
  minDistanceMeters?: number;
  heartbeatIntervalMs?: number;
}): boolean {
  if (!previous) return true;
  if (String(previous.serviceId) !== String(next.serviceId)) return true;

  const elapsedMs = next.recordedAtMs - previous.sentAtMs;
  if (elapsedMs >= heartbeatIntervalMs) return true;
  if (elapsedMs < minIntervalMs) return false;

  return distanceMeters(
    previous.latitude,
    previous.longitude,
    next.latitude,
    next.longitude,
  ) >= minDistanceMeters;
}
