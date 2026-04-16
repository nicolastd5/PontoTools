# Design: Templates de Serviço Recorrente por Posto

**Data:** 2026-04-16  
**Status:** Aprovado

## Resumo

Adicionar suporte a templates de serviço recorrente. Um template define uma tarefa que deve ser criada automaticamente em um posto a cada X dias, a partir de uma data de início configurável. A tarefa pode ser pré-atribuída a um funcionário fixo ou criada sem responsável para atribuição posterior.

---

## Banco de Dados

### Nova tabela: `service_templates`

```sql
CREATE TABLE service_templates (
  id                   SERIAL PRIMARY KEY,
  title                VARCHAR(200) NOT NULL,
  description          TEXT,
  unit_id              INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assigned_employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  due_time             TIME,
  interval_days        INTEGER NOT NULL CHECK (interval_days >= 1),
  start_date           DATE NOT NULL,
  next_run_at          TIMESTAMPTZ NOT NULL,
  active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_id        INTEGER NOT NULL REFERENCES employees(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- `assigned_employee_id` nullable — NULL significa "atribuir manualmente"
- `next_run_at` é calculado na criação: `start_date::timestamptz` e avançado `+interval_days days` a cada disparo

### Alterações na tabela `service_orders`

1. `assigned_employee_id` passa a ser **nullable** (permite serviços sem responsável)
2. Nova coluna `template_id INTEGER REFERENCES service_templates(id) ON DELETE SET NULL` — rastreia a origem do serviço

### Arquivo de migration

`database/13_service_templates.sql`

---

## Backend

### Novo controller: `backend/controllers/serviceTemplate.controller.js`

Funções:
- `list` — lista templates; gestor vê apenas do próprio contrato (`JOIN units u ON u.id = st.unit_id WHERE u.contract_id = $contractId`)
- `create` — cria template; calcula `next_run_at = start_date::timestamptz`; gestor só pode atribuir units do próprio contrato
- `update` — edita title, description, assigned_employee_id, due_time, interval_days, start_date; recalcula `next_run_at` se `start_date` ou `interval_days` mudarem
- `toggle` — alterna `active = NOT active`
- `remove` — deleta template (não apaga serviços já gerados)

### Novas rotas: `backend/routes/serviceTemplate.routes.js`

| Método | Rota | Middleware |
|--------|------|------------|
| GET | `/api/service-templates` | auth, requireAdminOrGestor |
| POST | `/api/service-templates` | auth, requireAdminOrGestor, validate |
| PATCH | `/api/service-templates/:id` | auth, requireAdminOrGestor, validate |
| PATCH | `/api/service-templates/:id/toggle` | auth, requireAdminOrGestor |
| DELETE | `/api/service-templates/:id` | auth, requireAdminOrGestor |

Registrado em `server.js` como `app.use('/api/service-templates', ...)`.

### Cron: `backend/services/push.service.js`

Nova função `checkTemplates()`:

1. Busca `SELECT * FROM service_templates WHERE active = TRUE AND next_run_at <= NOW()`
2. Para cada template:
   a. Insere `service_orders` com `assigned_employee_id` (pode ser NULL), `unit_id`, `template_id`, `scheduled_date = next_run_at::date`, `due_time`
   b. Se `assigned_employee_id` não for NULL, chama `push.notify(...)` com tipo `service_assigned`
   c. Atualiza `next_run_at = next_run_at + interval_days * INTERVAL '1 day'`
3. Chamada dentro de `startCron()` junto com `checkLateServices()`

### Ajuste em `service.controller.js`

- `create`: remove obrigatoriedade de `assigned_employee_id` (passa a ser opcional)
- Nova função `assign`: `PATCH /api/services/:id/assign` — atribui `assigned_employee_id` a um serviço existente; dispara notificação push; apenas admin/gestor

---

## Frontend

### Nova página: `frontend/src/pages/admin/AdminServiceTemplatesPage.jsx`

**Tabela** com colunas: Título, Posto, Responsável (ou badge "A definir"), Intervalo, Próximo disparo, Status (ativo/pausado), Ações.

**Modal de criação/edição** com campos:
- Título (obrigatório)
- Descrição (opcional)
- Posto — select de units (gestor vê apenas as do próprio contrato)
- Responsável — select de employees filtrado pelo posto selecionado + opção "A definir / atribuir manualmente"
- Data de início (date picker)
- Horário limite (time, opcional)
- Intervalo em dias (número, mínimo 1)

**Ações por linha:**
- Editar (abre modal pré-preenchido)
- Pausar / Ativar (toggle)
- Excluir (com confirmação)

### Ajustes em `AdminServicesPage.jsx`

- Serviços com `assigned_employee_id = null` exibem badge amarelo "Sem responsável"
- Botão "Atribuir" abre modal com select de employees (filtrado pelo `unit_id` do serviço)
- Serviços gerados por template exibem ícone de recorrência com tooltip do template

### Menu lateral

Novo item "Templates de Serviço" (ícone: calendário com seta circular) inserido abaixo de "Serviços", visível apenas para roles `admin` e `gestor`.

---

## Escopo de acesso (role scoping)

| Ação | Admin | Gestor |
|------|-------|--------|
| Ver templates | Todos | Apenas do próprio contrato |
| Criar template | Qualquer posto | Apenas postos do próprio contrato |
| Editar/Pausar/Deletar template | Qualquer | Apenas do próprio contrato |
| Atribuir funcionário em serviço | Qualquer | Apenas do próprio contrato |

---

## Fluxo de disparo automático

```
startCron() [a cada 1h]
  └─ checkLateServices()   (já existente)
  └─ checkTemplates()      (novo)
       ├─ busca templates ativos com next_run_at <= NOW()
       ├─ para cada template:
       │    ├─ INSERT service_orders (assigned pode ser NULL)
       │    ├─ if assigned_employee_id → notify push
       │    └─ UPDATE next_run_at += interval_days days
       └─ loga resultado
```

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `database/13_service_templates.sql` | Criar |
| `backend/controllers/serviceTemplate.controller.js` | Criar |
| `backend/routes/serviceTemplate.routes.js` | Criar |
| `backend/services/push.service.js` | Modificar — adicionar `checkTemplates` |
| `backend/controllers/service.controller.js` | Modificar — `assigned_employee_id` opcional + função `assign` |
| `backend/routes/service.routes.js` | Modificar — nova rota `PATCH /:id/assign` |
| `backend/server.js` | Modificar — registrar novas rotas |
| `frontend/src/pages/admin/AdminServiceTemplatesPage.jsx` | Criar |
| `frontend/src/pages/admin/AdminServicesPage.jsx` | Modificar — badge + modal de atribuição |
| `frontend/src/App.jsx` (ou router) | Modificar — nova rota `/admin/service-templates` |
| Menu lateral (Sidebar/Nav) | Modificar — novo item |
