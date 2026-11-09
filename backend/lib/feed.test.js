import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordStatuslinePayload } from '../statusline-feed.js';
import { readFeed, latestUsage } from './feed.js';

const tempFeedDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-feed-'));
const NOW = Date.parse('2026-11-09T18:00:00Z');
const limit = (pct, resetsAt = NOW + 3_600_000) => ({
  used_percentage: pct,
  resets_at: resetsAt,
});

// O formato que o Claude Code entrega a statusline.
const payload = (sessionId, overrides = {}) => ({
  session_id: sessionId,
  context_window: { used_percentage: 42.7 },
  rate_limits: {
    five_hour: { used_percentage: 38, resets_at: '2026-11-09T22:00:00Z' },
    seven_day: { used_percentage: 14, resets_at: '2026-11-14T00:00:00Z' },
  },
  model: { display_name: 'Opus 5' },
  effort: { level: 'high' },
  cost: { total_cost_usd: 1.23 },
  ...overrides,
});

test('grava o feed com os campos que o painel usa', () => {
  const dir = tempFeedDir();
  assert.equal(recordStatuslinePayload(payload('abc'), dir), true);

  const written = JSON.parse(fs.readFileSync(path.join(dir, 'abc.json'), 'utf8'));
  assert.equal(written.sessionId, 'abc');
  assert.equal(written.ctxPct, 42.7);
  assert.equal(written.fiveHour.used_percentage, 38);
  assert.equal(written.sevenDay.used_percentage, 14);
  assert.equal(written.model, 'Opus 5');
  assert.ok(written.ts > 0);
});

