# S3 Storage Migration — Design Spec
**Data:** 2026-04-28  
**Status:** Aprovado

## Contexto

O backend já possui uma abstração de storage em `backend/config/storage.js` com dois drivers: `localDriver` (disco) e `s3Driver` (AWS S3). O `s3Driver` está implementado mas o pacote `aws-sdk` não está instalado. O objetivo é ativar o driver S3, corrigir pequenos problemas no código, configurar as credenciais no servidor e migrar as ~19MB de fotos existentes para o bucket S3.

## Infraestrutura AWS

- **Bucket:** `pontotools-fotos`
- **Região:** `sa-east-1` (São Paulo)
- **Acesso público:** totalmente bloqueado — fotos servidas apenas via backend autenticado
- **Versionamento:** desativado
- **Criptografia:** SSE-S3 (padrão)
- **Usuário IAM:** `pontotools-s3-user` com política inline `pontotools-s3-policy`
- **Permissões IAM:** apenas `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` no recurso `arn:aws:s3:::pontotools-fotos/*`

## Mudanças no Código

### 1. Instalar `aws-sdk`
Adicionar `aws-sdk` às dependências do `backend/package.json`.

### 2. Corrigir `s3Driver.getUrl` em `backend/config/storage.js`
O método `getUrl` do `s3Driver` está marcado como `async` sem necessidade — nenhum controller chama `getUrl` diretamente (todas as fotos são servidas via `getBuffer` em endpoints autenticados). Remover o `async` desnecessário para consistência com o `localDriver`.

### 3. Script de migração `backend/scripts/migrate-to-s3.js`
Script Node.js de uso único que:
1. Conecta ao banco PostgreSQL via `DATABASE_URL`
2. Busca todos os `photo_path` distintos de `clock_records`, `clock_photos` e `service_photos` (excluindo `placeholder/*`)
3. Para cada path, lê o arquivo do disco local e faz upload para o S3 com a mesma key
4. Loga progresso e erros — arquivos com erro são listados ao final sem interromper a migração
5. Não altera nada no banco — `photo_path` permanece igual

## Variáveis de Ambiente

Adicionar ao `.env` no servidor EC2:

```
STORAGE_DRIVER=s3
AWS_BUCKET=pontotools-fotos
AWS_REGION=sa-east-1
AWS_ACCESS_KEY_ID=<access key do pontotools-s3-user>
AWS_SECRET_ACCESS_KEY=<secret key do pontotools-s3-user>
```

## Ordem de Deploy

1. `git pull origin main` no servidor
2. `cd backend && npm install` (instala `aws-sdk`)
3. Editar `.env` com as variáveis S3
4. Rodar `node scripts/migrate-to-s3.js` (migra fotos existentes)
5. `pm2 restart backend`
6. Verificar: registrar um ponto de teste e confirmar que a foto aparece normalmente

## O que NÃO muda

- Schema do banco — nenhuma migration necessária
- `photo_path` nas tabelas — continua sendo o caminho relativo (ex: `CEF10/2025-04-09/123_xxx.jpg`)
- Endpoints do frontend e mobile — transparente para os clientes
- Fluxo de autenticação para acesso às fotos — mantido via `getBuffer` em endpoints autenticados

## Decisões

- **aws-sdk v2** escolhido por já estar implementado no driver existente; v3 não traz benefício prático para este projeto
- **Região sa-east-1** (São Paulo) escolhida pela proximidade com o servidor EC2
- **Sem URL pública** — bucket totalmente privado, acesso apenas via backend
