# Design: Rastreamento de Localizacao por Servico

**Data:** 2026-05-01

## Problema

O sistema ja captura GPS para ponto, fotos e validacao de zona, mas ainda nao existe uma forma isolada de acompanhar onde esta um funcionario enquanto ele tem servico ativo ou pendente. A nova funcionalidade deve permitir que admin e gestor vejam a ultima localizacao conhecida em uma pagina propria do dashboard, sem alterar o comportamento atual de ponto, fotos, servicos ou validacao geografica.

## Objetivos

- Rastrear localizacao apenas quando o funcionario tiver servico `pending` ou `in_progress` atribuido a ele.
- Rodar no webapp e no app mobile enquanto o app estiver aberto.
- Manter o modulo separado do GPS existente, para que falhas no rastreador nao quebrem fluxos atuais.
- Criar uma pagina admin propria para acompanhamento.
- Impor as regras de seguranca tambem no backend.

## Fora de Escopo

- Rastreamento em background com o app fechado.
- Alterar regras atuais de batida de ponto, foto de servico ou validacao de zona.
- Bloquear execucao de servicos quando o rastreamento falhar.
- Historico detalhado de rotas para auditoria longa. A primeira versao grava os updates recebidos, mas o dashboard usa apenas a ultima posicao por servico; limpeza automatica de historico fica para uma etapa posterior.
- WebSocket/SSE em tempo real. A primeira versao usara polling.

## Abordagem Recomendada

Usar polling simples e isolado:

- Webapp/mobile enviam localizacao a cada 30 segundos enquanto houver servico elegivel.
- Dashboard admin consulta as ultimas posicoes a cada 30 segundos.
- Backend valida se o servico pertence ao funcionario e esta `pending` ou `in_progress`.
- A interface mostra status com base na idade do ultimo update.

Essa abordagem evita dependencia de infraestrutura nova e reduz o risco de regressao.

## Banco de Dados

Criar migration `database/19_service_location_tracking.sql` com uma tabela dedicada:

