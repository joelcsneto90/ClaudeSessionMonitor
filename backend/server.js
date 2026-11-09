import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, readGroups, writeGroups } from './lib/db.js';
import { readSessions, sortSessions } from './lib/sessions.js';
import { groupIdFor } from './lib/groups.js';
import { suggestGroups, ungroupedPaths } from './lib/suggest.js';
import { readFeed, latestUsage } from './lib/feed.js';
import { readTranscriptInfo, displayTitle, contextPercent } from './lib/transcript.js';
import { modelWindows } from './lib/models.js';
import { readAccount } from './lib/account.js';
import { focusEditor } from './lib/focus.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 7788;
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const FOCUS_ROUTE = /^\/api\/sessions\/([^/]+)\/focus$/;

const db = openDb();

function buildState() {
  const groups = readGroups(db);
  const feed = readFeed();
  const windows = modelWindows();

  const sessions = sortSessions(readSessions()).map((session) => {
    const info = readTranscriptInfo(session.sessionId);
    return {
      ...session,
      title: displayTitle(session, info),
      groupId: groupIdFor(session, groups),
      // O feed da statusline e exato; o transcript e o calculo que funciona em
      // qualquer sessao, inclusive as que nunca renderizam uma statusline.
      ctxPct: feed.get(session.sessionId)?.ctxPct ?? contextPercent(info, windows),
      ctxTokens: info?.tokens ?? null,
      model: info?.model ?? null,
    };
  });

  return {
    groups,
    sessions,
    suggestions: suggestGroups(sessions, groups),
    ungrouped: ungroupedPaths(sessions),
    usage: latestUsage(feed),
    account: readAccount(),
  };
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8'); // sem isto, um caractere multibyte partido entre chunks corrompe
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('corpo nao e JSON valido'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const requested = path.join(DIST, decodeURIComponent(pathname));
  const inside = !path.relative(DIST, requested).startsWith('..');
  const file =
    inside && fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested
      : path.join(DIST, 'index.html');

  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ClaudeStatus: API no ar. A UI ainda nao foi buildada (npm run build em frontend/).\n');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    // Sem isto um throw no handler async vira unhandledRejection e derruba o processo.
    sendJson(res, 500, { error: error.message });
  }
});

async function handle(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/api/sessions') {
    return sendJson(res, 200, sortSessions(readSessions()));
  }
  if (req.method === 'GET' && pathname === '/api/state') {
    return sendJson(res, 200, buildState());
  }
  if (req.method === 'PUT' && pathname === '/api/groups') {
    try {
      const groups = await readBody(req);
      if (!Array.isArray(groups)) return sendJson(res, 400, { error: 'esperado um array de grupos' });
      writeGroups(db, groups);
      return sendJson(res, 200, buildState());
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const focusMatch = req.method === 'POST' && FOCUS_ROUTE.exec(pathname);
  if (focusMatch) {
    // So age sobre sessao viva: o diretorio sai do arquivo da sessao, nunca do cliente.
    const sessionId = decodeURIComponent(focusMatch[1]);
    const session = readSessions().find((candidate) => candidate.sessionId === sessionId);
    if (!session) return sendJson(res, 404, { reason: 'sessão não está mais viva' });
    const result = focusEditor(session);
    return sendJson(res, result.ok ? 200 : 409, result);
  }

  if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'rota nao encontrada' });

  return serveStatic(req, res);
}

server.listen(PORT, HOST, () => {
  console.log(`ClaudeStatus em http://${HOST}:${PORT}`);
});
