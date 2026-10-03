const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');
const { publicRoot } = require('../uploads.service');

const MAX_BYTES = 8 * 1024 * 1024;
const LOGO_SIZE = 131.04; // 4.62 cm, as in the supplied Word quote.

async function loadLogo(breeder) {
  if (!breeder?.logo_url || !/^[a-f0-9-]{36}$/i.test(breeder.id || '')) return null;
  try {
    let buffer;
    const prefix = `/uploads/images/${breeder.id}/logos/`;
    if (breeder.logo_url.startsWith(prefix)) {
      const filename = breeder.logo_url.slice(prefix.length);
      if (!/^[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/i.test(filename)) return null;
      const directory = await fs.realpath(path.join(publicRoot, 'images', breeder.id, 'logos'));
      const target = await fs.realpath(path.join(directory, filename));
      if (path.dirname(target) !== directory) return null;
      if ((await fs.stat(target)).size > MAX_BYTES) return null;
      buffer = await fs.readFile(target);
    } else {
      // Support older Supabase uploads, never arbitrary external URLs or redirects.
      if (!process.env.SUPABASE_URL) return null;
      const url = new URL(breeder.logo_url);
      const storage = new URL(process.env.SUPABASE_URL);
      if (url.protocol !== 'https:' || url.origin !== storage.origin || url.username || url.password) return null;
      const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      if (segments.slice(0, 4).join('/') !== 'storage/v1/object/public' || !segments[4]) return null;
      const key = segments.slice(5);
      if (key[0] === 'images') key.shift();
      if (key.length !== 3 || key[0] !== breeder.id || key[1] !== 'logos' || !/^[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/i.test(key[2])) return null;
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_BYTES) return null;
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > MAX_BYTES) throw new Error('Logo trop volumineux');
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    }
    // PDFKit needs PNG/JPEG. Normalisation also handles uploaded WebP and EXIF rotation.
    return await sharp(buffer, { limitInputPixels: 25000000, pages: 1 })
      .rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  } catch {
    console.warn('[documents] Logo indisponible ; génération sans logo.');
    return null;
  }
}

function drawLogo(doc, buffer) {
  if (!buffer) return false;
  const { left, right } = doc.page.margins;
  const y = doc.y;
  const x = left + (doc.page.width - left - right - LOGO_SIZE) / 2;
  doc.image(buffer, x, y, { fit: [LOGO_SIZE, LOGO_SIZE], align: 'center', valign: 'center' });
  doc.x = left;
  doc.y = y + LOGO_SIZE + 7;
  return true;
}

module.exports = { loadLogo, drawLogo, LOGO_SIZE };
