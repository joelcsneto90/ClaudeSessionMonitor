import test from 'node:test';
import assert from 'node:assert/strict';
import { ago, readableOn, untilReset } from './format.js';

test('readableOn escolhe o texto por luminancia da cor do grupo', () => {
  assert.equal(readableOn('#14161b'), '#ffffff'); // Lux, escuro
  assert.equal(readableOn('#1b4fd8'), '#ffffff'); // NetIT, azul
  assert.equal(readableOn('#c9b68d'), '#16181d'); // Joel, bege
  assert.equal(readableOn('#f48fb1'), '#16181d'); // Outros, rosa claro
});

test('readableOn entende hex de 3 digitos', () => {
  assert.equal(readableOn('#06c'), readableOn('#0066cc'));
  assert.equal(readableOn('#ffe'), '#16181d');
});

test('readableOn nao devolve texto claro para cor que nao e hex', () => {
  // A cor vem do banco como texto livre: nome CSS ou lixo nao podem virar branco sobre claro.
  for (const color of ['yellow', 'orange', 'rgb(255,0,0)', '', 'nao-e-cor', '#12345']) {
    assert.equal(readableOn(color), '#16181d', `falhou para ${color}`);
  }
});

test('ago formata nas fronteiras', () => {
  const now = Date.now();
  assert.equal(ago(null), '—');
  assert.equal(ago(now - 59_000), '59s');
  assert.equal(ago(now - 60_000), '1min');
  assert.equal(ago(now - 59 * 60_000), '59min');
  assert.equal(ago(now - 60 * 60_000), '1h00');
  assert.equal(ago(now - 24 * 60 * 60_000), '1d');
});

test('ago nao devolve tempo negativo para carimbo no futuro', () => {
  assert.equal(ago(Date.now() + 60_000), '0s');
});

test('untilReset aceita ISO, epoch em segundos e em milissegundos', () => {
  const inOneHour = Date.now() + 3600_000;
  assert.equal(untilReset(new Date(inOneHour).toISOString()), '1h00');
  assert.equal(untilReset(Math.round(inOneHour / 1000)), '1h00');
  assert.equal(untilReset(inOneHour), '1h00');
});

test('untilReset lida com ausente, invalido e vencido', () => {
  assert.equal(untilReset(null), null);
  assert.equal(untilReset('nao e data'), null);
  assert.equal(untilReset(Date.now() - 1000), 'agora');
});
