/**
 * Tests unitaires légers (Node) pour le profil de Pokémon actifs.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ctx = vm.createContext({ window: {} });
ctx.window = ctx;
ctx.globalThis = ctx;

vm.runInContext(readFileSync(join(root, 'js', 'pool-active.js'), 'utf8'), ctx);

const { PoolActive } = ctx;
const pool = JSON.parse(readFileSync(join(root, 'data', 'pokemon-pool.example.json'), 'utf8'));

function clonePool(source) {
  return JSON.parse(JSON.stringify(source));
}

let errors = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    errors += 1;
  }
}

const base = clonePool(pool);
PoolActive.captureBaseline(base);
const baselineIds = PoolActive.getActiveIds(base);
assert(baselineIds.length > 0, 'baseline contient des actifs');

const customIds = baselineIds.slice(0, Math.max(1, baselineIds.length - 1));
const applied = clonePool(pool);
PoolActive.applyProfile(applied, customIds);
assert(PoolActive.countActive(applied) === customIds.length, 'applyProfile met à jour enabled');
assert(
  applied.pokemon.every((p) => p.enabled === customIds.includes(p.id)),
  'applyProfile cohérent sur toutes les entrées'
);

const togglePool = clonePool(pool);
PoolActive.applyProfile(togglePool, [baselineIds[0]]);
const off = PoolActive.togglePokemon(togglePool, baselineIds[0]);
assert(!off.ok, 'impossible de désactiver le dernier actif');
assert(off.message.includes('Au moins un'), 'message garde min 1 actif');

const togglePool2 = clonePool(pool);
PoolActive.captureBaseline(togglePool2);
const inactive = togglePool2.pokemon.find((p) => !p.enabled);
assert(inactive, 'pool exemple contient un inactif');
const on = PoolActive.togglePokemon(togglePool2, inactive.id);
assert(on.ok && on.enabled === true, 'activation d un inactif');
const off2 = PoolActive.togglePokemon(togglePool2, inactive.id);
assert(off2.ok && off2.enabled === false, 'désactivation redevient possible');

const exportPayload = PoolActive.createExportPayload(applied, { leagueName: 'Test' });
assert(exportPayload.activeCount === customIds.length, 'export activeCount');
assert(Array.isArray(exportPayload.activeIds), 'export activeIds');

const exportText = JSON.stringify(exportPayload);
const parsed = PoolActive.parseImportPayload(exportText);
assert(parsed.ok, 'parse import valide');
const poolCheck = PoolActive.validateImportAgainstPool(parsed.payload, pool);
assert(poolCheck.ok, 'validation IDs contre pool');

const badParse = PoolActive.parseImportPayload('{}');
assert(!badParse.ok, 'parse import invalide rejeté');

const missing = PoolActive.validateImportAgainstPool(
  { activeIds: ['inconnu-xyz'] },
  pool
);
assert(!missing.ok, 'IDs absents rejetés');

const restored = clonePool(pool);
PoolActive.captureBaseline(restored);
PoolActive.applyProfile(restored, customIds);
PoolActive.restoreBaseline(restored);
assert(PoolActive.isBaselineProfile(restored), 'restoreBaseline rétablit Champions');

if (errors === 0) {
  console.log('test-pool-active.mjs : tous les tests OK');
} else {
  console.error(`test-pool-active.mjs : ${errors} échec(s)`);
  process.exit(1);
}
