# Design: Módulo de Serviços e Notificações

**Data:** 2026-04-11  
**Status:** Aprovado

---

## 1. Escopo

Dois módulos independentes adicionados ao sistema PontoTools:

- **Serviços** — admin/gestor cria ordens de serviço atribuídas a funcionários específicos; funcionário registra foto antes de iniciar e foto após concluir; pode reportar problema.
- **Notificações** — admin envia notificações manuais; sistema envia automaticamente (serviço atribuído, serviço atrasado, problema reportado); entrega via banco + Web Push (browser).

---

## 2. Banco de Dados

### `service_orders`
| Coluna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| title | VARCHAR(200) | obrigatório |
| description | TEXT | opcional |
| assigned_employee_id | INTEGER FK employees | |
| unit_id | INTEGER FK units | |
| created_by_id | INTEGER FK employees | admin/gestor |
| status | VARCHAR(20) | `pending` \| `in_progress` \| `done` \| `problem` |
| scheduled_date | DATE | data agendada |
| due_time | TIME | horário limite (opcional) |
| problem_description | TEXT | preenchido pelo funcionário |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `service_photos`
| Coluna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| service_order_id | INTEGER FK | CASCADE DELETE |
| phase | VARCHAR(10) | `before` \| `after` |
| photo_path | TEXT | mesmo padrão do storage existente |
| created_at | TIMESTAMPTZ | |

### `notifications`
| Coluna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| employee_id | INTEGER FK | destinatário |
| title | VARCHAR(200) | |
| body | TEXT | |
| type | VARCHAR(30) | `manual` \| `service_assigned` \| `service_late` \| `service_problem` |
| read | BOOLEAN | DEFAULT FALSE |
| push_sent | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMPTZ | |

### `push_subscriptions`
| Coluna | Tipo | Notas |
|---|---|---|
| id | SERIAL PK | |
| employee_id | INTEGER FK | |
| endpoint | TEXT UNIQUE | |
| p256dh | TEXT | chave pública do browser |
| auth | TEXT | segredo do browser |
| created_at | TIMESTAMPTZ | |

---

## 3. Backend

### Rotas de Serviços — `/api/services`

| Método | Path | Quem | Descrição |
|---|---|---|---|
| GET | `/` | admin/gestor/employee | Lista; employee vê só os seus |
| POST | `/` | admin/gestor | Cria ordem + dispara notificação |
| GET | `/:id` | admin/gestor/employee | Detalhe com fotos |
| PATCH | `/:id/status` | employee | Atualiza status + problem_description |
| POST | `/:id/photos` | employee | Upload foto (phase: before\|after) |
| GET | `/:id/photos/:photoId` | admin/gestor/employee | Serve foto com auth JWT |

### Rotas de Notificações — `/api/notifications`

| Método | Path | Quem | Descrição |
|---|---|---|---|
| GET | `/` | employee | Suas notificações |
| PATCH | `/:id/read` | employee | Marca como lida |
| POST | `/send` | admin/gestor | Envia notificação manual |
| POST | `/subscribe` | employee | Registra Web Push subscription |
| DELETE | `/subscribe` | employee | Remove subscription |

### Cron interno (setInterval no startup)
- Roda a cada hora
- Busca `service_orders` com `status IN ('pending','in_progress')` e `scheduled_date + due_time < NOW()`
- Para cada um: cria notificação de atraso + envia push (flag `push_sent` evita duplicatas)

### Biblioteca
- `web-push` (npm) — VAPID keys geradas uma vez e salvas em `.env` como `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`

---

## 4. Frontend Admin

### `/admin/services`
- Tabela: Título, Funcionário, Data/Prazo, Status (badge), Ações (Ver detalhes)
- Botão "+ Novo Serviço" → modal com campos: título, descrição, funcionário (select), data agendada, horário limite
- Clique na linha → modal de detalhe: info + grid de fotos antes/depois + descrição de problema
- Filtros: status, funcionário

### `/admin/notifications`
- Formulário: selecionar funcionário (ou "Todos da unidade"), título, mensagem → Enviar
- Tabela de histórico: destinatário, título, data, lida (sim/não)

### `AdminClocksPage` — múltiplas fotos
- Modal existente ganha navegação: se o registro tiver fotos extras em `clock_photos`, mostra setas ◀ ▶ e contador "1/3"

---

## 5. Frontend Funcionário

### `/services`
- Cards agrupados por status (pendente → em andamento → concluído → problema)
- Abrir card → detalhe com ações contextuais:
  - Status `pending`: botão "Iniciar" → câmera (fase `before`) → status vira `in_progress`
  - Status `in_progress`: botão "Concluir" → câmera (fase `after`) → status vira `done`; botão "Reportar Problema" → textarea → status vira `problem`
- Fotos tiradas aparecem como miniaturas no detalhe

### `/notifications`
- Lista com não lidas em destaque (fundo azul claro)
- Marca como lida ao clicar
- Badge de contagem no menu (ícone 🔔 com número vermelho)
- Ao montar: solicita permissão de Web Push e registra subscription via `POST /api/notifications/subscribe`

---

## 6. Variáveis de Ambiente Novas

```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_EMAIL=mailto:admin@pontotools.shop
```
