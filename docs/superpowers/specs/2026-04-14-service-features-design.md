# Design: Funcionalidades de Serviço — PontoTools

**Data:** 2026-04-14  
**Status:** Aprovado

---

## Escopo

Quatro funcionalidades independentes, todas no monorepo existente (Express + React + PostgreSQL):

1. Card de serviço em andamento (employee dashboard + admin/gestor dashboard)
2. Cadastro de postos com mapa interativo
3. PDF de serviços com fotos
4. Excel com abas "Serviços" e "Auditoria"

---

## 1 — Card de serviço em andamento

### Objetivo
Mostrar claramente o horário de início e fim de cada turno de trabalho, tanto para o funcionário quanto para admin/gestor.

### Comportamento no dashboard do funcionário (`EmployeeDashboardPage`)

- Após bater **entrada**: exibe um card verde "Serviço em andamento" com:
  - Horário de início (ex: `08:14`)
  - Cronômetro de tempo decorrido atualizado a cada minuto (ex: `03h22m`)
- Após bater **saída**: o card vira resumo azul "Serviço concluído":
  - Início → Fim → Total (ex: `08:14 → 17:03 | 8h49m`)
- Lógica: derivada dos `todayRecords` já buscados via `/clock/today`. Nenhuma nova rota necessária.
- Intervalo e retorno de intervalo (`break_start`, `break_end`) são exibidos na lista de registros, mas não alteram o card de serviço.

### Comportamento no dashboard do admin/gestor (`AdminDashboardPage`)

- Nova seção "Serviços de hoje" com duas sub-seções:
  - **Em andamento**: tabela com funcionários que têm `entry` mas não têm `exit` hoje. Colunas: Nome, Unidade, Início, Decorrido.
  - **Concluídos**: tabela com turnos fechados (têm `entry` e `exit`). Colunas: Nome, Unidade, Início, Fim, Total.
- Nova rota backend: `GET /api/admin/services/today`
  - Retorna lista de serviços do dia (agrupados por `employee_id`): `{ employee_id, full_name, unit_name, entry_time, exit_time, is_inside_zone }`
  - Gestor recebe apenas sua `contract_id`; admin recebe todos.
  - Atualiza a cada 60 segundos via `refetchInterval`.

---

## 2 — Cadastro de postos com mapa interativo

### Objetivo
Substituir campos manuais de latitude/longitude por um mapa clicável com busca de endereço.

### Mudanças no frontend (`AdminUnitsPage`)

- Adicionar botão "Novo Posto" e botão "Editar" em cada card.
- Modal de criar/editar com campos:
  - Nome (texto)
  - Código (texto)
  - Raio em metros (número)
  - Endereço (texto — opcional, só para exibição)
  - **Mapa Leaflet** (em vez de lat/lon manuais):
    - Campo de busca de endereço no topo do mapa (usa Nominatim/OpenStreetMap — gratuito, sem API key)
    - Clique no mapa move o pin para a posição clicada
    - Círculo do raio desenhado em tempo real ao redor do pin
    - Lat/Lon preenchidos automaticamente em campos `hidden` (não visíveis ao usuário)
- Biblioteca: `leaflet` + `react-leaflet` (via npm, já compatível com Vite).

### Mudanças no backend
Nenhuma — os endpoints `POST /api/units` e `PUT /api/units/:id` já recebem `latitude` e `longitude` como campos normais. O frontend apenas passa os valores capturados pelo mapa.

---

## 3 — PDF de serviços com fotos

### Objetivo
Exportar um relatório de serviços (turnos completos entrada→saída) com fotos incorporadas, filtrável por funcionário ou por unidade.

### Nova rota backend: `GET /api/admin/export/services/pdf`

Parâmetros query (mutuamente exclusivos, um obrigatório):
- `employeeId` + `startDate` + `endDate`
- `unitId` + `startDate` + `endDate`

Lógica:
1. Busca `clock_records` do período filtrado, ordenados por `employee_id, clocked_at_utc`.
2. Agrupa em pares entrada→saída por funcionário por dia.
3. Para cada par, lê os buffers das fotos via `storage.getBuffer(photo_path)`.
4. Gera PDF com pdfkit:
   - Cabeçalho do relatório (filtro, período, data de geração)
   - Para cada serviço: bloco com nome, unidade, data, início, fim, total, status de zona
   - Fotos de entrada e saída lado a lado (150×150px cada)
   - Serviços sem saída registrada são incluídos com "Saída: —"
5. Streaming direto para `res` (sem buffer em memória do PDF inteiro).

### Mudanças no frontend (`AdminExportPage`)

- Nova seção "Relatório de Serviços (PDF)" com:
  - Toggle de filtro: "Por funcionário" / "Por unidade"
  - Campos condicionais: funcionário ou unidade + data início + data fim
  - Botão "Gerar PDF de Serviços"

---

## 4 — Excel com abas "Serviços" e "Auditoria"

### Objetivo
O Excel exportado passa a ter duas abas: visão gerencial (turnos agrupados) e auditoria técnica (batidas individuais — como hoje).

### Mudança no backend (`export.controller.js` — função `exportExcel`)

Adicionar segunda aba "Serviços" ao workbook existente, antes da aba "Auditoria":

Colunas da aba **Serviços**:
- Funcionário, Matrícula, Unidade, Data, Hora Entrada, Hora Saída, Total Horas, Dentro da Zona

Lógica: mesmo query de `exportExcel`, mas os resultados são agrupados em pares entrada→saída antes de serem escritos na aba.

A aba **Auditoria** permanece idêntica à implementação atual.

### Mudanças no frontend
Nenhuma — o botão "Gerar Excel" já existente passa a baixar o arquivo com duas abas.

---

## Dependências novas

| Pacote | Onde | Motivo |
|--------|------|--------|
| `leaflet` | `frontend` | Mapa interativo |
| `react-leaflet` | `frontend` | Wrapper React para Leaflet |

Nenhuma dependência nova no backend.

---

## Sem mudanças de schema

O banco de dados não precisa de alterações. Todos os dados necessários (foto, horários, GPS) já existem em `clock_records`.

---

## Fora do escopo

- App mobile (React Native) — nenhuma das funcionalidades afeta o mobile.
- Notificações push ou e-mail.
- Aprovação/rejeição manual de serviços.
