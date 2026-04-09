// Configuração do pool de conexões PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Configurações recomendadas para produção
  max: 20,                  // máximo de conexões simultâneas
  idleTimeoutMillis: 30000, // fecha conexões ociosas após 30s
  connectionTimeoutMillis: 10000,
});

// Testa a conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err.message);
    process.exit(1);
  }
  release();
  console.log('Banco de dados PostgreSQL conectado com sucesso.');
});

module.exports = pool;
