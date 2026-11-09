import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { suggestGroups, ungroupedPaths } from './suggest.js';
import { FALLBACK_GROUP_ID } from './groups.js';

const session = (sessionId, cwd) => ({ sessionId, cwd });

test('sugere um grupo por pasta-mae, com a contagem de sessoes', () => {
  const suggestions = suggestGroups([
    session('1', '/d/repos/NetIT/A'),
    session('2', '/d/repos/NetIT/B'),
    session('3', '/d/repos/FCamara/C'),
  ]);

  assert.deepEqual(
    suggestions.map((s) => [s.name, s.sessionCount]),
    [['NetIT', 2], ['FCamara', 1]]
  );
});

test('nao sugere raiz de disco nem a home', () => {
  const home = os.homedir();
  const suggestions = suggestGroups([
    session('1', path.join(home, 'projeto')), // pasta-mae = home
    session('2', '/tmp'),                      // pasta-mae = raiz
  ]);
  assert.deepEqual(suggestions, []);
});

test('nao sugere pasta com nome de UUID', () => {
  const suggestions = suggestGroups([
    session('1', '/c/dados/721917ab-5df1-46fe-b642-54f8c8f797ef/scratch-2026-11-09'),
  ]);
  assert.deepEqual(suggestions, []);
});

test('ungroupedPaths lista todo diretorio sem grupo, inclusive os que a sugestao descarta', () => {
  const temporario = '/c/dados/721917ab-5df1-46fe-b642-54f8c8f797ef/scratch-2026-11-09';
  const sessions = [
    { sessionId: '1', cwd: temporario, groupId: FALLBACK_GROUP_ID, title: 'ID lookup em CM' },
    { sessionId: '2', cwd: '/d/repos/NetIT/A', groupId: 'netit', title: 'nao conta' },
    { sessionId: '3', cwd: '/tmp', groupId: FALLBACK_GROUP_ID, title: 'uma' },
    { sessionId: '4', cwd: '/tmp', groupId: FALLBACK_GROUP_ID, title: 'outra' },
  ];

  // A heuristica de pasta-mae descarta os dois: raiz e pasta com nome de UUID.
  const semGrupo = sessions.filter((s) => s.groupId === FALLBACK_GROUP_ID);
  assert.deepEqual(suggestGroups(semGrupo), []);
  assert.deepEqual(
    ungroupedPaths(sessions).map((e) => [e.name, e.sessionCount, e.titles]),
    [
      ['tmp', 2, ['uma', 'outra']],
      ['scratch-2026-11-09', 1, ['ID lookup em CM']],
    ]
  );
});

test('ignora sessoes ja cobertas por uma regra existente', () => {
  const groups = [
    { id: 'netit', rules: [{ type: 'pathPrefix', value: '/d/repos/NetIT' }] },
    { id: FALLBACK_GROUP_ID, rules: [] },
  ];
  const suggestions = suggestGroups(
    [session('1', '/d/repos/NetIT/A'), session('2', '/d/repos/FCamara/C')],
    groups
  );
  assert.deepEqual(suggestions.map((s) => s.name), ['FCamara']);
});
