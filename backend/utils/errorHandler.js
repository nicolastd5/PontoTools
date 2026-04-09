// Middleware central de tratamento de erros do Express
const logger = require('./logger');

/**
 * Middleware de erro — deve ser registrado por último no Express.
 * Captura qualquer erro não tratado e retorna JSON padronizado.
 */
function errorHandler(err, req, res, next) {
  // Erros de validação do Multer (upload de arquivo)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 5MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Campo de arquivo inesperado.' });
  }

  // Erros de JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado.' });
  }

  // Erros de constraint do PostgreSQL
  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ error: 'Registro duplicado. Verifique os dados informados.' });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(400).json({ error: 'Referência inválida. O registro relacionado não existe.' });
  }

  // Log do erro completo para debugging
  logger.error('Erro não tratado', {
    method: req.method,
    url:    req.originalUrl,
    error:  err.message,
    stack:  err.stack,
  });

  // Resposta genérica para o cliente
  const statusCode = err.statusCode || err.status || 500;
  const message    = process.env.NODE_ENV === 'production'
    ? 'Erro interno do servidor.'
    : err.message;

  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
