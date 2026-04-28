// Importa apenas nextWeekday — não carrega webpush/fcm/db
jest.mock('../config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }));
jest.mock('../services/fcm.service', () => ({ sendFcm: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));

const { nextWeekday } = require('../services/push.service');

// Helpers
const day = (yyyy, mm, dd) => new Date(Date.UTC(yyyy, mm - 1, dd));

describe('nextWeekday', () => {
  // bitmask: bit0=Dom(0), bit1=Seg(1), ..., bit6=Sáb(6)
  const SAB = 1 << 6; // 64
  const DOM = 1 << 0; // 1
  const SAB_DOM = SAB | DOM; // 65

  test('sábado marcado: próximo a partir de domingo é sábado seguinte', () => {
    // fromDate = domingo 2026-05-03
    const result = nextWeekday(day(2026, 5, 3), SAB);
    expect(result).toEqual(day(2026, 5, 9)); // sábado 2026-05-09
  });

  test('sábado+domingo marcados: próximo a partir de sábado é domingo seguinte', () => {
    // fromDate = sábado 2026-05-02
    const result = nextWeekday(day(2026, 5, 2), SAB_DOM);
    expect(result).toEqual(day(2026, 5, 3)); // domingo 2026-05-03
  });

  test('sábado+domingo marcados: próximo a partir de domingo é sábado seguinte', () => {
    // fromDate = domingo 2026-05-03
    const result = nextWeekday(day(2026, 5, 3), SAB_DOM);
    expect(result).toEqual(day(2026, 5, 9)); // sábado 2026-05-09
  });

  test('apenas segunda marcada: próximo a partir de quarta é segunda seguinte', () => {
    const SEG = 1 << 1; // 2
    // fromDate = quarta 2026-04-29
    const result = nextWeekday(day(2026, 4, 29), SEG);
    expect(result).toEqual(day(2026, 5, 4)); // segunda 2026-05-04
  });

  test('bitmask 0 (inválido): retorna null', () => {
    const result = nextWeekday(day(2026, 5, 2), 0);
    expect(result).toBeNull();
  });

  test('fromDate é o próprio dia marcado: retorna o próximo, não o mesmo dia', () => {
    // fromDate = sábado 2026-05-02, bitmask só sábado
    const result = nextWeekday(day(2026, 5, 2), SAB);
    expect(result).toEqual(day(2026, 5, 9)); // sábado seguinte
  });

  test('virada de ano: fromDate em 29/12 (segunda), próximo domingo é 04/01 do ano seguinte', () => {
    const result = nextWeekday(day(2025, 12, 29), DOM);
    expect(result).toEqual(day(2026, 1, 4)); // domingo 2026-01-04
  });
});
