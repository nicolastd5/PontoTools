// Handler de erros de validação do express-validator
const { validationResult } = require('express-validator');

/**
 * Verifica os resultados de validação do express-validator.
 * Se houver erros, retorna 400 com a lista de mensagens.
 * Deve ser usado APÓS os validators nas rotas.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos.',
      details: errors.array().map((e) => ({
        field:   e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

module.exports = validate;
