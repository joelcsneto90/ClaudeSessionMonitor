import test from 'node:test';
import assert from 'node:assert/strict';
import { groupIdFor, matchesPrefix, normalizePath, FALLBACK_GROUP_ID } from './groups.js';

const groups = [
  { id: 'netit', rules: [{ type: 'pathPrefix', value: String.raw`D:\repos\NetIT` }] },
  { id: 'pinned', rules: [{ type: 'session', value: 'abc-123' }] },
  { id: FALLBACK_GROUP_ID, rules: [] },
];

test('regra de sessao vence regra de prefixo', () => {
  const session = { sessionId: 'abc-123', cwd: String.raw`D:\repos\NetIT\CRM` };
  assert.equal(groupIdFor(session, groups), 'pinned');
});

test('prefixo casa a propria pasta e as filhas', () => {
  assert.equal(groupIdFor({ sessionId: 'x', cwd: String.raw`D:\repos\NetIT` }, groups), 'netit');
  assert.equal(groupIdFor({ sessionId: 'x', cwd: String.raw`D:\repos\NetIT\CRM\src` }, groups), 'netit');
});

test('prefixo casa so em fronteira de pasta', () => {
  assert.equal(groupIdFor({ sessionId: 'x', cwd: String.raw`D:\repos\NetITOutro` }, groups), FALLBACK_GROUP_ID);
  assert.equal(matchesPrefix('/x/repositorio', '/x/repo'), false);
  assert.equal(matchesPrefix('/x/repo/a', '/x/repo'), true);
});

test('barra invertida, barra normal e maiusculas sao equivalentes', () => {
  assert.equal(groupIdFor({ sessionId: 'x', cwd: 'd:/REPOS/netit/crm' }, groups), 'netit');
  assert.equal(normalizePath(String.raw`D:\repos\NetIT` + '\\'), 'd:/repos/netit');
  assert.equal(matchesPrefix(String.raw`D:\repos\NetIT\CRM`, 'd:/repos/netit'), true);
});

test('sem regra que case, cai no grupo de fallback', () => {
  assert.equal(groupIdFor({ sessionId: 'x', cwd: '/tmp/qualquer' }, groups), FALLBACK_GROUP_ID);
});
