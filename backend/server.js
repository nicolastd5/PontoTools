// ================================================================
// Ponto Eletrônico — Backend Principal
// ================================================================
require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes     = require('./routes/auth.routes');
const clockRoutes    = require('./routes/clock.routes');
const employeeRoutes = require('./routes/employee.routes');
const unitRoutes     = require('./routes/unit.routes');
const adminRoutes    = require('./routes/admin.routes');
const errorHandler   = require('./utils/errorHandler');
const logger         = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3001;

// ----------------------------------------------------------------
// Segurança
// ----------------------------------------------------------------
app.use(helmet());

// CORS — permite apenas o frontend configurado
app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true, // necessário para cookies HttpOnly do refresh token
}));

// ----------------------------------------------------------------
// Parsers
// ----------------------------------------------------------------
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ----------------------------------------------------------------
// Log de requisições HTTP
// ----------------------------------------------------------------
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ----------------------------------------------------------------
// Rotas
// ----------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',      authRoutes);
app.use('/api/clock',     clockRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/units',     unitRoutes);
app.use('/api/admin',     adminRoutes);

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` });
});

// ----------------------------------------------------------------
// Handler de erros centralizado (deve ser o último middleware)
// ----------------------------------------------------------------
app.use(errorHandler);

// ----------------------------------------------------------------
// Inicia o servidor
// ----------------------------------------------------------------
app.listen(PORT, () => {
  logger.info(`Servidor iniciado na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
