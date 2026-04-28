// Script de migração única: copia fotos do disco local para o S3.
// Uso: node scripts/migrate-to-s3.js
// Requer: .env com DATABASE_URL, AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, PHOTOS_BASE_PATH

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');
const AWS  = require('aws-sdk');

const BASE_DIR = path.resolve(process.env.PHOTOS_BASE_PATH || './storage/photos');
const BUCKET   = process.env.AWS_BUCKET;
const REGION   = process.env.AWS_REGION;

if (!BUCKET || !REGION) {
  console.error('Erro: AWS_BUCKET e AWS_REGION devem estar definidos no .env');
  process.exit(1);
}

const s3 = new AWS.S3({ region: REGION });

async function fetchAllPhotoPaths(client) {
  const queries = [
    `SELECT DISTINCT photo_path AS p FROM clock_records
      WHERE photo_path IS NOT NULL AND photo_path NOT LIKE 'placeholder/%'`,
    `SELECT DISTINCT photo_path AS p FROM clock_photos
      WHERE photo_path IS NOT NULL`,
    `SELECT DISTINCT photo_path AS p FROM service_photos
      WHERE photo_path IS NOT NULL`,
  ];

  const paths = new Set();
  for (const sql of queries) {
    const result = await client.query(sql);
    for (const row of result.rows) paths.add(row.p);
  }
  return [...paths];
}

async function uploadToS3(localPath, key) {
  const buffer = fs.readFileSync(localPath);
  await s3.putObject({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: 'image/jpeg',
  }).promise();
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log('Buscando caminhos de fotos no banco...');
  const photoPaths = await fetchAllPhotoPaths(client);
  console.log(`Total de fotos a migrar: ${photoPaths.length}`);

  const errors = [];
  let success  = 0;

  for (let i = 0; i < photoPaths.length; i++) {
    const key       = photoPaths[i];
    const localFile = path.resolve(BASE_DIR, key);
    process.stdout.write(`[${i + 1}/${photoPaths.length}] ${key} ... `);

    if (!fs.existsSync(localFile)) {
      console.log('IGNORADO (arquivo não existe localmente)');
      errors.push({ key, reason: 'arquivo não encontrado localmente' });
      continue;
    }

    try {
      await uploadToS3(localFile, key);
      console.log('OK');
      success++;
    } catch (err) {
      console.log(`ERRO: ${err.message}`);
      errors.push({ key, reason: err.message });
    }
  }

  await client.end();

  console.log(`\nMigração concluída: ${success} OK, ${errors.length} erros.`);
  if (errors.length > 0) {
    console.log('\nArquivos com erro:');
    for (const e of errors) console.log(`  - ${e.key}: ${e.reason}`);
  }
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
