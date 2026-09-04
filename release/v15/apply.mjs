import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

async function decode(prefix, count) {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += (await readFile(new URL(`./${prefix}.${String(i).padStart(2, '0')}`, import.meta.url), 'utf8')).trim();
  }
  return gunzipSync(Buffer.from(out, 'base64'));
}

await writeFile(new URL('../../server.mjs', import.meta.url), await decode('server', 6));
await writeFile(new URL('../../app.html', import.meta.url), await decode('app', 10));
console.log('Applied Baqala live release 1.5');
