import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readTranscriptInfo, displayTitle, contextPercent } from './transcript.js';

function tempProjects(sessionId, lines) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-tr-'));
  const dir = path.join(root, 'D--projeto');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, `${sessionId}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n'));
  return root;
}

const assistant = (tokens, model = 'claude-opus-5-5') => ({
  type: 'assistant',
  message: {
    model,
    usage: {
      input_tokens: 2,
      cache_creation_input_tokens: tokens - 2 - 1000,
      cache_read_input_tokens: 1000,
      output_tokens: 500, // nao entra na conta: output nao ocupa contexto de entrada
    },
  },
});

test('tira o ai-title e os tokens do fim do transcript', () => {
  const root = tempProjects('s1', [
    { type: 'ai-title', aiTitle: 'Titulo velho' },
    assistant(100_000),
    { type: 'ai-title', aiTitle: 'Roadmap de lux-vestiaire-orders' },
  ]);

  const info = readTranscriptInfo('s1', root);
  assert.equal(info.aiTitle, 'Roadmap de lux-vestiaire-orders');
  assert.equal(info.tokens, 100_000);
  assert.equal(info.model, 'claude-opus-5-5');
});

test('pega o assistant mais recente, nao o primeiro', () => {
  const root = tempProjects('s2', [assistant(50_000), assistant(220_000)]);
  assert.equal(readTranscriptInfo('s2', root).tokens, 220_000);
});

test('sessao sem transcript devolve nada', () => {
  const root = tempProjects('s3', [assistant(10_000)]);
  assert.equal(readTranscriptInfo('nao-existe', root), null);
});

test('displayTitle so troca o nome quando ele e derivado da pasta', () => {
  const info = { aiTitle: 'Titulo do Claude' };
  assert.equal(displayTitle({ name: 'netitcrm-b9', nameSource: 'derived' }, info), 'Titulo do Claude');
  assert.equal(displayTitle({ name: 'Nome que eu dei', nameSource: 'user' }, info), 'Nome que eu dei');
  assert.equal(displayTitle({ name: 'netitcrm-b9', nameSource: 'derived' }, null), 'netitcrm-b9');
});

test('contextPercent usa a janela do modelo', () => {
  const windows = new Map([
    ['claude-opus-5-5', 1_000_000],
    ['claude-haiku-4-5-20251001', 200_000],
  ]);
  assert.equal(contextPercent({ tokens: 384_600, model: 'claude-opus-5-5' }, windows), 38.46);
  assert.equal(contextPercent({ tokens: 100_000, model: 'claude-haiku-4-5-20251001' }, windows), 50);
});

test('contextPercent devolve nada sem modelo conhecido e nunca passa de 100', () => {
  const windows = new Map([['claude-opus-5-5', 1_000_000]]);
  assert.equal(contextPercent({ tokens: 10, model: 'modelo-desconhecido' }, windows), null);
  assert.equal(contextPercent(null, windows), null);
  assert.equal(contextPercent({ tokens: 2_000_000, model: 'claude-opus-5-5' }, windows), 100);
});