```sql
CREATE TABLE IF NOT EXISTS service_location_updates (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  service_order_id INTEGER NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  accuracy_meters NUMERIC(8,2),
  source VARCHAR(20) NOT NULL CHECK (source IN ('web', 'mobile')),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Indices:

- `(service_order_id, created_at DESC)` para ultima posicao por servico.
- `(employee_id, created_at DESC)` para ultima posicao por funcionario.
- `(unit_id, created_at DESC)` para filtro por unidade.

## Backend

Adicionar modulo separado:

- `backend/controllers/serviceTracking.controller.js`
- `backend/routes/serviceTracking.routes.js`
- registrar rota em `backend/server.js` como `/api/service-tracking`

Endpoints:

### `POST /api/service-tracking/location`

Uso: funcionario autenticado envia uma localizacao.

Payload:

```json
{
  "service_order_id": 123,
  "latitude": -23.55052,
  "longitude": -46.63331,
  "accuracy_meters": 12.4,
  "source": "web",
  "recorded_at": "2026-05-01T15:00:00.000Z"
}
```

Regras:

- Apenas `employee` pode enviar localizacao.
- O servico deve existir, estar atribuido ao usuario autenticado e ter status `pending` ou `in_progress`.
- `latitude` e `longitude` devem ser numeros finitos dentro de faixas validas.
- `accuracy_meters` e `recorded_at` sao opcionais, com fallback para `NULL` e `NOW()`.
- Uma falha neste endpoint nao altera status de servico.

### `GET /api/service-tracking/live`

Uso: admin/gestor lista ultimas posicoes dos funcionarios com servicos elegiveis.

Filtros opcionais:

- `unitId`
- `status` (`pending` ou `in_progress`)

Retorno inclui:

- funcionario
- servico
- unidade
- ultima latitude/longitude
- precisao
- origem (`web` ou `mobile`)
- horario da ultima posicao
- idade do sinal em segundos

Permissoes:

- `admin` ve todas as unidades.
- `gestor` ve apenas unidades do proprio contrato.

## Webapp do Funcionario

Criar hook novo e independente:

- `frontend/src/hooks/useServiceLocationTracker.js`

Comportamento:

- Usa `navigator.geolocation` diretamente, sem alterar `useGeolocation`.
- Recebe a lista de servicos ja carregada na tela de servicos do funcionario.
- Seleciona servicos `pending` e `in_progress`.
- Envia update a cada 30 segundos enquanto houver pelo menos um servico elegivel e o app estiver aberto.
- Se houver mais de um servico elegivel, prioriza `in_progress`; se nao houver, usa o primeiro `pending`.
- Erros sao silenciosos ou logados em estado local, sem toast recorrente.

Integracao inicial:

- Montar o hook na tela de servicos do funcionario, pois essa tela ja consulta `/services` e ja e o contexto onde o funcionario interage com OS.
- Nao mudar `useGeolocation`, `CameraCapture`, upload de fotos ou validacao de ponto.

## Mobile

Criar modulo novo e independente:

- `mobile/src/hooks/useServiceLocationTracker.ts`

Comportamento:

- Usa o GPS ja exposto por `GpsContext` como fonte de coordenadas, mas nao altera o contexto.
- Recebe a lista de servicos carregada em `ServicesScreen`.
- Envia update a cada 30 segundos se existir servico `pending` ou `in_progress`.
- Prioriza servico `in_progress`.
- Falha de envio nao bloqueia foto, status ou navegacao.

## Dashboard Admin

Criar pagina nova:

- `frontend/src/pages/admin/AdminServiceTrackingPage.jsx`
- rota `/admin/service-tracking`
- item no menu: `Rastreamento`

Conteudo da pagina:

- Filtro por unidade.
- Cards de resumo: online, recente, sem sinal.
- Lista/tabela com funcionario, servico, unidade, status do servico, ultima atualizacao, precisao e origem.
- Link "Abrir mapa" usando Google Maps ou maps nativo via URL externa.
- Mapa embutido com `react-leaflet` fica fora da primeira versao para manter o modulo simples e reduzir risco.

Status visual:

- `online`: ultima posicao ate 60 segundos.
- `recente`: ultima posicao entre 61 segundos e 5 minutos.
- `sem sinal`: sem posicao ou acima de 5 minutos.

## Privacidade e UX

- Mostrar no app/webapp um indicador discreto quando o rastreamento de servico estiver ativo.
- Texto sugerido: "Localizacao compartilhada enquanto houver servico ativo ou pendente."
- Nao rastrear usuarios sem servico elegivel.
- Nao rastrear com app fechado na primeira versao.
- Nao exibir a pagina para funcionarios.

## Testes

Backend:

- Recusa envio de funcionario sem servico elegivel.
- Recusa envio para servico de outro funcionario.
- Aceita envio para `pending` e `in_progress`.
- Recusa envio para `done`, `done_with_issues` e `problem`.
- Gestor so ve posicoes do proprio contrato.

Frontend web:

- Hook nao inicia sem servico elegivel.
- Hook escolhe `in_progress` antes de `pending`.
- Pagina admin renderiza estados online/recente/sem sinal.

Mobile:

- Hook nao envia sem servico elegivel.
- Hook envia payload correto quando ha coordenadas e servico elegivel.

## Riscos

- Navegadores podem pausar timers e GPS quando a aba/app vai para segundo plano.
- GPS de alta precisao pode consumir bateria, principalmente no mobile.
- Multiplos servicos pendentes podem gerar ambiguidade; a primeira versao resolve priorizando `in_progress` e depois o primeiro `pending`.
- Sem WebSocket, o dashboard pode ter atraso de ate 30 segundos.

## Criterio de Aceite

- Funcionario com servico `pending` ou `in_progress` envia localizacao no webapp e no mobile enquanto a tela/app esta aberto.
- Funcionario sem servico elegivel nao envia localizacao.
- Admin/gestor acessa uma pagina separada de rastreamento.
- Gestor nao ve dados fora do proprio contrato.
- Falhas no rastreador nao impedem ponto, fotos, status de servico ou uso normal do app.
