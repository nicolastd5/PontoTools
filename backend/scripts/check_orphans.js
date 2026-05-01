const db      = require('../config/database');
const storage = require('../config/storage');

async function main() {
  // Fotos 'before' em serviços que ainda estão pending e sem posto = órfãs
  const result = await db.query(`
    SELECT sp.id, sp.photo_path
    FROM service_photos sp
    JOIN service_orders so ON so.id = sp.service_order_id
    WHERE sp.phase = 'before'
      AND so.status = 'pending'
      AND (so.employee_posto IS NULL OR so.employee_posto = '')
  `);

  console.log(`Fotos órfãs encontradas: ${result.rows.length}`);
  if (result.rows.length === 0) { process.exit(0); }

  for (const row of result.rows) {
    console.log(`  id=${row.id} path=${row.photo_path}`);
    await storage.delete(row.photo_path);
    await db.query('DELETE FROM service_photos WHERE id = $1', [row.id]);
    console.log(`  -> deletado`);
  }

  console.log('Limpeza concluída.');
  process.exit(0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
