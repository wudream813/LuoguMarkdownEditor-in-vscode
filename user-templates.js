/**
 * 用户自建模板库（与 VSCode 解耦的可测实现）。
 * 存储接口是鸭子类型：{ get(key), update(key, value) } —— 对应 context.globalState。
 * 存储结构：{ [name]: { text, createdAt, updatedAt } }
 */
'use strict';

const TEMPLATES_KEY = 'luogu.userTemplates';

function readAll(store) {
  const raw = store && typeof store.get === 'function' ? store.get(TEMPLATES_KEY) : null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...raw };
}

function listTemplates(store) {
  return Object.entries(readAll(store))
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

/**
 * @returns {Promise<{status:'created'|'overwritten'|'exists'|'invalid', name?:string}>}
 */
async function saveTemplate(store, name, text, { overwrite = false } = {}) {
  const cleanName = String(name || '').trim();
  const body = String(text || '').trim();
  if (!cleanName || cleanName.length > 60) return { status: 'invalid' };
  if (!body) return { status: 'invalid' };
  if (/[/\\]/.test(cleanName)) return { status: 'invalid' };

  const all = readAll(store);
  if (all[cleanName] && !overwrite) return { status: 'exists', name: cleanName };
  const prev = all[cleanName];
  all[cleanName] = {
    text,
    createdAt: prev ? prev.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  await store.update(TEMPLATES_KEY, all);
  return { status: prev ? 'overwritten' : 'created', name: cleanName };
}

async function deleteTemplate(store, name) {
  const all = readAll(store);
  if (!all[name]) return { status: 'missing' };
  delete all[name];
  await store.update(TEMPLATES_KEY, all);
  return { status: 'deleted' };
}

async function renameTemplate(store, oldName, newName) {
  const clean = String(newName || '').trim();
  if (!clean || clean.length > 60 || /[/\\]/.test(clean)) return { status: 'invalid' };
  const all = readAll(store);
  if (!all[oldName]) return { status: 'missing' };
  if (all[clean]) return { status: 'exists' };
  all[clean] = all[oldName];
  delete all[oldName];
  await store.update(TEMPLATES_KEY, all);
  return { status: 'renamed', name: clean };
}

function getTemplate(store, name) {
  return readAll(store)[name] || null;
}

module.exports = {
  TEMPLATES_KEY,
  listTemplates,
  saveTemplate,
  deleteTemplate,
  renameTemplate,
  getTemplate,
};
