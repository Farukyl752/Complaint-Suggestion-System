import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, extname, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {departments, statuses, validReport, prioritize} from './basvuru-kurallari.js';

const publicDir = fileURLToPath(new URL('./arayuz', import.meta.url));
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.txt':'text/plain'};
const digest = value => createHash('sha256').update(value).digest();

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 24000) throw Error('input');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

export function application({database, password, key, model = 'gpt-4o-mini'}) {
  if (database !== ':memory:') mkdirSync(dirname(database), {recursive:true});
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS reports (
      code TEXT PRIMARY KEY, kind TEXT, category TEXT, department TEXT, description TEXT,
      lat REAL, lng REAL, score INTEGER, reason TEXT, source TEXT, status TEXT, created TEXT);
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY, code TEXT REFERENCES reports(code), status TEXT, at TEXT);`);
  const server = http.createServer(async (req, res) => {
    function json(status, value) {
      res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(JSON.stringify(value));
    }
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path.startsWith('/api/staff') && !timingSafeEqual(digest(req.headers.authorization || ''), digest('Bearer ' + password))) {
        return json(401, {error:'Personel parolası geçersiz.'});
      }
      if (path === '/api/config' && req.method === 'GET') return json(200, {departments, statuses});
      if (path === '/api/reports' && req.method === 'POST') {
        const r = await body(req);
        if (!validReport(r)) return json(400, {error:'Tür, kategori, açıklama ve konum alanlarını kontrol edin.'});
        const p = await prioritize(r, key, model);
        const code = 'KB-' + randomBytes(10).toString('hex').toUpperCase();
        const now = new Date().toISOString();
        db.exec('BEGIN');
        try {
          db.prepare('INSERT INTO reports VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(code, r.kind, r.category,
            departments[r.category], r.description.trim(), r.lat, r.lng, p.score, p.reason, p.source, statuses[0], now);
          db.prepare('INSERT INTO events(code,status,at) VALUES (?,?,?)').run(code, statuses[0], now);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return json(201, {code, department:departments[r.category]});
      }
      if (path.startsWith('/api/track/') && req.method === 'GET') {
        const code = path.slice('/api/track/'.length).toUpperCase();
        const r = db.prepare('SELECT code,kind,category,department,status,created FROM reports WHERE code=?').get(code);
        if (!r) return json(404, {error:'Bu numarayla eşleşen başvuru bulunamadı.'});
        r.events = db.prepare('SELECT status,at FROM events WHERE code=? ORDER BY id').all(code);
        return json(200, r);
      }
      if (path === '/api/staff' && req.method === 'GET') {
        return json(200, db.prepare('SELECT * FROM reports ORDER BY score DESC, created').all());
      }
      if (path.startsWith('/api/staff/') && req.method === 'PATCH') {
        const {status, previous} = await body(req);
        if (!statuses.includes(previous) || statuses.indexOf(status) !== statuses.indexOf(previous) + 1) {
          return json(400, {error:'Sıradaki durumu seçin.'});
        }
        const code = path.slice('/api/staff/'.length);
        db.exec('BEGIN');
        try {
          const change = db.prepare('UPDATE reports SET status=? WHERE code=? AND status=?').run(status, code, previous);
          if (!change.changes) {
            db.exec('ROLLBACK');
            return json(409, {error:'Kayıt değişti. Listeyi yenileyin.'});
          }
          db.prepare('INSERT INTO events(code,status,at) VALUES (?,?,?)').run(code,status,new Date().toISOString());
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return json(200, {status});
      }
      if (req.method === 'GET') {
        const file = resolve(publicDir, '.' + (path === '/' ? '/ana-sayfa.html' : path));
        if (file.startsWith(resolve(publicDir) + sep) && mime[extname(file)]) {
          try {
            const bytes = readFileSync(file);
            res.writeHead(200, {'Content-Type':mime[extname(file)], 'Referrer-Policy':'strict-origin-when-cross-origin'});
            return res.end(bytes);
          } catch { /* Unknown asset */ }
        }
      }
      json(404,{error:'Bulunamadı.'});
    } catch (error) {
      const invalid = error instanceof SyntaxError || error.message === 'input' || error instanceof TypeError;
      json(invalid ? 400 : 500, {error: invalid ? 'Geçersiz istek.' : 'İşlem tamamlanamadı.'});
    }
  });
  server.on('close', () => db.close());
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const password = process.env.ADMIN_PASSWORD || randomBytes(16).toString('hex');
  if (!process.env.ADMIN_PASSWORD) console.log('Geçici personel parolası:', password);
  const port = Number(process.env.PORT || 3000);
  application({database:'data/kent.db', password, key:process.env.OPENAI_API_KEY, model:process.env.OPENAI_MODEL || undefined})
    .listen(port,'127.0.0.1',() => console.log('KentBildir: http://127.0.0.1:' + port));
}