test('payload sem session_id nao grava e nao lanca', () => {
  const dir = tempFeedDir();
  assert.equal(recordStatuslinePayload({}, dir), false);
  assert.equal(recordStatuslinePayload(undefined, dir), false);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('payload de hook nao apaga um feed bom', () => {
  const dir = tempFeedDir();
  recordStatuslinePayload(payload('abc'), dir);
  // A statusline tambem roda como hook: payload sem context_window nem rate_limits.
  assert.equal(recordStatuslinePayload({ session_id: 'abc', hook_event_name: 'Stop' }, dir), false);

  const written = JSON.parse(fs.readFileSync(path.join(dir, 'abc.json'), 'utf8'));
  assert.equal(written.ctxPct, 42.7);
});

test('grava com nulos quando so um dos blocos vem', () => {
  const dir = tempFeedDir();
  recordStatuslinePayload({ session_id: 'so-ctx', context_window: { used_percentage: 5 } }, dir);
  const written = JSON.parse(fs.readFileSync(path.join(dir, 'so-ctx.json'), 'utf8'));
  assert.equal(written.ctxPct, 5);
  assert.equal(written.fiveHour, null);
});

test('atualizar so contexto preserva os limites e a hora em que foram recebidos', (t) => {
  const dir = tempFeedDir();
  let now = NOW;
  t.mock.method(Date, 'now', () => now);
  recordStatuslinePayload(payload('abc'), dir);

  now += 60_000;
  recordStatuslinePayload({ session_id: 'abc', context_window: { used_percentage: 50 } }, dir);

  const written = readFeed(dir).get('abc');
  assert.equal(written.ctxPct, 50);
  assert.equal(written.ts, now);
  assert.equal(written.fiveHour.used_percentage, 38);
  assert.equal(written.sevenDay.used_percentage, 14);
  assert.equal(written.fiveHour.receivedAt, NOW);
  assert.equal(written.sevenDay.receivedAt, NOW);
});

test('payload parcial atualiza so a janela recebida e preserva feeds antigos', (t) => {
  const dir = tempFeedDir();
  fs.writeFileSync(path.join(dir, 'abc.json'), JSON.stringify({
    sessionId: 'abc', fiveHour: limit(10), sevenDay: limit(20), ts: NOW,
  }));
  t.mock.method(Date, 'now', () => NOW + 60_000);
  recordStatuslinePayload({
    session_id: 'abc',
    rate_limits: { five_hour: limit(0) },
  }, dir);

  const written = readFeed(dir).get('abc');
  assert.equal(written.fiveHour.used_percentage, 0);
  assert.equal(written.fiveHour.receivedAt, NOW + 60_000);
  assert.equal(written.sevenDay.used_percentage, 20);
  assert.equal(written.sevenDay.receivedAt, NOW);
});

test('um feed truncado nao impede receber uma nova leitura parcial', () => {
  const dir = tempFeedDir();
  fs.writeFileSync(path.join(dir, 'abc.json'), '{"sessionId":');
  assert.equal(recordStatuslinePayload({
    session_id: 'abc',
    rate_limits: { seven_day: limit(14) },
  }, dir), true);
  const written = readFeed(dir).get('abc');
  assert.equal(written.fiveHour, null);
  assert.equal(written.sevenDay.used_percentage, 14);
});

test('readFeed indexa por sessionId e ignora diretorio inexistente', () => {
  const dir = tempFeedDir();
  recordStatuslinePayload(payload('abc'), dir);
  recordStatuslinePayload(payload('def'), dir);

  assert.deepEqual([...readFeed(dir).keys()].sort(), ['abc', 'def']);
  assert.equal(readFeed(path.join(os.tmpdir(), 'feed-que-nao-existe')).size, 0);
});

test('latestUsage pega o feed escrito mais recentemente', () => {
  const feed = new Map([
    ['velha', { sessionId: 'velha', fiveHour: limit(10), sevenDay: null, ts: 100 }],
    ['nova', { sessionId: 'nova', fiveHour: limit(80), sevenDay: null, ts: 900 }],
  ]);
  assert.equal(latestUsage(feed, NOW).fiveHour.used_percentage, 80);
});

test('latestUsage escolhe cada janela independentemente entre sessoes', () => {
  const feed = new Map([
    ['completa', { fiveHour: limit(10), sevenDay: limit(20), ts: 100 }],
    ['parcial', { fiveHour: limit(80), sevenDay: null, ts: 900 }],
  ]);
  const usage = latestUsage(feed, NOW);
  assert.equal(usage.fiveHour.used_percentage, 80);
  assert.equal(usage.fiveHour.receivedAt, 900);
  assert.equal(usage.sevenDay.used_percentage, 20);
  assert.equal(usage.sevenDay.receivedAt, 100);
  assert.equal(usage.ts, 900);
});

test('latestUsage nao confunde escrita recente de contexto com limites recentes', () => {
  const feed = new Map([
    ['contexto-recente', { fiveHour: { ...limit(10), receivedAt: 100 }, ts: 900 }],
    ['limite-recente', { fiveHour: { ...limit(30), receivedAt: 500 }, ts: 500 }],
  ]);
  const usage = latestUsage(feed, NOW);
  assert.equal(usage.fiveHour.used_percentage, 30);
  assert.equal(usage.fiveHour.receivedAt, 500);
  assert.equal(usage.ts, 500);
});

test('latestUsage remove janelas no reset, aceitando ISO e epoch em segundos ou ms', () => {
  for (const resetsAt of [new Date(NOW).toISOString(), NOW / 1000, NOW]) {
    const feed = new Map([['abc', {
      fiveHour: limit(99, resetsAt),
      sevenDay: limit(14, NOW + 1000),
      ts: NOW - 1000,
    }]]);
    const usage = latestUsage(feed, NOW);
    assert.equal(usage.fiveHour, null);
    assert.equal(usage.sevenDay.used_percentage, 14);
    assert.equal(latestUsage(feed, NOW + 1000), null);
  }
});

test('latestUsage nao apresenta janela sem reset valido como consumo atual', () => {
  const feed = new Map([['abc', {
    fiveHour: { used_percentage: 99 },
    sevenDay: limit(14, 'invalido'),
    ts: NOW,
  }]]);
  assert.equal(latestUsage(feed, NOW), null);
});

test('latestUsage ignora feed sem rate limit e devolve nada quando nao ha', () => {
  const feed = new Map([['so-contexto', { sessionId: 'so-contexto', fiveHour: null, sevenDay: null, ts: 5 }]]);
  assert.ok(!latestUsage(feed));
});
