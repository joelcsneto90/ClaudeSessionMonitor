import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readSessions, sortSessions, isAlive } from './sessions.js';

// Um pid que ja existiu e terminou: o mais proximo de "morto" que da para garantir.
const DEAD_PID = spawnSync(process.execPath, ['-e', '0']).pid;

function tempSessionsDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-sessions-'));
  for (const [name, content] of Object.entries(files)) {
    const body = typeof content === 'string' ? content : JSON.stringify(content);
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

const liveSession = (overrides = {}) => ({
  pid: process.pid,
  sessionId: 'viva',
  name: 'sessao viva',
  cwd: '/x/y',
  status: 'busy',
  startedAt: 1,
  statusUpdatedAt: 2,
  ...overrides,
});

test('descarta sessao cujo pid nao esta vivo', () => {
  const dir = tempSessionsDir({
    'viva.json': liveSession(),
    'morta.json': liveSession({ pid: DEAD_PID, sessionId: 'morta' }),
  });
  assert.deepEqual(readSessions(dir).map((s) => s.sessionId), ['viva']);
});

test('pid zero ou negativo nao conta como vivo', () => {
  const dir = tempSessionsDir({
    'zero.json': liveSession({ pid: 0, sessionId: 'zero' }),
    'negativo.json': liveSession({ pid: -1, sessionId: 'negativo' }),
  });
  assert.deepEqual(readSessions(dir), []);
});

test('arquivo pela metade nao derruba a leitura dos demais', () => {
  const dir = tempSessionsDir({
    'parcial.json': '{"pid": 123, "sessionId": "par',
    'viva.json': liveSession(),
  });
  assert.deepEqual(readSessions(dir).map((s) => s.sessionId), ['viva']);
});

test('ignora arquivos que nao sao .json', () => {
  const dir = tempSessionsDir({ 'algo.key': 'nao e json', 'viva.json': liveSession() });
  assert.equal(readSessions(dir).length, 1);
});

test('campos ausentes caem nos defaults', () => {
  const dir = tempSessionsDir({
    'magra.json': { pid: process.pid, sessionId: 'magra', startedAt: 7 },
  });
  const [session] = readSessions(dir);
  assert.equal(session.name, 'magra'); // sem name, usa o sessionId
  assert.equal(session.status, 'idle');
  assert.equal(session.waitingFor, null);
  assert.equal(session.entrypoint, null);
  assert.equal(session.cwd, '');
  assert.equal(session.statusSince, 7); // sem statusUpdatedAt/updatedAt, cai no startedAt
});

test('diretorio inexistente devolve lista vazia', () => {
  assert.deepEqual(readSessions(path.join(os.tmpdir(), 'nao-existe-claude-status')), []);
});

test('o proprio processo conta como vivo', () => {
  assert.equal(isAlive(process.pid), true);
});

test('ordem: ativos, depois os que aguardam input, idle por ultimo', () => {
  const sessions = [
    { sessionId: 'idle-velha', status: 'idle', statusSince: 10 },
    { sessionId: 'waiting-nova', status: 'waiting', statusSince: 90 },
    { sessionId: 'busy', status: 'busy', statusSince: 50 },
    { sessionId: 'idle-nova', status: 'idle', statusSince: 80 },
    { sessionId: 'waiting-velha', status: 'waiting', statusSince: 20 },
    { sessionId: 'shell', status: 'shell', statusSince: 70 },
  ];
  assert.deepEqual(sortSessions(sessions).map((s) => s.sessionId), [
    'shell',         // ativos: mais recente primeiro
    'busy',
    'waiting-velha', // waiting: parado ha mais tempo primeiro
    'waiting-nova',
    'idle-nova',     // idle: mais recente primeiro
    'idle-velha',
  ]);
});

test('status desconhecido vai para o fim, nao para o topo', () => {
  const sessions = [
    { sessionId: 'novo-status', status: 'compacting', statusSince: 99 },
    { sessionId: 'busy', status: 'busy', statusSince: 1 },
    { sessionId: 'waiting', status: 'waiting', statusSince: 1 },
  ];
  assert.deepEqual(sortSessions(sessions).map((s) => s.sessionId), [
    'busy',
    'waiting',
    'novo-status',
  ]);
});

test('sortSessions nao altera o array recebido', () => {
  const sessions = [
    { sessionId: 'a', status: 'idle', statusSince: 1 },
    { sessionId: 'b', status: 'busy', statusSince: 2 },
  ];
  sortSessions(sessions);
  assert.deepEqual(sessions.map((s) => s.sessionId), ['a', 'b']);
});
