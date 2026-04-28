# Design: Agendamento de Templates Recorrentes por Dias da Semana

**Data:** 2026-04-28

## Problema

Quando um `service_template` tem `fire_weekdays` configurado, o cron atual ainda usa `interval_days` para calcular o próximo `next_run_at` após o disparo. Isso faz o template pular semanas em vez de repetir nos mesmos dias da semana configurados.

**Comportamento esperado:** um template marcado para sábado e domingo deve disparar todo sábado e todo domingo, indefinidamente, sem depender de `interval_days`.

## Escopo

- Apenas `backend/services/push.service.js` — função `checkTemplates()`
- Sem mudança de schema (campo `fire_weekdays` já existe)
- Sem mudança de frontend
- Templates **sem** `fire_weekdays` continuam usando `interval_days` normalmente

## Design

### Função auxiliar `nextWeekday(fromDate, bitmask)`

Percorre os próximos 7 dias a partir de `fromDate` (exclusive) e retorna a primeira data cujo dia da semana esteja ativo no bitmask (`bit0=Dom, bit1=Seg, ..., bit6=Sáb`).

- Se nenhum bit estiver ativo (bitmask `0` ou inválido), retorna `null` — o chamador cai no fallback de `interval_days`

### Mudança em `checkTemplates()`

**Caso: dia bloqueado (`fire_weekdays != null` e bit do dia atual = 0)**
- Comportamento igual ao atual: avança `next_run_at + 1 day`, dá `continue`

**Caso: dia permitido com `fire_weekdays != null`**
- Dispara normalmente (insere `service_orders`, envia push)
- Após o disparo, chama `nextWeekday(hoje, fire_weekdays)` para obter a próxima data
- Atualiza `next_run_at` para essa data às `00:00 UTC`
- `interval_days` **não é usado**

**Caso: sem `fire_weekdays` (null)**
- Comportamento igual ao atual: `next_run_at = next_run_at + interval_days days`

### Exemplo

Template configurado: sábado (bit6) + domingo (bit0) → `fire_weekdays = 65` (bit0 + bit6)

| Data do disparo | `nextWeekday` retorna | Próximo `next_run_at` |
|---|---|---|
| Sábado 2026-05-02 | Domingo 2026-05-03 | 2026-05-03T00:00:00Z |
| Domingo 2026-05-03 | Sábado 2026-05-09 | 2026-05-09T00:00:00Z |
| Sábado 2026-05-09 | Domingo 2026-05-10 | 2026-05-10T00:00:00Z |

## Compatibilidade

- Templates existentes com `fire_weekdays = null` não são afetados
- Templates com `fire_weekdays` configurado passam a ignorar `interval_days` — behavior change intencional
