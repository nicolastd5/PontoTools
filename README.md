# Ponto Eletrônico com GPS e Foto

Sistema completo de registro de ponto para múltiplas unidades com validação por GPS e captura de foto obrigatória.

## Pré-requisitos

- Node.js 20+
- PostgreSQL 15+
- npm 10+

## Instalação

### 1. Clone e configure variáveis de ambiente

```bash
cp .env.example backend/.env
# Edite backend/.env com suas configurações
```

### 2. Banco de dados

```bash
# Crie o banco
createdb ponto_eletronico

# Execute os scripts (na raiz do projeto)
psql ponto_eletronico -f database/01_schema.sql
psql ponto_eletronico -f database/02_seed.sql
```

### 3. Backend

```bash
cd backend
npm install
npm run dev        # desenvolvimento
# npm start        # produção
```

O servidor sobe na porta `3001` por padrão.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev        # desenvolvimento → http://localhost:5173
# npm run build    # produção
```

## Contas de teste

| Perfil        | Email                        | Senha       |
|---------------|------------------------------|-------------|
| Administrador | admin@ponto.gov.br           | Ponto@2025  |
| Funcionário   | ana.ferreira@cef10.gov.br    | Ponto@2025  |
| Funcionário   | mariana.lima@cef11.gov.br    | Ponto@2025  |

## Unidades cadastradas

| Código  | Nome               | Raio |
|---------|--------------------|------|
| CEF10   | CEF 10             | 100m |
| CEF11   | CEF 11             | 100m |
| CEF12   | CEF 12             | 100m |
| CEF14   | CEF 14             | 100m |
| CEF15   | CEF 15             | 100m |
| PF_SP   | Polícia Federal SP | 100m |

## Arquitetura

```
ponto-eletronico/
├── backend/          # Node.js + Express
│   ├── config/       # DB, JWT, Storage
│   ├── controllers/  # Lógica de negócio
│   ├── middleware/   # Auth, rate limit, audit
│   ├── routes/       # Definição de rotas
│   ├── services/     # Haversine, dashboard, exports
│   └── utils/        # Logger, error handler, timezone
│
├── frontend/         # React + Vite + PWA
│   └── src/
│       ├── contexts/ # Auth, Toast
│       ├── hooks/    # useGeolocation, useCamera
│       ├── pages/
│       │   ├── admin/    # Dashboard, Registros, Bloqueios, Export
│       │   └── employee/ # Bater ponto, Histórico
│       └── components/
│
└── database/
    ├── 01_schema.sql # Tabelas e índices
    └── 02_seed.sql   # Dados de teste
```

## Segurança

- JWT com access token (15min) + refresh token HttpOnly (7 dias)
- Rate limiting: 5 tentativas de login / 10 batidas por minuto
- Helmet para headers HTTP
- Fotos nunca servidas estaticamente (endpoint autenticado)
- Câmera capturada via canvas — sem input file

## Exportação de fotos para S3

No `.env`, altere `STORAGE_DRIVER=s3` e configure as variáveis `AWS_*`. Nenhuma outra alteração de código é necessária.

## API — exemplos de requisições

### Login
```
POST /api/auth/login
{ "email": "admin@ponto.gov.br", "password": "Ponto@2025" }
→ { accessToken, user }
```

### Registrar ponto (multipart/form-data)
```
POST /api/clock
Authorization: Bearer <token>
Fields: clock_type, latitude, longitude, timezone
File:   photo (JPEG)
→ 201 { id, clockType, clockedAtUtc, isInsideZone, distanceMeters }
   422 { blocked: true, reason, distanceMeters, radiusMeters }
```

### Dashboard admin
```
GET /api/admin/dashboard?unitId=1
Authorization: Bearer <token>
→ { summary, recentClocks, clocksByUnit, blockedByReason }
```

### Exportar PDF
```
GET /api/admin/export/pdf?employeeId=1&month=04&year=2025
Authorization: Bearer <token>
→ application/pdf
```

### Exportar Excel
```
GET /api/admin/export/excel?startDate=2025-04-01&endDate=2025-04-30
Authorization: Bearer <token>
→ application/xlsx
```
