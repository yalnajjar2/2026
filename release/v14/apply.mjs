import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

async function decodePayload(path) {
  const text = (await readFile(new URL(path, import.meta.url), 'utf8')).trim();
  return gunzipSync(Buffer.from(text, 'base64')).toString('utf8');
}

async function decodeChunks(prefix, count) {
  let text = '';
  for (let i = 0; i < count; i++) {
    text += (await readFile(new URL(`./${prefix}.${String(i).padStart(2, '0')}`, import.meta.url), 'utf8')).trim();
  }
  return gunzipSync(Buffer.from(text, 'base64')).toString('utf8');
}

const server = await decodePayload('./server.payload');
const app = await decodeChunks('app', 6);
await writeFile(new URL('../../server.mjs', import.meta.url), server);
await writeFile(new URL('../../app.html', import.meta.url), app);
console.log('Applied Baqala live release 1.4');
