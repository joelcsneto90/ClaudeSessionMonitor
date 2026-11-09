import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb, readGroups, writeGroups } from './db.js';
import { FALLBACK_GROUP_ID } from './groups.js';

const DB_MODULE = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'db.js')).href;

function tempDbPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claude-status-')), 'test.db');
}

test('banco novo nasce apenas com o grupo de fallback', () => {
  const db = openDb(tempDbPath());
  const groups = readGroups(db);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, FALLBACK_GROUP_ID);
  assert.equal(groups[0].removable, false);
  db.close();
});

test('grava e le grupos com regras, preservando o fallback por ultimo', () => {
  const db = openDb(tempDbPath());
  writeGroups(db, [
    { id: 'netit', name: 'NetIT', color: '#1b4fd8', rules: [{ id: 'r1', type: 'pathPrefix', value: '/d/repos/NetIT' }] },
  ]);
  const groups = readGroups(db);
  assert.deepEqual(groups.map((g) => g.id), ['netit', FALLBACK_GROUP_ID]);
  assert.deepEqual(groups[0].rules, [{ id: 'r1', type: 'pathPrefix', value: '/d/repos/NetIT' }]);
  db.close();
});

test('o grupo de fallback tambem guarda suas regras', () => {
  const db = openDb(tempDbPath());
  writeGroups(db, [
    { id: 'netit', name: 'NetIT', color: '#1b4fd8', rules: [{ id: 'r1', type: 'pathPrefix', value: '/d/repos/NetIT' }] },
    { id: FALLBACK_GROUP_ID, name: 'Outros', color: '#f48fb1', rules: [{ id: 'r2', type: 'session', value: 'abc-123' }] },
  ]);
  const fallback = readGroups(db).find((g) => g.id === FALLBACK_GROUP_ID);
  assert.deepEqual(fallback.rules, [{ id: 'r2', type: 'session', value: 'abc-123' }]);
  db.close();
});

test('remover um grupo remove as regras dele', () => {
  const db = openDb(tempDbPath());
  writeGroups(db, [
    { id: 'netit', name: 'NetIT', color: '#1b4fd8', rules: [{ id: 'r1', type: 'pathPrefix', value: '/d/repos/NetIT' }] },
  ]);
  writeGroups(db, []);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM rules').get().total, 0);
  db.close();
});

test('escrita invalida reverte e preserva o estado anterior', () => {
  const db = openDb(tempDbPath());
  writeGroups(db, [{ id: 'netit', name: 'NetIT', color: '#1b4fd8', rules: [] }]);
  assert.throws(() => writeGroups(db, [{ id: 'quebrado' }])); // sem name/color
  assert.deepEqual(readGroups(db).map((g) => g.id), ['netit', FALLBACK_GROUP_ID]);
  db.close();
});

test('remover um grupo nao remove o fallback', () => {
  const db = openDb(tempDbPath());
  writeGroups(db, [{ id: 'netit', name: 'NetIT', color: '#1b4fd8', rules: [] }]);
  writeGroups(db, []);
  assert.deepEqual(readGroups(db).map((g) => g.id), [FALLBACK_GROUP_ID]);
  db.close();
});

test('duas escritas concorrentes nao corrompem o arquivo', async () => {
  const file = tempDbPath();
  openDb(file).close(); // cria o schema antes dos filhos

  const writer = (tag) => new Promise((resolve, reject) => {
    const code = `
      import { openDb, writeGroups } from ${JSON.stringify(DB_MODULE)};
      const db = openDb(process.argv[1]);
      for (let i = 0; i < 25; i++) {
        writeGroups(db, [{ id: process.argv[2], name: process.argv[2], color: '#fff',
          rules: [{ id: process.argv[2] + i, type: 'pathPrefix', value: '/x/' + i }] }]);
      }
      db.close();
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', code, file, tag], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (status) => (status === 0 ? resolve() : reject(new Error(`writer ${tag} saiu com ${status}`))));
  });

  await Promise.all([writer('a'), writer('b')]);

  const db = openDb(file);
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const groups = readGroups(db);
  assert.ok(groups.some((g) => g.id === FALLBACK_GROUP_ID), 'fallback sobreviveu');
  assert.equal(groups.length, 2, 'ultimo writer deixou seu grupo + fallback');
  db.close();
});
