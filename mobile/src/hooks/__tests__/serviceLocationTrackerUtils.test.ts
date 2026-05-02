import {
  selectTrackedService,
  shouldSendLocationUpdate,
} from '../serviceLocationTrackerUtils';

describe('serviceLocationTrackerUtils', () => {
  test('prioritizes in_progress service over pending services', () => {
    const pending = { id: 1, status: 'pending' };
    const inProgress = { id: 2, status: 'in_progress' };

    expect(selectTrackedService([pending, inProgress])).toBe(inProgress);
  });

  test('ignores services that are not pending or in_progress', () => {
    expect(selectTrackedService([
      { id: 1, status: 'done' },
      { id: 2, status: 'problem' },
    ])).toBeNull();
  });

  test('sends first point immediately', () => {
    expect(shouldSendLocationUpdate({
      previous: null,
      next: {
        serviceId: 7,
        latitude: -23.55,
        longitude: -46.63,
        recordedAtMs: 1000,
      },
    })).toBe(true);
  });

  test('throttles tiny movements before the minimum interval', () => {
    expect(shouldSendLocationUpdate({
      previous: {
        serviceId: 7,
        latitude: -23.55,
        longitude: -46.63,
        sentAtMs: 1000,
      },
      next: {
        serviceId: 7,
        latitude: -23.55001,
        longitude: -46.63001,
        recordedAtMs: 3000,
      },
      minIntervalMs: 5000,
      minDistanceMeters: 5,
      heartbeatIntervalMs: 30000,
    })).toBe(false);
  });

  test('sends moved points after the minimum interval', () => {
    expect(shouldSendLocationUpdate({
      previous: {
        serviceId: 7,
        latitude: -23.55,
        longitude: -46.63,
        sentAtMs: 1000,
      },
      next: {
        serviceId: 7,
        latitude: -23.5501,
        longitude: -46.6301,
        recordedAtMs: 7000,
      },
      minIntervalMs: 5000,
      minDistanceMeters: 5,
      heartbeatIntervalMs: 30000,
    })).toBe(true);
  });

  test('sends heartbeat even if the person has not moved', () => {
    expect(shouldSendLocationUpdate({
      previous: {
        serviceId: 7,
        latitude: -23.55,
        longitude: -46.63,
        sentAtMs: 1000,
      },
      next: {
        serviceId: 7,
        latitude: -23.55,
        longitude: -46.63,
        recordedAtMs: 32000,
      },
      minIntervalMs: 5000,
      minDistanceMeters: 5,
      heartbeatIntervalMs: 30000,
    })).toBe(true);
  });
});
