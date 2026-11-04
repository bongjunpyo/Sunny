import { readFile, writeFile, rename, unlink, chmod, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
const root = new URL('../../', import.meta.url);
let temporary;
try {
  const source = new URL('backend/.env.local', root);
  const target = new URL('frontend/.env.local', root);
  if (!(await lstat(source)).isFile()) throw new Error('Local DB settings missing');
  const db = parseEnv(await readFile(source,'utf8'));
  for (const key of ['SUNNY_PG_AUTH_PASSWORD','SUNNY_PG_APP_PASSWORD']) if (!db[key]) throw new Error('Run DB prepare first');
  let existing = '';
  let existed = false;
  try {
    if (!(await lstat(target)).isFile()) throw new Error('Invalid environment file');
    existing = await readFile(target,'utf8'); existed = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const values = parseEnv(existing);
  const connection = (role,key) => `postgresql://${role}:${encodeURIComponent(db[key])}@127.0.0.1:${db.SUNNY_PG_PORT || '5434'}/sunny`;
  const candidates = { AUTH_ENABLED:'true', AUTH_DATABASE_URL:connection('sunny_auth','SUNNY_PG_AUTH_PASSWORD'),
    DATABASE_URL:connection('sunny_app','SUNNY_PG_APP_PASSWORD'), BETTER_AUTH_URL:'http://localhost:3000',
    BETTER_AUTH_SECRET:randomBytes(48).toString('base64url') };
  const additions = Object.fromEntries(Object.entries(candidates).filter(([key]) => values[key] === undefined || values[key] === ''));
  const count = Object.keys(additions).length;
  if (count) {
    const lines = existing.split(/\r?\n/).map(line => {
      const key = line.match(/^\s*([A-Z_]+)\s*=/)?.[1];
      if (key && key in additions) { const replacement=`${key}=${additions[key]}`; delete additions[key]; return replacement; }
      return line;
    });
    lines.push('# Sunny local authentication (never commit).',...Object.entries(additions).map(([key,value])=>`${key}=${value}`),'');
    temporary = new URL(`frontend/.env.sunny-tmp-${randomBytes(12).toString('hex')}`,root);
    await writeFile(temporary,lines.join('\n'),{mode:0o600,flag:'wx'});
    if (existed && await readFile(target,'utf8') !== existing) throw new Error('Local configuration changed concurrently');
    if (!existed) { try { await lstat(target); throw new Error('Local configuration appeared concurrently'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; } }
    await rename(temporary,target); temporary=undefined;
  }
  await chmod(target,0o600);
  console.log(`Local authentication settings prepared: ${count} missing/empty values filled; configured values preserved; no secrets displayed.`);
  console.log('Email signup requires real email settings or explicit development-only local mail. See backend/README.md.');
} catch { console.error('Local authentication preparation failed. Check DB settings and file permissions locally.'); process.exitCode=1; }
finally { if (temporary) await unlink(temporary).catch(()=>{}); }
