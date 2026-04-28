// Abstração de armazenamento de fotos
// Troque STORAGE_DRIVER=s3 no .env para migrar para AWS S3 sem alterar o resto do código

const fs   = require('fs').promises;
const path = require('path');

const BASE_DIR = path.resolve(process.env.PHOTOS_BASE_PATH || './storage/photos');

// Resolve um filename relativo garantindo que permanece dentro de BASE_DIR.
// Bloqueia tentativas de path traversal (../, caminhos absolutos, symlinks-like).
function resolveSafe(filename) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new Error('Caminho de arquivo inválido.');
  }
  // Rejeita caminhos absolutos e segmentos suspeitos antes de resolver
  if (path.isAbsolute(filename) || filename.includes('\0')) {
    throw new Error('Caminho de arquivo inválido.');
  }
  const fullPath = path.resolve(BASE_DIR, filename);
  const rel      = path.relative(BASE_DIR, fullPath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Caminho de arquivo fora do diretório permitido.');
  }
  return fullPath;
}

// ----------------------------------------------------------------
// Driver local (disco)
// ----------------------------------------------------------------
const localDriver = {
  /**
   * Salva um buffer de imagem no disco.
   * @param {Buffer} buffer  - dados da imagem
   * @param {string} filename - caminho relativo a BASE_DIR (ex: 'CEF10/2025-04-09/123_1744185600.jpg')
   */
  async save(buffer, filename) {
    const fullPath = resolveSafe(filename);
    // Garante que o diretório pai existe
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return filename;
  },

  /**
   * Retorna a URL para servir a foto via endpoint autenticado do Express.
   * Nunca expõe o path físico do disco.
   */
  getUrl(filePath) {
    return `/api/admin/photos/${encodeURIComponent(filePath)}`;
  },

  async delete(filePath) {
    let fullPath;
    try { fullPath = resolveSafe(filePath); } catch { return; } // ignora caminhos inválidos
    await fs.unlink(fullPath).catch(() => {}); // ignora se não existir
  },

  // Para o driver local, lê o arquivo e retorna o buffer para stream
  async getBuffer(filePath) {
    const fullPath = resolveSafe(filePath);
    return fs.readFile(fullPath);
  },
};

// ----------------------------------------------------------------
// Driver S3 (AWS)
// Ativado com STORAGE_DRIVER=s3 no .env
// ----------------------------------------------------------------
const s3Driver = {
  async save(buffer, filename) {
    const AWS = require('aws-sdk');
    const s3  = new AWS.S3();
    await s3.putObject({
      Bucket: process.env.AWS_BUCKET,
      Key:    filename,
      Body:   buffer,
      ContentType: 'image/jpeg',
    }).promise();
    return filename;
  },

  getUrl(key) {
    const AWS = require('aws-sdk');
    const s3  = new AWS.S3();
    return s3.getSignedUrlPromise('getObject', {
      Bucket:  process.env.AWS_BUCKET,
      Key:     key,
      Expires: 3600, // URL válida por 1 hora
    });
  },

  async delete(key) {
    const AWS = require('aws-sdk');
    const s3  = new AWS.S3();
    await s3.deleteObject({ Bucket: process.env.AWS_BUCKET, Key: key }).promise();
  },

  async getBuffer(key) {
    const AWS = require('aws-sdk');
    const s3  = new AWS.S3();
    const obj = await s3.getObject({ Bucket: process.env.AWS_BUCKET, Key: key }).promise();
    return obj.Body;
  },
};

const driver = process.env.STORAGE_DRIVER === 's3' ? s3Driver : localDriver;

module.exports = driver;
