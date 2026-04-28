# Recurring Weekday Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando `fire_weekdays` está configurado em um `service_template`, o próximo disparo deve ser calculado com base nos dias da semana marcados — não em `interval_days`.

**Architecture:** Adiciona a função pura `nextWeekday(fromDate, bitmask)` em `push.service.js`, e altera o `UPDATE` do `next_run_at` dentro de `checkTemplates()` para usá-la quando `fire_weekdays != null`. Templates sem `fire_weekdays` continuam usando `interval_days` sem mudança.

**Tech Stack:** Node.js, Jest (novo devDependency), `pg` (PostgreSQL client já existente)

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `backend/package.json` | Modificar — adicionar `jest` em devDependencies e script `"test"` |
| `backend/services/push.service.js` | Modificar — adicionar `nextWeekday`, alterar `checkTemplates` |
| `backend/tests/push.service.test.js` | Criar — testes unitários para `nextWeekday` |

---

### Task 1: Instalar Jest e configurar script de teste

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Instalar Jest**

```bash
cd backend
npm install --save-dev jest
```

- [ ] **Step 2: Adicionar script de teste no `backend/package.json`**

No objeto `"scripts"`, adicionar:

```json
"test": "jest"
```

O `package.json` completo dos scripts ficará:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "db:setup": "psql $DATABASE_URL -f ../database/01_schema.sql && psql $DATABASE_URL -f ../database/02_seed.sql",
  "test": "jest"
}
```

- [ ] **Step 3: Verificar instalação**

```bash
cd backend
npx jest --version
```

Esperado: versão do Jest impressa sem erro.

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore: instalar jest para testes unitários do backend"
```

---

### Task 2: Exportar `nextWeekday` de `push.service.js` e escrever testes

**Files:**
- Modify: `backend/services/push.service.js`
- Create: `backend/tests/push.service.test.js`

- [ ] **Step 1: Escrever o arquivo de teste**

Criar `backend/tests/push.service.test.js` com o seguinte conteúdo:

```js
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
});
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd backend
npm test
```

Esperado: FAIL com `TypeError: nextWeekday is not a function` (ou similar — a função ainda não existe).

- [ ] **Step 3: Implementar `nextWeekday` em `push.service.js`**

Abrir `backend/services/push.service.js` e adicionar a função logo após as primeiras linhas de `require` (antes de `webpush.setVapidDetails`):

```js
/**
 * Retorna a próxima data (UTC 00:00) após fromDate cujo dia da semana
 * esteja ativo no bitmask (bit0=Dom, bit1=Seg, ..., bit6=Sáb).
 * Retorna null se bitmask for 0 ou nenhum bit válido estiver ativo.
 */
function nextWeekday(fromDate, bitmask) {
  if (!bitmask) return null;
  const d = new Date(fromDate);
  for (let i = 1; i <= 7; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const bit = 1 << d.getUTCDay();
    if (bitmask & bit) return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return null;
}
```

No final do arquivo, alterar a linha de `module.exports`:

```js
module.exports = { notify, startCron, nextWeekday };
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd backend
npm test
```

Esperado: 6 testes passando, 0 falhas.

- [ ] **Step 5: Commit**

```bash
git add backend/services/push.service.js backend/tests/push.service.test.js
git commit -m "feat: adicionar nextWeekday para agendamento por dias da semana"
```

---

### Task 3: Alterar `checkTemplates` para usar `nextWeekday`

**Files:**
- Modify: `backend/services/push.service.js:92-178`

- [ ] **Step 1: Substituir o `UPDATE` do `next_run_at` dentro da transação**

Dentro de `checkTemplates()`, localizar o bloco da transação que contém:

```js
await client.query(
  `UPDATE service_templates
   SET next_run_at = next_run_at + ($1 || ' days')::interval,
       updated_at  = NOW()
   WHERE id = $2`,
  [tpl.interval_days, tpl.id]
);
```

Substituir por:

```js
let nextRun;
if (tpl.fire_weekdays != null) {
  const next = nextWeekday(new Date(tpl.next_run_at), tpl.fire_weekdays);
  nextRun = next ? next.toISOString() : null;
} else {
  nextRun = null; // sinaliza uso do interval_days via SQL
}

if (nextRun !== null) {
  await client.query(
    `UPDATE service_templates
     SET next_run_at = $1,
         updated_at  = NOW()
     WHERE id = $2`,
    [nextRun, tpl.id]
  );
} else {
  await client.query(
    `UPDATE service_templates
     SET next_run_at = next_run_at + ($1 || ' days')::interval,
         updated_at  = NOW()
     WHERE id = $2`,
    [tpl.interval_days, tpl.id]
  );
}
```

O bloco completo do `checkTemplates` após a mudança ficará assim (mostrado na íntegra para evitar dúvida sobre o contexto):

```js
async function checkTemplates() {
  try {
    const result = await db.query(
      `SELECT * FROM service_templates
       WHERE active = TRUE AND next_run_at <= NOW()`
    );

    for (const tpl of result.rows) {
      // Verifica restrição de dia da semana (fire_weekdays bitmask: bit0=Dom...bit6=Sáb)
      if (tpl.fire_weekdays != null) {
        const todayBit = 1 << new Date().getDay();
        if (!(tpl.fire_weekdays & todayBit)) {
          // Dia não permitido: avança next_run_at em 1 dia e tenta amanhã
          await db.query(
            `UPDATE service_templates
             SET next_run_at = next_run_at + INTERVAL '1 day', updated_at = NOW()
             WHERE id = $1`,
            [tpl.id]
          );
          continue;
        }
      }

      const qty = Math.min(40, Math.max(1, tpl.quantity || 1));

      const client = await db.connect();
      const serviceIds = [];
      try {
        await client.query('BEGIN');
        for (let i = 0; i < qty; i++) {
          const inserted = await client.query(
            `INSERT INTO service_orders
               (title, description, assigned_employee_id, unit_id, created_by_id,
                scheduled_date, due_time, template_id)
             VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)
             RETURNING id`,
            [
              tpl.title,
              tpl.description,
              tpl.assigned_employee_id,
              tpl.unit_id,
              tpl.created_by_id,
              tpl.next_run_at,
              tpl.due_time,
              tpl.id,
            ]
          );
          serviceIds.push(inserted.rows[0].id);
        }

        let nextRun;
        if (tpl.fire_weekdays != null) {
          const next = nextWeekday(new Date(tpl.next_run_at), tpl.fire_weekdays);
          nextRun = next ? next.toISOString() : null;
        } else {
          nextRun = null;
        }

        if (nextRun !== null) {
          await client.query(
            `UPDATE service_templates
             SET next_run_at = $1,
                 updated_at  = NOW()
             WHERE id = $2`,
            [nextRun, tpl.id]
          );
        } else {
          await client.query(
            `UPDATE service_templates
             SET next_run_at = next_run_at + ($1 || ' days')::interval,
                 updated_at  = NOW()
             WHERE id = $2`,
            [tpl.interval_days, tpl.id]
          );
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        logger.error('Erro ao processar template (tx revertida)', { templateId: tpl.id, error: txErr.message });
        continue;
      } finally {
        client.release();
      }

      // Notificação fora da transação
      if (tpl.assigned_employee_id) {
        try {
          await notify(
            tpl.assigned_employee_id,
            'Novo serviço atribuído',
            `Você tem ${qty} novo(s) serviço(s): "${tpl.title}".`,
            'service_assigned'
          );
        } catch (notifErr) {
          logger.error('Falha ao notificar funcionário de template', { templateId: tpl.id, error: notifErr.message });
        }
      }

      logger.info('Serviços criados pelo template', { templateId: tpl.id, serviceIds, qty });
    }
  } catch (err) {
    logger.error('Erro no cron de templates', { error: err.message });
  }
}
```

- [ ] **Step 2: Rodar os testes para confirmar que continuam passando**

```bash
cd backend
npm test
```

Esperado: 6 testes passando, 0 falhas.

- [ ] **Step 3: Commit**

```bash
git add backend/services/push.service.js
git commit -m "feat: checkTemplates usa nextWeekday quando fire_weekdays configurado"
```
