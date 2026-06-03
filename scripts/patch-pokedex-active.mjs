/**
 * Applique le mapping Champions sur pokemon-pokedex.json existant (sans PokeAPI).
 *
 * Usage : node scripts/patch-pokedex-active.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  applyChampionsOverlay,
  findChampionsMatch,
  getChampionsActiveEntries,
  normalizeKey,
} from './champions-mapping.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const POKEDEX_JSON = path.join(root, 'data', 'pokemon-pokedex.json');
const CHAMPIONS_JSON = path.join(root, 'data', 'pokemon-pool.champions-s1.json');
const EMBED_JS = path.join(root, 'js', 'pokemon-pokedex-data.js');

function validatePool(pool) {
  const ctx = vm.createContext({ window: {} });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'pool-import.js'), 'utf8'), ctx);
  return ctx.PoolImport.validatePoolData(pool);
}

function main() {
  const pool = JSON.parse(fs.readFileSync(POKEDEX_JSON, 'utf8'));
  const champions = JSON.parse(fs.readFileSync(CHAMPIONS_JSON, 'utf8'));
  const activeList = getChampionsActiveEntries(champions);

  const existingIds = new Set(pool.pokemon.map((p) => p.id));

  for (const p of pool.pokemon) {
    p.enabled = false;
  }

  let applied = 0;
  let merged = 0;

  for (const old of activeList) {
    const idx = findChampionsMatch(pool.pokemon, old);
    if (idx >= 0) {
      if (pool.pokemon[idx].id !== old.id) {
        existingIds.delete(pool.pokemon[idx].id);
        existingIds.add(old.id);
      }
      applyChampionsOverlay(pool.pokemon[idx], old);
      applied++;
      continue;
    }

    let mergeId = old.id;
    if (existingIds.has(mergeId)) mergeId = `${old.id}-pool`;
    if (!existingIds.has(mergeId)) {
      pool.pokemon.push({ ...old, id: mergeId, enabled: true });
      existingIds.add(mergeId);
      merged++;
    }
  }

  const validation = validatePool(pool);
  if (!validation.ok) {
    console.error('Validation échouée :', validation.errors);
    process.exit(1);
  }

  fs.writeFileSync(POKEDEX_JSON, JSON.stringify(pool, null, 2) + '\n', 'utf8');
  const embedBody = JSON.stringify(pool);
  fs.writeFileSync(
    EMBED_JS,
    '/** Pokédex embarqué — patch-pokedex-active.mjs */\n' + `window.POKEDEX_POOL = ${embedBody};\n`,
    'utf8'
  );

  const enabled = pool.pokemon.filter((p) => p.enabled);
  console.log(`Actifs appliqués : ${applied}, fusionnés : ${merged}, total actifs : ${enabled.length}`);
  console.log(`Fichiers mis à jour : ${POKEDEX_JSON}, ${EMBED_JS}`);

  const names = enabled.map((p) => p.name).sort((a, b) => a.localeCompare(b, 'fr'));
  const checks = ['Manetric', 'Tauros (Paldean - Combat)', 'Palafin'];
  for (const c of checks) {
    const ok = names.some((n) => normalizeKey(n) === normalizeKey(c));
    console.log(ok ? 'OK' : 'MANQUE', c);
  }
}

main();
