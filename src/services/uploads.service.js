const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const publicRoot = path.resolve(process.env.PUBLIC_UPLOAD_DIR || path.join(__dirname, '../public/uploads'));
function validateUpload(file, allowPdf = false) {
  const data = file?.buffer;
  if (!Buffer.isBuffer(data) || !data.length || data.length > 8 * 1024 * 1024) throw Object.assign(new Error('Fichier vide ou supérieur à 8 Mo.'), { status: 400 });
  let type;
  if (data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) type = ['image/png','png'];
  else if (data[0] === 255 && data[1] === 216 && data[2] === 255) type = ['image/jpeg','jpg'];
  else if (data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP') type = ['image/webp','webp'];
  else if (allowPdf && data.toString('ascii',0,5) === '%PDF-') type = ['application/pdf','pdf'];
  if (!type || file.mimetype !== type[0]) throw Object.assign(new Error('Le contenu du fichier ne correspond pas à un format autorisé.'), { status: 400 });
  return { mimetype: type[0], extension: type[1] };
}
async function uploadPublicImage(breederId, file, folder = 'images') {
  if (!file) return null;
  const { extension } = validateUpload(file);
  if (!/^[a-f0-9-]{36}$/i.test(breederId) || !/^[a-z0-9/-]+$/i.test(folder) || folder.includes('..')) throw new Error('Emplacement de fichier invalide.');
  // Unique server-controlled names; no replacement of existing breeder files.
  const relative = `images/${breederId}/${folder}/${randomUUID()}.${extension}`;
  const destination = path.join(publicRoot, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, file.buffer, { flag: 'wx' });
  return '/uploads/' + relative;
}
module.exports = { publicRoot, validateUpload, uploadPublicImage };
