// Script para corrigir as senhas no banco
require('dotenv').config();
const { Pool }  = require('pg');
const bcrypt    = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  const hash = await bcrypt.hash('Ponto@2025', 12);
  const result = await pool.query('UPDATE employees SET password_hash = $1', [hash]);
  console.log(`Senhas atualizadas: ${result.rowCount} funcionários.`);
  await pool.end();
}

fix().catch(console.error);
