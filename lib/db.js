import './quiet.js';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FALLBACK_GROUP_ID } from './groups.js';

// Carregado por require, e nao por import, para que o patch de ./quiet.js ja esteja
// aplicado quando node:sqlite for avaliado e emitir o ExperimentalWarning.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

export const DATA_DIR = path.join(os.homedir(), '.claude-status');
export const DB_PATH = path.join(DATA_DIR, 'claude-status.db');

const FALLBACK_GROUP = {
  id: FALLBACK_GROUP_ID,
  name: 'Outros',
  color: '#f48fb1',
  position: 1000,
};

export function openDb(file = DB_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      color    TEXT NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rules (
      id       TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      type     TEXT NOT NULL,
      value    TEXT NOT NULL
    );
  `);
  ensureFallback(db);
  return db;
}

function ensureFallback(db) {
  db.prepare(
    'INSERT OR IGNORE INTO groups (id, name, color, position) VALUES (?, ?, ?, ?)'
  ).run(FALLBACK_GROUP.id, FALLBACK_GROUP.name, FALLBACK_GROUP.color, FALLBACK_GROUP.position);
}

export function readGroups(db) {
  const groups = db.prepare('SELECT * FROM groups ORDER BY position, name').all();
  const rules = db.prepare('SELECT * FROM rules').all();
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    color: group.color,
    position: group.position,
    removable: group.id !== FALLBACK_GROUP_ID,
    rules: rules
      .filter((rule) => rule.group_id === group.id)
      .map((rule) => ({ id: rule.id, type: rule.type, value: rule.value })),
  }));
}

// Grava a lista inteira: criar, editar, reordenar e remover numa chamada so.
// O grupo de fallback e sempre preservado, venha ele na lista ou nao.
export function writeGroups(db, groups) {
  const insertGroup = db.prepare(
    'INSERT INTO groups (id, name, color, position) VALUES (?, ?, ?, ?)'
  );
  const insertRule = db.prepare(
    'INSERT INTO rules (id, group_id, type, value) VALUES (?, ?, ?, ?)'
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM rules');
    db.exec('DELETE FROM groups');

    groups.forEach((group, index) => {
      if (group.id === FALLBACK_GROUP_ID) return; // reinserido abaixo, sempre por ultimo
      insertGroup.run(group.id, group.name, group.color, index);
      for (const rule of group.rules ?? []) {
        insertRule.run(rule.id, group.id, rule.type, rule.value);
      }
    });

    const fallback = groups.find((group) => group.id === FALLBACK_GROUP_ID);
    insertGroup.run(
      FALLBACK_GROUP.id,
      fallback?.name ?? FALLBACK_GROUP.name,
      fallback?.color ?? FALLBACK_GROUP.color,
      FALLBACK_GROUP.position
    );
    // O fallback tambem carrega regras: fixar uma sessao nele sobrepoe o prefixo de outro grupo.
    for (const rule of fallback?.rules ?? []) {
      insertRule.run(rule.id, FALLBACK_GROUP.id, rule.type, rule.value);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
