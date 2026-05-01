jest.mock('../config/database', () => ({ query: jest.fn() }));

const db = require('../config/database');
const { postLocation, listLive } = require('../controllers/serviceTracking.controller');

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe('serviceTracking.controller', () => {
  let next;

  beforeEach(() => {
    db.query.mockReset();
    next = jest.fn();
  });

  describe('postLocation', () => {
    test.each(['admin', 'gestor'])('rejects %s with 403 and does not query DB', async (role) => {
      const req = {
        user: { id: 2, role },
        body: { service_order_id: 10, latitude: -23.5, longitude: -46.6 },
      };
      const res = createRes();

      await postLocation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Apenas funcionarios podem enviar localizacao.' });
      expect(db.query).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects invalid coordinates with 400 and does not query DB', async () => {
      const req = {
        user: { id: 2, role: 'employee' },
        body: { service_order_id: 10, latitude: -91, longitude: -46.6 },
      };
      const res = createRes();

      await postLocation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Coordenadas invalidas.' });
      expect(db.query).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects nonexistent/not eligible service with 403', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const req = {
        user: { id: 2, role: 'employee' },
        body: { service_order_id: 10, latitude: -23.5, longitude: -46.6 },
      };
      const res = createRes();

      await postLocation(req, res, next);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Servico nao elegivel para rastreamento.' });
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects service assigned to a different employee with 403', async () => {
      // Servico existe mas pertence ao funcionario id=99, nao ao id=2 autenticado
      db.query.mockResolvedValueOnce({ rows: [] });
      const req = {
        user: { id: 2, role: 'employee' },
        body: { service_order_id: 55, latitude: -23.5, longitude: -46.6 },
      };
      const res = createRes();

      await postLocation(req, res, next);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][1]).toEqual([55, 2]);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Servico nao elegivel para rastreamento.' });
      expect(next).not.toHaveBeenCalled();
    });

    test.each(['done', 'done_with_issues', 'problem'])(
      'rejects service with status "%s" with 403',
      async (status) => {
        // O SQL ja filtra por status IN ('pending','in_progress'), entao retorna rows:[]
        db.query.mockResolvedValueOnce({ rows: [] });
        const req = {
          user: { id: 2, role: 'employee' },
          body: { service_order_id: 10, latitude: -23.5, longitude: -46.6 },
        };
        const res = createRes();

        await postLocation(req, res, next);

        expect(db.query).toHaveBeenCalledTimes(1);
        expect(db.query.mock.calls[0][0]).toContain("status IN ('pending', 'in_progress')");
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Servico nao elegivel para rastreamento.' });
        expect(next).not.toHaveBeenCalled();
      },
    );

    test('inserts location for pending/in_progress service assigned to authenticated employee', async () => {
      const inserted = {
        id: 77,
        employee_id: 2,
        service_order_id: 10,
        unit_id: 5,
        latitude: '-23.5000000',
        longitude: '-46.6000000',
        accuracy_meters: '8.50',
        source: 'mobile',
        recorded_at: '2026-05-01T12:34:56.000Z',
      };
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 10, unit_id: 5, status: 'pending' }] })
        .mockResolvedValueOnce({ rows: [inserted] });
      const req = {
        user: { id: 2, role: 'employee' },
        body: {
          service_order_id: '10',
          latitude: '-23.5',
          longitude: '-46.6',
          accuracy_meters: '8.5',
          source: 'mobile',
          recorded_at: '2026-05-01T12:34:56.000Z',
        },
      };
      const res = createRes();

      await postLocation(req, res, next);

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[0][0]).toContain('FROM service_orders');
      expect(db.query.mock.calls[0][1]).toEqual([10, 2]);
      expect(db.query.mock.calls[1][0]).toContain('INSERT INTO service_location_updates');
      expect(db.query.mock.calls[1][0]).toContain('COALESCE($8::timestamptz, NOW())');
      expect(db.query.mock.calls[1][1]).toEqual([
        2,
        10,
        5,
        -23.5,
        -46.6,
        8.5,
        'mobile',
        '2026-05-01T12:34:56.000Z',
      ]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(inserted);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('listLive', () => {
    test('lists positions for admin and converts signal_age_seconds to number', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            service_order_id: 10,
            service_title: 'Limpeza patio',
            service_status: 'in_progress',
            last_seen_at: '2026-05-01T12:35:10.000Z',
            signal_age_seconds: '42',
          },
        ],
      });
      const req = { user: { id: 1, role: 'admin' }, query: {} };
      const res = createRes();

      await listLive(req, res, next);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('eligible_services AS');
      expect(db.query.mock.calls[0][0]).toContain('latest_locations AS');
      expect(db.query.mock.calls[0][0]).toContain('so.assigned_employee_id IS NOT NULL');
      expect(db.query.mock.calls[0][0]).toContain('ROW_NUMBER() OVER');
      expect(db.query.mock.calls[0][0]).toContain('PARTITION BY so.assigned_employee_id');
      expect(db.query.mock.calls[0][0]).toContain("WHEN 'in_progress' THEN 0");
      expect(db.query.mock.calls[0][0]).toContain('employee_service_rank = 1');
      expect(db.query.mock.calls[0][0]).toContain('NOW() - slu.created_at');
      expect(db.query.mock.calls[0][0]).toContain('ORDER BY slu.service_order_id, slu.created_at DESC');
      expect(db.query.mock.calls[0][1]).toEqual([]);
      expect(res.json).toHaveBeenCalledWith({
        locations: [
          {
            service_order_id: 10,
            service_title: 'Limpeza patio',
            service_status: 'in_progress',
            last_seen_at: '2026-05-01T12:35:10.000Z',
            signal_age_seconds: 42,
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('preserves eligible service with no location signal', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            service_order_id: 11,
            service_title: 'Vistoria',
            service_status: 'pending',
            latitude: null,
            longitude: null,
            last_seen_at: null,
            signal_age_seconds: null,
          },
        ],
      });
      const req = { user: { id: 1, role: 'admin' }, query: {} };
      const res = createRes();

      await listLive(req, res, next);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).not.toContain('WHERE ll.id IS NOT NULL');
      expect(res.json).toHaveBeenCalledWith({
        locations: [
          {
            service_order_id: 11,
            service_title: 'Vistoria',
            service_status: 'pending',
            latitude: null,
            longitude: null,
            last_seen_at: null,
            signal_age_seconds: null,
          },
        ],
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('filters gestor by contractId and unitId', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const req = {
        user: { id: 3, role: 'gestor', contractId: 12 },
        query: { unitId: '44' },
      };
      const res = createRes();

      await listLive(req, res, next);

      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('u.contract_id = $1');
      expect(db.query.mock.calls[0][0]).toContain('so.unit_id = $2');
      expect(db.query.mock.calls[0][1]).toEqual([12, 44]);
      expect(res.json).toHaveBeenCalledWith({ locations: [] });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
