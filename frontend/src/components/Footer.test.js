import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
let Footer;
const NOW = Date.parse('2026-11-09T18:00:00Z');

before(async () => {
  vite = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  ({ Footer } = await vite.ssrLoadModule('/src/components/Footer.jsx'));
});

after(async () => {
  await vite?.close();
});

test('cada janela mostra a idade de recebimento do proprio feed, inclusive com uso zero', (t) => {
  t.mock.method(Date, 'now', () => NOW);
  const html = renderToStaticMarkup(createElement(Footer, {
    usage: {
      fiveHour: { used_percentage: 0, receivedAt: NOW - 60_000, resets_at: (NOW + 60_000) / 1000 },
      sevenDay: { used_percentage: 14, receivedAt: NOW - 7_200_000, resets_at: NOW + 86_400_000 },
      ts: NOW,
    },
    account: null,
  }));
  assert.match(html, /feed recebido há 1min/);
  assert.match(html, /feed recebido há 2h00/);
  assert.match(html, />0%</);
  assert.match(html, />14%</);
  assert.doesNotMatch(html, /atualizado há/);
});

test('janela ausente mostra falta de leitura sem esconder a outra', (t) => {
  t.mock.method(Date, 'now', () => NOW);
  const html = renderToStaticMarkup(createElement(Footer, {
    usage: { fiveHour: null, sevenDay: { used_percentage: 14, receivedAt: NOW } },
    account: null,
  }));
  assert.equal(html.match(/sem leitura válida/g).length, 1);
  assert.match(html, />—</);
  assert.match(html, />14%</);
  assert.match(html, /feed recebido há 0s/);
});
