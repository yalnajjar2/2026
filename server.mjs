import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { randomBytes, scrypt as scryptCb, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
const scrypt = promisify(scryptCb);
const COOKIE = 'baqala_session';
const CATEGORIES = [
  ['home','صيانة المنازل','⌂'],['electrical','الكهرباء','⚡'],['plumbing','السباكة','◌'],
  ['design','التصميم والإبداع','✦'],['tech','الخدمات التقنية','⌘'],['education','التعليم والدروس','⌁'],
  ['business','خدمات الأعمال','▥'],['cars','خدمات السيارات','◉'],['events','خدمات المناسبات','◇'],
  ['cleaning','التنظيف','✧'],['photo','التصوير والمونتاج','◍'],['translation','الترجمة والكتابة','文']
];

await app.register(cookie);
await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
await app.register(rateLimit, { max: 240, timeWindow: '1 minute', ban: 2 });

function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
function cleanText(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
function asNumber(value, fallback = null) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
function publicUser(u) { return u ? { id:u.id, name:u.name, email:u.email, role:u.role, city:u.city, status:u.status, providerId:u.provider_id || null } : null; }

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [, salt, hex] = String(stored || '').split('$');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function init() {
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS btree_gist;

    CREATE TABLE IF NOT EXISTS live_users(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      email text UNIQUE NOT NULL,
      password text NOT NULL,
      role text NOT NULL DEFAULT 'customer',
      city text,
      status text NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE live_users ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

    CREATE TABLE IF NOT EXISTS live_sessions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES live_users(id) ON DELETE CASCADE,
      token_hash text UNIQUE NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS live_providers(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid UNIQUE NOT NULL REFERENCES live_users(id) ON DELETE CASCADE,
      title text NOT NULL,
      bio text,
      city text NOT NULL,
      district text,
      verified boolean NOT NULL DEFAULT false,
      verification_status text NOT NULL DEFAULT 'NOT_SUBMITTED',
      rating numeric(3,2) NOT NULL DEFAULT 0,
      rating_count int NOT NULL DEFAULT 0,
      completed int NOT NULL DEFAULT 0,
      lat numeric(9,6),
      lng numeric(9,6),
      timezone text NOT NULL DEFAULT 'Asia/Aden',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE live_providers ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'NOT_SUBMITTED';
    ALTER TABLE live_providers ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Aden';
    ALTER TABLE live_providers ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

    CREATE TABLE IF NOT EXISTS live_services(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id uuid NOT NULL REFERENCES live_providers(id) ON DELETE CASCADE,
      category text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      price numeric(18,2),
      pricing text NOT NULL DEFAULT 'STARTING_FROM',
      location_type text NOT NULL DEFAULT 'CUSTOMER_LOCATION',
      duration int NOT NULL DEFAULT 60,
      status text NOT NULL DEFAULT 'ACTIVE',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE live_services ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    CREATE TABLE IF NOT EXISTS live_bookings(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid NOT NULL REFERENCES live_users(id),
      provider_id uuid NOT NULL REFERENCES live_providers(id),
      service_id uuid NOT NULL REFERENCES live_services(id),
      status text NOT NULL DEFAULT 'PENDING',
      starts_at timestamptz NOT NULL,
      ends_at timestamptz NOT NULL,
      description text NOT NULL,
      location text,
      price numeric(18,2),
      cancel_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE live_bookings ADD COLUMN IF NOT EXISTS cancel_reason text;
    ALTER TABLE live_bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

    CREATE TABLE IF NOT EXISTS live_reviews(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid UNIQUE NOT NULL REFERENCES live_bookings(id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES live_users(id),
      provider_id uuid NOT NULL REFERENCES live_providers(id),
      rating int NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS live_messages(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL REFERENCES live_bookings(id) ON DELETE CASCADE,
      sender_id uuid NOT NULL REFERENCES live_users(id),
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS live_favorites(
      user_id uuid NOT NULL REFERENCES live_users(id) ON DELETE CASCADE,
      service_id uuid NOT NULL REFERENCES live_services(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS live_notifications(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES live_users(id) ON DELETE CASCADE,
      kind text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      entity_type text,
      entity_id uuid,
      read_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS live_availability(
      provider_id uuid NOT NULL REFERENCES live_providers(id) ON DELETE CASCADE,
      weekday int NOT NULL CHECK(weekday BETWEEN 0 AND 6),
      start_time time NOT NULL,
      end_time time NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      PRIMARY KEY(provider_id, weekday)
    );

    CREATE TABLE IF NOT EXISTS live_unavailable_dates(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id uuid NOT NULL REFERENCES live_providers(id) ON DELETE CASCADE,
      date date NOT NULL,
      note text,
      UNIQUE(provider_id, date)
    );

    CREATE TABLE IF NOT EXISTS live_verification_requests(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id uuid NOT NULL REFERENCES live_providers(id) ON DELETE CASCADE,
      document_ref text,
      status text NOT NULL DEFAULT 'PENDING',
      provider_note text,
      admin_note text,
      submitted_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS live_disputes(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid UNIQUE NOT NULL REFERENCES live_bookings(id) ON DELETE CASCADE,
      opened_by uuid NOT NULL REFERENCES live_users(id),
      reason text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'OPEN',
      admin_response text,
      created_at timestamptz NOT NULL DEFAULT now(),
      resolved_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS live_reports(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id uuid NOT NULL REFERENCES live_users(id),
      target_type text NOT NULL,
      target_id uuid,
      reason text NOT NULL,
      description text,
      status text NOT NULL DEFAULT 'OPEN',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS live_admin_logs(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id uuid NOT NULL REFERENCES live_users(id),
      action text NOT NULL,
      target_type text NOT NULL,
      target_id uuid,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS live_service_filter ON live_services(category,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS live_booking_provider ON live_bookings(provider_id,status,starts_at,ends_at);
    CREATE INDEX IF NOT EXISTS live_booking_customer ON live_bookings(customer_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS live_notifications_user ON live_notifications(user_id,read_at,created_at DESC);
    CREATE INDEX IF NOT EXISTS live_messages_booking ON live_messages(booking_id,created_at);
  `);

  await db.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='live_booking_no_overlap') THEN
      ALTER TABLE live_bookings ADD CONSTRAINT live_booking_no_overlap
      EXCLUDE USING gist (
        provider_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      ) WHERE (status IN ('ACCEPTED','CONFIRMED','IN_PROGRESS'));
    END IF;
  END $$;`);

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = String(process.env.ADMIN_EMAIL).toLowerCase();
    const existing = await db.query('SELECT id FROM live_users WHERE email=$1', [email]);
    if (!existing.rows[0]) {
      await db.query('INSERT INTO live_users(name,email,password,role,status) VALUES($1,$2,$3,$4,$5)', [
        'مدير بقالة', email, await hashPassword(process.env.ADMIN_PASSWORD), 'admin', 'ACTIVE'
      ]);
    }
  }
}

async function current(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const q = await db.query(`
    SELECT u.*,(SELECT id FROM live_providers p WHERE p.user_id=u.id) provider_id
    FROM live_sessions s JOIN live_users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now()
  `, [hashToken(token)]);
  return q.rows[0] || null;
}

async function need(req, res, roles = []) {
  const u = await current(req);
  if (!u) { res.code(401).send({ error:'AUTH_REQUIRED' }); return null; }
  if (u.status !== 'ACTIVE') { res.code(403).send({ error:'ACCOUNT_NOT_ACTIVE' }); return null; }
  if (roles.length && !roles.includes(u.role)) { res.code(403).send({ error:'FORBIDDEN' }); return null; }
  return u;
}

async function issueSession(res, userId) {
  const token = randomBytes(32).toString('base64url');
  await db.query("DELETE FROM live_sessions WHERE user_id=$1 AND expires_at<now()", [userId]);
  await db.query("INSERT INTO live_sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '30 days')", [userId, hashToken(token)]);
  res.setCookie(COOKIE, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:60*60*24*30 });
}

async function providerForUser(userId) {
  return (await db.query('SELECT * FROM live_providers WHERE user_id=$1', [userId])).rows[0] || null;
}

async function bookingForUser(bookingId, user) {
  const q = await db.query(`
    SELECT b.*,p.user_id provider_user,s.title service_title,cu.name customer_name,pu.name provider_name
    FROM live_bookings b
    JOIN live_providers p ON p.id=b.provider_id
    JOIN live_services s ON s.id=b.service_id
    JOIN live_users cu ON cu.id=b.customer_id
    JOIN live_users pu ON pu.id=p.user_id
    WHERE b.id=$1
  `, [bookingId]);
  const b = q.rows[0];
  if (!b) return null;
  if (user.role === 'admin' || b.customer_id === user.id || b.provider_user === user.id) return b;
  return null;
}

async function notify(userId, kind, title, body, entityType = null, entityId = null) {
  if (!userId) return;
  await db.query(`INSERT INTO live_notifications(user_id,kind,title,body,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6)`,
    [userId, kind, cleanText(title,160), cleanText(body,500), entityType, entityId]);
}

async function adminLog(adminId, action, targetType, targetId, metadata = {}) {
  await db.query('INSERT INTO live_admin_logs(admin_id,action,target_type,target_id,metadata) VALUES($1,$2,$3,$4,$5)',
    [adminId, action, targetType, targetId, metadata]);
}

app.get('/api/health', async () => {
  await db.query('SELECT 1');
  return { status:'ok', service:'baqala-live', version:'1.2.0', database:'ok' };
});

app.get('/api/categories', async () => CATEGORIES.map(([slug,name,icon]) => ({ slug,name,icon })));

app.get('/api/public/stats', async () => {
  const q = await db.query(`SELECT
    (SELECT count(*)::int FROM live_services WHERE status='ACTIVE') services,
    (SELECT count(*)::int FROM live_providers) providers,
    (SELECT count(*)::int FROM live_bookings WHERE status='COMPLETED') completed,
    (SELECT COALESCE(round(avg(rating)::numeric,1),0) FROM live_reviews) rating`);
  return q.rows[0];
});

app.post('/api/auth/register', { config:{ rateLimit:{ max:12, timeWindow:'1 minute' } } }, async (req,res) => {
  const b = req.body || {};
  const name = cleanText(b.name,100), email = cleanText(b.email,200).toLowerCase(), city = cleanText(b.city,100);
  if (name.length < 2 || !isEmail(email) || String(b.password || '').length < 10) return res.code(400).send({ error:'INVALID_INPUT' });
  try {
    const q = await db.query(`INSERT INTO live_users(name,email,password,city) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,city,status`,
      [name,email,await hashPassword(b.password),city||null]);
    await issueSession(res,q.rows[0].id);
    return q.rows[0];
  } catch (e) {
    if (e.code === '23505') return res.code(409).send({ error:'ACCOUNT_EXISTS' });
    throw e;
  }
});

app.post('/api/auth/login', { config:{ rateLimit:{ max:16, timeWindow:'1 minute' } } }, async (req,res) => {
  const b = req.body || {}, email = cleanText(b.email,200).toLowerCase();
  const q = await db.query('SELECT * FROM live_users WHERE email=$1', [email]);
  const u = q.rows[0];
  if (!u || !await verifyPassword(String(b.password || ''),u.password)) return res.code(401).send({ error:'INVALID_CREDENTIALS' });
  if (u.status !== 'ACTIVE') return res.code(403).send({ error:'ACCOUNT_NOT_ACTIVE' });
  await issueSession(res,u.id);
  return publicUser(u);
});

app.post('/api/auth/logout', async (req,res) => {
  const token=req.cookies[COOKIE];
  if (token) await db.query('DELETE FROM live_sessions WHERE token_hash=$1',[hashToken(token)]);
  res.clearCookie(COOKIE,{path:'/'});
  return {ok:true};
});

app.get('/api/auth/me', async (req,res) => {
  const u = await need(req,res); if (!u) return;
  return publicUser(u);
});

app.patch('/api/profile', async (req,res) => {
  const u=await need(req,res); if(!u) return;
  const name=cleanText(req.body?.name,100),city=cleanText(req.body?.city,100);
  if(name.length<2)return res.code(400).send({error:'INVALID_NAME'});
  const q=await db.query('UPDATE live_users SET name=$1,city=$2 WHERE id=$3 RETURNING id,name,email,role,city,status',[name,city||null,u.id]);
  return q.rows[0];
});

app.get('/api/services', async (req) => {
  const q=req.query||{}, v=[], w=["s.status='ACTIVE'"];
  if(q.q){v.push(`%${cleanText(q.q,120)}%`);w.push(`(s.title ILIKE $${v.length} OR s.description ILIKE $${v.length} OR u.name ILIKE $${v.length})`);}
  if(q.category){v.push(cleanText(q.category,60));w.push(`s.category=$${v.length}`);}
  if(q.city){v.push(cleanText(q.city,100));w.push(`p.city ILIKE $${v.length}`);}
  if(q.verified==='true')w.push('p.verified=true');
  if(q.minPrice){v.push(asNumber(q.minPrice,0));w.push(`s.price >= $${v.length}`);}
  if(q.maxPrice){v.push(asNumber(q.maxPrice,999999999));w.push(`s.price <= $${v.length}`);}
  const order = q.sort==='price_low'?'s.price ASC NULLS LAST':q.sort==='price_high'?'s.price DESC NULLS LAST':q.sort==='rating'?'p.rating DESC,p.rating_count DESC':'s.created_at DESC';
  const x=await db.query(`SELECT s.*,p.title provider_title,p.city,p.district,p.verified,p.rating,p.rating_count,u.name provider_name
    FROM live_services s JOIN live_providers p ON p.id=s.provider_id JOIN live_users u ON u.id=p.user_id
    WHERE ${w.join(' AND ')} ORDER BY ${order} LIMIT 80`,v);
  return x.rows;
});

app.get('/api/services/:id', async (req,res) => {
  const q=await db.query(`SELECT s.*,p.id provider_id,p.title provider_title,p.bio provider_bio,p.city,p.district,p.verified,p.verification_status,p.rating,p.rating_count,p.completed,u.name provider_name
    FROM live_services s JOIN live_providers p ON p.id=s.provider_id JOIN live_users u ON u.id=p.user_id WHERE s.id=$1 AND s.status<>'ARCHIVED'`,[req.params.id]);
  if(!q.rows[0])return res.code(404).send({error:'NOT_FOUND'});
  const reviews=await db.query(`SELECT r.id,r.rating,r.comment,r.created_at,u.name customer_name FROM live_reviews r JOIN live_users u ON u.id=r.customer_id WHERE r.provider_id=$1 ORDER BY r.created_at DESC LIMIT 20`,[q.rows[0].provider_id]);
  return {...q.rows[0],reviews:reviews.rows};
});

app.get('/api/providers', async (req) => {
  const q=req.query||{},v=[],w=['1=1'];
  if(q.q){v.push(`%${cleanText(q.q,120)}%`);w.push(`(u.name ILIKE $${v.length} OR p.title ILIKE $${v.length} OR p.bio ILIKE $${v.length})`);}
  if(q.city){v.push(cleanText(q.city,100));w.push(`p.city ILIKE $${v.length}`);}
  if(q.verified==='true')w.push('p.verified=true');
  const x=await db.query(`SELECT p.*,u.name,(SELECT count(*)::int FROM live_services s WHERE s.provider_id=p.id AND s.status='ACTIVE') service_count FROM live_providers p JOIN live_users u ON u.id=p.user_id WHERE ${w.join(' AND ')} ORDER BY p.verified DESC,p.rating DESC,p.completed DESC LIMIT 60`,v);
  return x.rows;
});

app.get('/api/providers/:id', async (req,res) => {
  const p=(await db.query(`SELECT p.*,u.name,u.created_at user_since FROM live_providers p JOIN live_users u ON u.id=p.user_id WHERE p.id=$1`,[req.params.id])).rows[0];
  if(!p)return res.code(404).send({error:'NOT_FOUND'});
  const [services,reviews]=await Promise.all([
    db.query("SELECT * FROM live_services WHERE provider_id=$1 AND status='ACTIVE' ORDER BY created_at DESC",[p.id]),
    db.query(`SELECT r.rating,r.comment,r.created_at,u.name customer_name FROM live_reviews r JOIN live_users u ON u.id=r.customer_id WHERE r.provider_id=$1 ORDER BY r.created_at DESC LIMIT 30`,[p.id])
  ]);
  return {...p,services:services.rows,reviews:reviews.rows};
});

app.post('/api/provider/onboard', async (req,res) => {
  const u=await need(req,res);if(!u)return;
  const b=req.body||{},title=cleanText(b.title,120),city=cleanText(b.city,100);
  if(title.length<2||city.length<2)return res.code(400).send({error:'INVALID_INPUT'});
  try{
    const q=await db.query(`INSERT INTO live_providers(user_id,title,bio,city,district,lat,lng,timezone) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [u.id,title,cleanText(b.bio,1200)||null,city,cleanText(b.district,100)||null,asNumber(b.lat),asNumber(b.lng),cleanText(b.timezone,80)||'Asia/Aden']);
    await db.query("UPDATE live_users SET role='provider' WHERE id=$1",[u.id]);
    return q.rows[0];
  }catch(e){if(e.code==='23505')return res.code(409).send({error:'PROVIDER_EXISTS'});throw e;}
});

app.get('/api/provider/me', async (req,res) => { const u=await need(req,res,['provider','admin']);if(!u)return; const p=await providerForUser(u.id); if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'}); return p; });

app.patch('/api/provider/me', async (req,res) => {
  const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});
  const b=req.body||{};
  const q=await db.query(`UPDATE live_providers SET title=$1,bio=$2,city=$3,district=$4,lat=$5,lng=$6,timezone=$7 WHERE id=$8 RETURNING *`,[
    cleanText(b.title||p.title,120),cleanText(b.bio??p.bio,1200)||null,cleanText(b.city||p.city,100),cleanText(b.district??p.district,100)||null,asNumber(b.lat,p.lat),asNumber(b.lng,p.lng),cleanText(b.timezone||p.timezone,80),p.id
  ]);return q.rows[0];
});

app.get('/api/provider/services', async (req,res) => {const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return [];return (await db.query('SELECT * FROM live_services WHERE provider_id=$1 ORDER BY created_at DESC',[p.id])).rows;});

app.post('/api/services', async (req,res) => {
  const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(400).send({error:'PROVIDER_REQUIRED'});
  const b=req.body||{},title=cleanText(b.title,160),description=cleanText(b.description,3000),category=cleanText(b.category,80);
  if(title.length<3||description.length<10||!category)return res.code(400).send({error:'INVALID_INPUT'});
  const price=b.price===''||b.price==null?null:asNumber(b.price);
  if(price!=null&&price<0)return res.code(400).send({error:'INVALID_PRICE'});
  const q=await db.query(`INSERT INTO live_services(provider_id,category,title,description,price,pricing,location_type,duration) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [p.id,category,title,description,price,cleanText(b.pricing,40)||'STARTING_FROM',cleanText(b.locationType,50)||'CUSTOMER_LOCATION',Math.max(15,Math.min(1440,asNumber(b.duration,60)))]);
  return q.rows[0];
});

app.patch('/api/services/:id', async (req,res) => {
  const u=await need(req,res,['provider','admin']);if(!u)return;
  const s=(await db.query('SELECT s.*,p.user_id FROM live_services s JOIN live_providers p ON p.id=s.provider_id WHERE s.id=$1',[req.params.id])).rows[0];
  if(!s)return res.code(404).send({error:'NOT_FOUND'});if(u.role!=='admin'&&s.user_id!==u.id)return res.code(403).send({error:'FORBIDDEN'});
  const b=req.body||{};
  const q=await db.query(`UPDATE live_services SET category=$1,title=$2,description=$3,price=$4,pricing=$5,location_type=$6,duration=$7,status=$8,updated_at=now() WHERE id=$9 RETURNING *`,[
    cleanText(b.category||s.category,80),cleanText(b.title||s.title,160),cleanText(b.description||s.description,3000),b.price===undefined?s.price:(b.price==null?null:asNumber(b.price)),cleanText(b.pricing||s.pricing,40),cleanText(b.locationType||s.location_type,50),asNumber(b.duration,s.duration),cleanText(b.status||s.status,30),s.id
  ]);return q.rows[0];
});

app.get('/api/provider/availability', async (req,res) => {
  const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});
  const [weekly,off]=await Promise.all([db.query('SELECT * FROM live_availability WHERE provider_id=$1 ORDER BY weekday',[p.id]),db.query('SELECT * FROM live_unavailable_dates WHERE provider_id=$1 AND date>=current_date ORDER BY date LIMIT 60',[p.id])]);
  return {weekly:weekly.rows,unavailableDates:off.rows,timezone:p.timezone};
});

app.put('/api/provider/availability', async (req,res) => {
  const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});
  const rows=Array.isArray(req.body?.weekly)?req.body.weekly:[];
  const client=await db.connect();try{await client.query('BEGIN');await client.query('DELETE FROM live_availability WHERE provider_id=$1',[p.id]);for(const r of rows){const wd=asNumber(r.weekday);if(wd<0||wd>6)continue;await client.query('INSERT INTO live_availability(provider_id,weekday,start_time,end_time,enabled) VALUES($1,$2,$3,$4,$5)',[p.id,wd,cleanText(r.startTime,8),cleanText(r.endTime,8),r.enabled!==false]);}await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}return{ok:true};
});

app.post('/api/provider/unavailable-dates', async (req,res) => {const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});const date=cleanText(req.body?.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.code(400).send({error:'INVALID_DATE'});await db.query('INSERT INTO live_unavailable_dates(provider_id,date,note) VALUES($1,$2,$3) ON CONFLICT(provider_id,date) DO UPDATE SET note=EXCLUDED.note',[p.id,date,cleanText(req.body?.note,300)||null]);return{ok:true};});
app.delete('/api/provider/unavailable-dates/:id', async (req,res) => {const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});await db.query('DELETE FROM live_unavailable_dates WHERE id=$1 AND provider_id=$2',[req.params.id,p.id]);return{ok:true};});

app.get('/api/provider/verification', async (req,res) => {const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});return (await db.query('SELECT * FROM live_verification_requests WHERE provider_id=$1 ORDER BY submitted_at DESC LIMIT 10',[p.id])).rows;});
app.post('/api/provider/verification', async (req,res) => {const u=await need(req,res,['provider','admin']);if(!u)return;const p=await providerForUser(u.id);if(!p)return res.code(404).send({error:'PROVIDER_REQUIRED'});const pending=(await db.query("SELECT id FROM live_verification_requests WHERE provider_id=$1 AND status IN ('PENDING','UNDER_REVIEW') LIMIT 1",[p.id])).rows[0];if(pending)return res.code(409).send({error:'VERIFICATION_ALREADY_PENDING'});const q=await db.query('INSERT INTO live_verification_requests(provider_id,document_ref,provider_note) VALUES($1,$2,$3) RETURNING *',[p.id,cleanText(req.body?.documentRef,500)||null,cleanText(req.body?.note,1000)||null]);await db.query("UPDATE live_providers SET verification_status='PENDING' WHERE id=$1",[p.id]);return q.rows[0];});

app.get('/api/bookings', async (req,res) => {
  const u=await need(req,res);if(!u)return;
  const q=await db.query(`SELECT b.*,s.title service_title,s.category,pu.name provider_name,cu.name customer_name,p.user_id provider_user,
    EXISTS(SELECT 1 FROM live_reviews r WHERE r.booking_id=b.id) reviewed,
    EXISTS(SELECT 1 FROM live_disputes d WHERE d.booking_id=b.id AND d.status IN ('OPEN','UNDER_REVIEW')) disputed
    FROM live_bookings b JOIN live_services s ON s.id=b.service_id JOIN live_providers p ON p.id=b.provider_id JOIN live_users pu ON pu.id=p.user_id JOIN live_users cu ON cu.id=b.customer_id
    WHERE b.customer_id=$1 OR p.user_id=$1 ORDER BY b.created_at DESC`,[u.id]);
  return q.rows;
});

app.post('/api/bookings', async (req,res) => {
  const u=await need(req,res);if(!u)return;const b=req.body||{};
  const s=(await db.query('SELECT s.*,p.user_id,p.timezone FROM live_services s JOIN live_providers p ON p.id=s.provider_id WHERE s.id=$1 AND s.status=$2',[b.serviceId,'ACTIVE'])).rows[0];
  if(!s)return res.code(404).send({error:'SERVICE_NOT_FOUND'});if(s.user_id===u.id)return res.code(400).send({error:'OWN_SERVICE'});
  const start=new Date(b.startsAt);if(Number.isNaN(start.getTime())||start<=new Date())return res.code(400).send({error:'INVALID_START_TIME'});
  const end=new Date(start.getTime()+(s.duration||60)*60000);
  const off=await db.query(`SELECT 1 FROM live_unavailable_dates WHERE provider_id=$1 AND date=($2::timestamptz AT TIME ZONE $3)::date LIMIT 1`,[s.provider_id,start,s.timezone||'Asia/Aden']);
  if(off.rows[0])return res.code(409).send({error:'PROVIDER_UNAVAILABLE'});
  const rules=await db.query(`SELECT * FROM live_availability WHERE provider_id=$1 AND weekday=EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE $3))::int AND enabled=true`,[s.provider_id,start,s.timezone||'Asia/Aden']);
  const anyRules=(await db.query('SELECT 1 FROM live_availability WHERE provider_id=$1 AND enabled=true LIMIT 1',[s.provider_id])).rows[0];
  if(anyRules&&!rules.rows[0])return res.code(409).send({error:'OUTSIDE_WORKING_DAYS'});
  if(rules.rows[0]){const local=await db.query(`SELECT ($1::timestamptz AT TIME ZONE $2)::time t1,($3::timestamptz AT TIME ZONE $2)::time t2`,[start,s.timezone||'Asia/Aden',end]);const {t1,t2}=local.rows[0];if(t1<rules.rows[0].start_time||t2>rules.rows[0].end_time)return res.code(409).send({error:'OUTSIDE_WORKING_HOURS'});}
  const c=await db.query(`SELECT 1 FROM live_bookings WHERE provider_id=$1 AND status IN ('ACCEPTED','CONFIRMED','IN_PROGRESS') AND starts_at<$3 AND ends_at>$2 LIMIT 1`,[s.provider_id,start,end]);
  if(c.rows[0])return res.code(409).send({error:'SLOT_UNAVAILABLE'});
  const q=await db.query(`INSERT INTO live_bookings(customer_id,provider_id,service_id,starts_at,ends_at,description,location,price) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [u.id,s.provider_id,s.id,start,end,cleanText(b.description,2000),cleanText(b.location,500)||null,s.price]);
  await notify(s.user_id,'BOOKING_NEW','طلب خدمة جديد',`لديك طلب جديد لخدمة ${s.title}`,'booking',q.rows[0].id);
  return q.rows[0];
});

const flow={PENDING:['ACCEPTED','REJECTED','CANCELLED'],ACCEPTED:['CONFIRMED','CANCELLED'],CONFIRMED:['IN_PROGRESS','CANCELLED'],IN_PROGRESS:['COMPLETED'],COMPLETED:[],CANCELLED:[],REJECTED:[]};
app.patch('/api/bookings/:id/status', async (req,res) => {
  const u=await need(req,res);if(!u)return;const b=await bookingForUser(req.params.id,u);if(!b)return res.code(404).send({error:'NOT_FOUND'});
  const to=cleanText(req.body?.status,30);if(!flow[b.status]?.includes(to))return res.code(400).send({error:'INVALID_TRANSITION'});
  if(['ACCEPTED','REJECTED','CONFIRMED','IN_PROGRESS','COMPLETED'].includes(to)&&u.id!==b.provider_user&&u.role!=='admin')return res.code(403).send({error:'PROVIDER_ACTION_REQUIRED'});
  if(to==='CANCELLED'&&u.id!==b.customer_id&&u.id!==b.provider_user&&u.role!=='admin')return res.code(403).send({error:'FORBIDDEN'});
  try{await db.query('UPDATE live_bookings SET status=$1,cancel_reason=$2,updated_at=now() WHERE id=$3',[to,to==='CANCELLED'?cleanText(req.body?.reason,500)||null:b.cancel_reason,b.id]);}
  catch(e){if(e.code==='23P01')return res.code(409).send({error:'SLOT_UNAVAILABLE'});throw e;}
  if(to==='COMPLETED')await db.query('UPDATE live_providers SET completed=completed+1 WHERE id=$1',[b.provider_id]);
  const target= u.id===b.customer_id ? b.provider_user : b.customer_id;
  const labels={ACCEPTED:'تم قبول طلبك',REJECTED:'تم رفض الطلب',CONFIRMED:'تم تثبيت الموعد',IN_PROGRESS:'بدأ تنفيذ الخدمة',COMPLETED:'اكتملت الخدمة',CANCELLED:'تم إلغاء الحجز'};
  await notify(target,'BOOKING_STATUS',labels[to]||'تحديث على الحجز',`${b.service_title} — ${labels[to]||to}`,'booking',b.id);
  return{ok:true,status:to};
});

app.post('/api/reviews', async (req,res) => {
  const u=await need(req,res);if(!u)return;const b=(await db.query('SELECT * FROM live_bookings WHERE id=$1',[req.body?.bookingId])).rows[0];
  if(!b||b.customer_id!==u.id||b.status!=='COMPLETED')return res.code(403).send({error:'REVIEW_REQUIRES_COMPLETED_BOOKING'});
  const rating=asNumber(req.body?.rating);if(!Number.isInteger(rating)||rating<1||rating>5)return res.code(400).send({error:'INVALID_RATING'});
  try{await db.query('INSERT INTO live_reviews(booking_id,customer_id,provider_id,rating,comment) VALUES($1,$2,$3,$4,$5)',[b.id,u.id,b.provider_id,rating,cleanText(req.body?.comment,1200)||null]);
    const a=(await db.query('SELECT avg(rating) rating,count(*)::int count FROM live_reviews WHERE provider_id=$1',[b.provider_id])).rows[0];
    await db.query('UPDATE live_providers SET rating=$1,rating_count=$2 WHERE id=$3',[a.rating,a.count,b.provider_id]);
    const providerUser=(await db.query('SELECT user_id FROM live_providers WHERE id=$1',[b.provider_id])).rows[0]?.user_id;
    await notify(providerUser,'REVIEW_NEW','وصل تقييم جديد',`حصلت على تقييم ${rating}/5`,'booking',b.id);return{ok:true};
  }catch(e){if(e.code==='23505')return res.code(409).send({error:'ALREADY_REVIEWED'});throw e;}
});

app.get('/api/favorites', async (req,res) => {const u=await need(req,res);if(!u)return;return (await db.query(`SELECT s.*,p.title provider_title,p.city,p.verified,p.rating,p.rating_count,pu.name provider_name FROM live_favorites f JOIN live_services s ON s.id=f.service_id JOIN live_providers p ON p.id=s.provider_id JOIN live_users pu ON pu.id=p.user_id WHERE f.user_id=$1 AND s.status='ACTIVE' ORDER BY f.created_at DESC`,[u.id])).rows;});
app.post('/api/favorites/:serviceId', async (req,res) => {const u=await need(req,res);if(!u)return;const exists=(await db.query("SELECT 1 FROM live_services WHERE id=$1 AND status='ACTIVE'",[req.params.serviceId])).rows[0];if(!exists)return res.code(404).send({error:'NOT_FOUND'});await db.query('INSERT INTO live_favorites(user_id,service_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,req.params.serviceId]);return{ok:true};});
app.delete('/api/favorites/:serviceId', async (req,res) => {const u=await need(req,res);if(!u)return;await db.query('DELETE FROM live_favorites WHERE user_id=$1 AND service_id=$2',[u.id,req.params.serviceId]);return{ok:true};});
app.get('/api/favorites/ids', async (req,res) => {const u=await need(req,res);if(!u)return;return (await db.query('SELECT service_id FROM live_favorites WHERE user_id=$1',[u.id])).rows.map(x=>x.service_id);});

app.get('/api/bookings/:id/messages', async (req,res) => {const u=await need(req,res);if(!u)return;const b=await bookingForUser(req.params.id,u);if(!b)return res.code(404).send({error:'NOT_FOUND'});return (await db.query(`SELECT m.*,u.name sender_name FROM live_messages m JOIN live_users u ON u.id=m.sender_id WHERE m.booking_id=$1 ORDER BY m.created_at ASC LIMIT 300`,[b.id])).rows;});
app.post('/api/bookings/:id/messages', async (req,res) => {const u=await need(req,res);if(!u)return;const b=await bookingForUser(req.params.id,u);if(!b)return res.code(404).send({error:'NOT_FOUND'});const body=cleanText(req.body?.body,2000);if(!body)return res.code(400).send({error:'EMPTY_MESSAGE'});const q=await db.query('INSERT INTO live_messages(booking_id,sender_id,body) VALUES($1,$2,$3) RETURNING *',[b.id,u.id,body]);const target=u.id===b.customer_id?b.provider_user:b.customer_id;await notify(target,'MESSAGE_NEW','رسالة جديدة',`رسالة جديدة بخصوص ${b.service_title}`,'booking',b.id);return q.rows[0];});

app.get('/api/notifications', async (req,res) => {const u=await need(req,res);if(!u)return;return (await db.query('SELECT * FROM live_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[u.id])).rows;});
app.patch('/api/notifications/read-all', async (req,res) => {const u=await need(req,res);if(!u)return;await db.query('UPDATE live_notifications SET read_at=COALESCE(read_at,now()) WHERE user_id=$1',[u.id]);return{ok:true};});
app.patch('/api/notifications/:id/read', async (req,res) => {const u=await need(req,res);if(!u)return;await db.query('UPDATE live_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',[req.params.id,u.id]);return{ok:true};});

app.get('/api/disputes', async (req,res) => {const u=await need(req,res);if(!u)return;return (await db.query(`SELECT d.*,s.title service_title,b.customer_id,p.user_id provider_user FROM live_disputes d JOIN live_bookings b ON b.id=d.booking_id JOIN live_services s ON s.id=b.service_id JOIN live_providers p ON p.id=b.provider_id WHERE b.customer_id=$1 OR p.user_id=$1 ORDER BY d.created_at DESC`,[u.id])).rows;});
app.post('/api/bookings/:id/dispute', async (req,res) => {const u=await need(req,res);if(!u)return;const b=await bookingForUser(req.params.id,u);if(!b)return res.code(404).send({error:'NOT_FOUND'});if(!['IN_PROGRESS','COMPLETED'].includes(b.status))return res.code(400).send({error:'DISPUTE_NOT_ALLOWED'});try{const q=await db.query('INSERT INTO live_disputes(booking_id,opened_by,reason,description) VALUES($1,$2,$3,$4) RETURNING *',[b.id,u.id,cleanText(req.body?.reason,180),cleanText(req.body?.description,1500)||null]);return q.rows[0];}catch(e){if(e.code==='23505')return res.code(409).send({error:'DISPUTE_ALREADY_EXISTS'});throw e;}});

app.post('/api/reports', async (req,res) => {const u=await need(req,res);if(!u)return;const b=req.body||{};const type=cleanText(b.targetType,40),reason=cleanText(b.reason,200);if(!type||!reason)return res.code(400).send({error:'INVALID_INPUT'});const q=await db.query('INSERT INTO live_reports(reporter_id,target_type,target_id,reason,description) VALUES($1,$2,$3,$4,$5) RETURNING *',[u.id,type,b.targetId||null,reason,cleanText(b.description,1200)||null]);return q.rows[0];});

app.get('/api/admin/stats', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;const q=await db.query(`SELECT
  (SELECT count(*)::int FROM live_users) users,
  (SELECT count(*)::int FROM live_providers) providers,
  (SELECT count(*)::int FROM live_services WHERE status='ACTIVE') services,
  (SELECT count(*)::int FROM live_bookings) bookings,
  (SELECT count(*)::int FROM live_bookings WHERE status='COMPLETED') completed,
  (SELECT count(*)::int FROM live_disputes WHERE status IN ('OPEN','UNDER_REVIEW')) disputes,
  (SELECT count(*)::int FROM live_reports WHERE status='OPEN') reports,
  (SELECT count(*)::int FROM live_verification_requests WHERE status IN ('PENDING','UNDER_REVIEW')) verifications`);return q.rows[0];});
app.get('/api/admin/users', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;return (await db.query('SELECT id,name,email,role,city,status,created_at FROM live_users ORDER BY created_at DESC LIMIT 200')).rows;});
app.patch('/api/admin/users/:id/status', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;const status=cleanText(req.body?.status,20);if(!['ACTIVE','SUSPENDED','BANNED'].includes(status))return res.code(400).send({error:'INVALID_STATUS'});if(req.params.id===u.id&&status!=='ACTIVE')return res.code(400).send({error:'CANNOT_DISABLE_SELF'});await db.query('UPDATE live_users SET status=$1 WHERE id=$2',[status,req.params.id]);if(status!=='ACTIVE')await db.query('DELETE FROM live_sessions WHERE user_id=$1',[req.params.id]);await adminLog(u.id,'USER_STATUS','user',req.params.id,{status});return{ok:true};});
app.get('/api/admin/verifications', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;return (await db.query(`SELECT v.*,p.title,u.name provider_name,u.email FROM live_verification_requests v JOIN live_providers p ON p.id=v.provider_id JOIN live_users u ON u.id=p.user_id ORDER BY v.submitted_at DESC LIMIT 100`)).rows;});
app.patch('/api/admin/verifications/:id', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;const status=cleanText(req.body?.status,30);if(!['APPROVED','REJECTED','UNDER_REVIEW'].includes(status))return res.code(400).send({error:'INVALID_STATUS'});const q=await db.query('UPDATE live_verification_requests SET status=$1,admin_note=$2,reviewed_at=CASE WHEN $1 IN (\'APPROVED\',\'REJECTED\') THEN now() ELSE reviewed_at END WHERE id=$3 RETURNING *',[status,cleanText(req.body?.note,1000)||null,req.params.id]);if(!q.rows[0])return res.code(404).send({error:'NOT_FOUND'});await db.query('UPDATE live_providers SET verified=$1,verification_status=$2 WHERE id=$3',[status==='APPROVED',status,q.rows[0].provider_id]);await adminLog(u.id,'VERIFICATION_DECISION','verification',q.rows[0].id,{status});const providerUser=(await db.query('SELECT user_id FROM live_providers WHERE id=$1',[q.rows[0].provider_id])).rows[0]?.user_id;await notify(providerUser,'VERIFICATION_STATUS','تحديث طلب التوثيق',status==='APPROVED'?'تم توثيق حسابك بنجاح':status==='REJECTED'?'لم تتم الموافقة على طلب التوثيق':'طلبك قيد المراجعة','provider',q.rows[0].provider_id);return q.rows[0];});
app.get('/api/admin/disputes', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;return (await db.query(`SELECT d.*,s.title service_title,cu.name customer_name,pu.name provider_name FROM live_disputes d JOIN live_bookings b ON b.id=d.booking_id JOIN live_services s ON s.id=b.service_id JOIN live_users cu ON cu.id=b.customer_id JOIN live_providers p ON p.id=b.provider_id JOIN live_users pu ON pu.id=p.user_id ORDER BY d.created_at DESC LIMIT 100`)).rows;});
app.patch('/api/admin/disputes/:id', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;const status=cleanText(req.body?.status,30);if(!['UNDER_REVIEW','RESOLVED','REJECTED'].includes(status))return res.code(400).send({error:'INVALID_STATUS'});const q=await db.query('UPDATE live_disputes SET status=$1,admin_response=$2,resolved_at=CASE WHEN $1 IN (\'RESOLVED\',\'REJECTED\') THEN now() ELSE NULL END WHERE id=$3 RETURNING *',[status,cleanText(req.body?.response,1500)||null,req.params.id]);if(!q.rows[0])return res.code(404).send({error:'NOT_FOUND'});await adminLog(u.id,'DISPUTE_DECISION','dispute',q.rows[0].id,{status});return q.rows[0];});
app.get('/api/admin/reports', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;return (await db.query(`SELECT r.*,u.name reporter_name FROM live_reports r JOIN live_users u ON u.id=r.reporter_id ORDER BY r.created_at DESC LIMIT 100`)).rows;});
app.patch('/api/admin/reports/:id', async (req,res) => {const u=await need(req,res,['admin']);if(!u)return;const status=cleanText(req.body?.status,30);if(!['UNDER_REVIEW','RESOLVED','REJECTED'].includes(status))return res.code(400).send({error:'INVALID_STATUS'});await db.query('UPDATE live_reports SET status=$1 WHERE id=$2',[status,req.params.id]);await adminLog(u.id,'REPORT_STATUS','report',req.params.id,{status});return{ok:true};});

app.setErrorHandler((error,req,res)=>{req.log.error(error);if(error.code==='23P01')return res.code(409).send({error:'SLOT_UNAVAILABLE'});if(error.code==='22P02')return res.code(400).send({error:'INVALID_IDENTIFIER'});return res.code(error.statusCode&&error.statusCode<500?error.statusCode:500).send({error:error.statusCode&&error.statusCode<500?error.message:'INTERNAL_ERROR'});});

const html=await readFile(new URL('./app.html',import.meta.url),'utf8');
app.get('/*',async(_req,res)=>res.type('text/html; charset=utf-8').send(html));

await init();
await app.listen({port:Number(process.env.PORT||3000),host:'0.0.0.0'});
