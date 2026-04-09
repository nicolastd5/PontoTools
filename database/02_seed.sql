-- ================================================================
-- SEED: Dados iniciais de teste
-- Senha padrão de todos os usuários de teste: Ponto@2025
-- Hash bcrypt (rounds=12) gerado offline para performance
-- Para gerar novo hash: node -e "const b=require('bcrypt'); b.hash('Ponto@2025',12).then(console.log)"
-- ================================================================

-- ================================================================
-- UNIDADES (coordenadas reais de São Paulo)
-- ================================================================
INSERT INTO units (name, code, latitude, longitude, radius_meters, address) VALUES
  ('CEF 10', 'CEF10', -23.5505199, -46.6333094, 100, 'Av. Paulista, 1000 - Bela Vista, São Paulo, SP'),
  ('CEF 11', 'CEF11', -23.5489432, -46.6388217, 100, 'Rua Augusta, 500 - Consolação, São Paulo, SP'),
  ('CEF 12', 'CEF12', -23.5601847, -46.6547823, 100, 'Av. Rebouças, 200 - Pinheiros, São Paulo, SP'),
  ('CEF 14', 'CEF14', -23.5312651, -46.6201438, 100, 'Rua da Consolação, 300 - Higienópolis, São Paulo, SP'),
  ('CEF 15', 'CEF15', -23.5721034, -46.6489562, 100, 'Av. Brigadeiro Faria Lima, 800 - Itaim Bibi, São Paulo, SP'),
  ('Polícia Federal SP', 'PF_SP', -23.5629418, -46.6544317, 100, 'Av. Prestes Maia, 700 - Santa Ifigênia, São Paulo, SP')
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- ADMINISTRADOR DO SISTEMA
-- Vinculado à unidade CEF 10 (mas acessa todas as unidades)
-- ================================================================
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role)
VALUES (
  (SELECT id FROM units WHERE code = 'CEF10'),
  'ADMIN001',
  'Administrador do Sistema',
  'admin@ponto.gov.br',
  '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV',
  'admin'
)
ON CONFLICT (badge_number) DO NOTHING;

-- ================================================================
-- FUNCIONÁRIOS DE TESTE (2 por unidade)
-- ================================================================

-- CEF 10
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role) VALUES
  ((SELECT id FROM units WHERE code='CEF10'), 'CEF10_001', 'Ana Paula Ferreira',    'ana.ferreira@cef10.gov.br',    '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee'),
  ((SELECT id FROM units WHERE code='CEF10'), 'CEF10_002', 'Carlos Eduardo Santos', 'carlos.santos@cef10.gov.br',   '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee')
ON CONFLICT (badge_number) DO NOTHING;

-- CEF 11
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role) VALUES
  ((SELECT id FROM units WHERE code='CEF11'), 'CEF11_001', 'Mariana Costa Lima',   'mariana.lima@cef11.gov.br',    '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee'),
  ((SELECT id FROM units WHERE code='CEF11'), 'CEF11_002', 'Roberto Alves Pereira','roberto.pereira@cef11.gov.br', '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee')
ON CONFLICT (badge_number) DO NOTHING;

-- CEF 12
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role) VALUES
  ((SELECT id FROM units WHERE code='CEF12'), 'CEF12_001', 'Fernanda Oliveira',     'fernanda.oliveira@cef12.gov.br','$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee'),
  ((SELECT id FROM units WHERE code='CEF12'), 'CEF12_002', 'Paulo Henrique Souza',  'paulo.souza@cef12.gov.br',      '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee')
ON CONFLICT (badge_number) DO NOTHING;

-- CEF 14
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role) VALUES
  ((SELECT id FROM units WHERE code='CEF14'), 'CEF14_001', 'Juliana Rodrigues',     'juliana.rodrigues@cef14.gov.br','$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee'),
  ((SELECT id FROM units WHERE code='CEF14'), 'CEF14_002', 'Marcos Antônio Silva',  'marcos.silva@cef14.gov.br',     '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee')
ON CONFLICT (badge_number) DO NOTHING;

-- CEF 15
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role) VALUES
  ((SELECT id FROM units WHERE code='CEF15'), 'CEF15_001', 'Beatriz Mendes',        'beatriz.mendes@cef15.gov.br',   '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee'),
  ((SELECT id FROM units WHERE code='CEF15'), 'CEF15_002', 'Ricardo Gomes Nunes',   'ricardo.nunes@cef15.gov.br',    '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee')
ON CONFLICT (badge_number) DO NOTHING;

-- Polícia Federal SP
INSERT INTO employees (unit_id, badge_number, full_name, email, password_hash, role) VALUES
  ((SELECT id FROM units WHERE code='PF_SP'), 'PF_SP_001', 'Delegado João Carvalho','joao.carvalho@pf.gov.br',       '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee'),
  ((SELECT id FROM units WHERE code='PF_SP'), 'PF_SP_002', 'Agente Sandra Torres',  'sandra.torres@pf.gov.br',       '$2b$12$kQYe4LGk7EnaBsTl..ua7.lqiesy3E0JTg06iSwSTWKipw8AMNDV', 'employee')
ON CONFLICT (badge_number) DO NOTHING;

-- ================================================================
-- REGISTROS DE PONTO DE TESTE (últimos 3 dias)
-- ================================================================
DO $$
DECLARE
  v_emp_id INTEGER;
  v_unit_id INTEGER;
  v_unit_lat NUMERIC;
  v_unit_lng NUMERIC;
  v_date DATE;
  v_day INTEGER;
