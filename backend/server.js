// ================================================================
// Ponto Eletrônico — Backend Principal
// ================================================================
require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes         = require('./routes/auth.routes');
const clockRoutes        = require('./routes/clock.routes');
const employeeRoutes     = require('./routes/employee.routes');
const unitRoutes         = require('./routes/unit.routes');
const contractRoutes     = require('./routes/contract.routes');
const jobRoleRoutes      = require('./routes/jobRole.routes');
const serviceRoutes      = require('./routes/service.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes        = require('./routes/admin.routes');
const errorHandler       = require('./utils/errorHandler');
const logger             = require('./utils/logger');
const push               = require('./services/push.service');

const app  = express();
const PORT = process.env.PORT || 3001;

const defaultOrigins = [
  'https://pontotools.shop',
  'https://www.pontotools.shop',
  'https://status.pontotools.shop',
  'http://localhost:5173',
];

// ----------------------------------------------------------------
// Segurança
// ----------------------------------------------------------------
app.use(helmet());

// CORS — permite frontend web e app mobile
const allowedOrigins = (process.env.CORS_ORIGIN || defaultOrigins.join(','))
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Requests sem origin (mobile apps, curl, server-to-server) sao permitidos
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
    }
  },
  credentials: true,
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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',          authRoutes);
app.use('/api/clock',         clockRoutes);
app.use('/api/employees',     employeeRoutes);
app.use('/api/units',         unitRoutes);
app.use('/api/contracts',     contractRoutes);
app.use('/api/job-roles',     jobRoleRoutes);
app.use('/api/services',      serviceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',         adminRoutes);

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
  // Inicia cron de notificações de atraso (apenas se VAPID configurado)
  if (process.env.VAPID_PUBLIC_KEY) push.startCron();
});

module.exports = app;
