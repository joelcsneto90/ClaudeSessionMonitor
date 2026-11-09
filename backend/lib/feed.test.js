import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { recordStatuslinePayload } from '../statusline-feed.js';
import { readFeed, latestUsage } from './feed.js';

const tempFeedDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-feed-'));

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

test('readFeed indexa por sessionId e ignora diretorio inexistente', () => {
  const dir = tempFeedDir();
  recordStatuslinePayload(payload('abc'), dir);
  recordStatuslinePayload(payload('def'), dir);

  assert.deepEqual([...readFeed(dir).keys()].sort(), ['abc', 'def']);
  assert.equal(readFeed(path.join(os.tmpdir(), 'feed-que-nao-existe')).size, 0);
});

test('latestUsage pega o feed escrito mais recentemente', () => {
  const feed = new Map([
    ['velha', { sessionId: 'velha', fiveHour: { used_percentage: 10 }, sevenDay: null, ts: 100 }],
    ['nova', { sessionId: 'nova', fiveHour: { used_percentage: 80 }, sevenDay: null, ts: 900 }],
  ]);
  assert.equal(latestUsage(feed).fiveHour.used_percentage, 80);
});

test('latestUsage ignora feed sem rate limit e devolve nada quando nao ha', () => {
  const feed = new Map([['so-contexto', { sessionId: 'so-contexto', fiveHour: null, sevenDay: null, ts: 5 }]]);
  assert.ok(!latestUsage(feed));
});