BEGIN
  -- Loop pelos últimos 3 dias úteis
  FOR v_day IN 0..2 LOOP
    v_date := CURRENT_DATE - v_day;

    -- Pula fins de semana
    IF EXTRACT(DOW FROM v_date) IN (0, 6) THEN
      CONTINUE;
    END IF;

    -- CEF10_001 - Ana Paula
    SELECT e.id, e.unit_id, u.latitude, u.longitude
      INTO v_emp_id, v_unit_id, v_unit_lat, v_unit_lng
      FROM employees e JOIN units u ON u.id = e.unit_id
      WHERE e.badge_number = 'CEF10_001';

    INSERT INTO clock_records (employee_id, unit_id, clock_type, clocked_at_utc, timezone, latitude, longitude, accuracy_meters, distance_meters, is_inside_zone, photo_path, device_info)
    VALUES
      (v_emp_id, v_unit_id, 'entry',       (v_date + TIME '11:02:00') AT TIME ZONE 'America/Sao_Paulo', 'America/Sao_Paulo', v_unit_lat + 0.0003, v_unit_lng + 0.0002, 5.2, 38.4, TRUE,  'placeholder/entry.jpg',       '{"platform":"Android","userAgent":"Mozilla/5.0"}'),
      (v_emp_id, v_unit_id, 'break_start', (v_date + TIME '15:01:00') AT TIME ZONE 'America/Sao_Paulo', 'America/Sao_Paulo', v_unit_lat + 0.0001, v_unit_lng - 0.0001, 4.8, 14.2, TRUE,  'placeholder/break_start.jpg', '{"platform":"Android","userAgent":"Mozilla/5.0"}'),
      (v_emp_id, v_unit_id, 'break_end',   (v_date + TIME '16:03:00') AT TIME ZONE 'America/Sao_Paulo', 'America/Sao_Paulo', v_unit_lat - 0.0002, v_unit_lng + 0.0003, 6.1, 42.1, TRUE,  'placeholder/break_end.jpg',   '{"platform":"Android","userAgent":"Mozilla/5.0"}'),
      (v_emp_id, v_unit_id, 'exit',        (v_date + TIME '20:05:00') AT TIME ZONE 'America/Sao_Paulo', 'America/Sao_Paulo', v_unit_lat + 0.0004, v_unit_lng - 0.0002, 5.9, 55.3, TRUE,  'placeholder/exit.jpg',        '{"platform":"Android","userAgent":"Mozilla/5.0"}')
    ON CONFLICT DO NOTHING;

    -- CEF11_001 - Mariana (com uma batida fora da zona)
    SELECT e.id, e.unit_id, u.latitude, u.longitude
      INTO v_emp_id, v_unit_id, v_unit_lat, v_unit_lng
      FROM employees e JOIN units u ON u.id = e.unit_id
      WHERE e.badge_number = 'CEF11_001';

    INSERT INTO clock_records (employee_id, unit_id, clock_type, clocked_at_utc, timezone, latitude, longitude, accuracy_meters, distance_meters, is_inside_zone, photo_path, device_info)
    VALUES
      (v_emp_id, v_unit_id, 'entry', (v_date + TIME '07:58:00') AT TIME ZONE 'America/Sao_Paulo', 'America/Sao_Paulo', v_unit_lat + 0.0002, v_unit_lng + 0.0001, 4.5, 25.1, TRUE, 'placeholder/entry.jpg', '{"platform":"iOS","userAgent":"Mozilla/5.0"}'),
      (v_emp_id, v_unit_id, 'exit',  (v_date + TIME '17:10:00') AT TIME ZONE 'America/Sao_Paulo', 'America/Sao_Paulo', v_unit_lat + 0.0015, v_unit_lng + 0.0018, 8.2, 248.7, FALSE, 'placeholder/exit.jpg', '{"platform":"iOS","userAgent":"Mozilla/5.0"}')
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;

-- ================================================================
-- TENTATIVAS BLOQUEADAS DE TESTE
-- ================================================================
INSERT INTO blocked_attempts (employee_id, unit_id, attempted_at, block_reason, latitude, longitude, distance_meters, timezone, ip_address, device_info)
SELECT
  e.id,
  e.unit_id,
  NOW() - INTERVAL '2 hours',
  'outside_zone',
  u.latitude + 0.0030,
  u.longitude + 0.0025,
  412.8,
  'America/Sao_Paulo',
  '192.168.1.100',
  '{"platform":"Android","userAgent":"Mozilla/5.0"}'
FROM employees e JOIN units u ON u.id = e.unit_id
WHERE e.badge_number = 'CEF10_002'
ON CONFLICT DO NOTHING;

INSERT INTO blocked_attempts (employee_id, unit_id, attempted_at, block_reason, timezone, ip_address, device_info)
SELECT
  e.id,
  e.unit_id,
  NOW() - INTERVAL '30 minutes',
  'gps_disabled',
  'America/Sao_Paulo',
  '192.168.1.101',
  '{"platform":"iOS","userAgent":"Mozilla/5.0"}'
FROM employees e
WHERE e.badge_number = 'CEF12_001'
ON CONFLICT DO NOTHING;

INSERT INTO blocked_attempts (employee_id, unit_id, attempted_at, block_reason, latitude, longitude, distance_meters, timezone, ip_address, device_info)
SELECT
  e.id,
  e.unit_id,
  NOW() - INTERVAL '1 day' - INTERVAL '3 hours',
  'outside_zone',
  u.latitude + 0.0050,
  u.longitude - 0.0040,
  651.2,
  'America/Sao_Paulo',
  '10.0.0.55',
  '{"platform":"Windows","userAgent":"Mozilla/5.0"}'
FROM employees e JOIN units u ON u.id = e.unit_id
WHERE e.badge_number = 'PF_SP_001'
ON CONFLICT DO NOTHING;
