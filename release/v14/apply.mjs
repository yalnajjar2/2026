import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

async function readText(path) {
  return (await readFile(new URL(path, import.meta.url), 'utf8')).trim();
}

async function decodePayload(path) {
  return gunzipSync(Buffer.from(await readText(path), 'base64')).toString('utf8');
}

const server = await decodePayload('./server.payload');
const parts = ['./app.00','./app.01a','./app.01b','./app.02','./app.03','./app.04','./app.05'];
let appPayload = '';
for (const part of parts) appPayload += await readText(part);
const app = gunzipSync(Buffer.from(appPayload, 'base64')).toString('utf8');

await writeFile(new URL('../../server.mjs', import.meta.url), server);
await writeFile(new URL('../../app.html', import.meta.url), app);
console.log('Applied Baqala live release 1.4');
