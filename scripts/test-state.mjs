/**

 * Tests unitaires légers (Node) pour la logique draft.

 */

import { readFileSync, existsSync } from 'fs';

import { fileURLToPath } from 'url';

import { dirname, join } from 'path';

import vm from 'vm';



const __dirname = dirname(fileURLToPath(import.meta.url));

const root = join(__dirname, '..');



const ctx = vm.createContext({ window: {} });

ctx.window = ctx;

ctx.globalThis = ctx;

vm.runInContext(readFileSync(join(root, 'js', 'species.js'), 'utf8'), ctx);

vm.runInContext(readFileSync(join(root, 'js', 'state.js'), 'utf8'), ctx);



const { DraftState, PokemonSpecies } = ctx;

const PHASE = DraftState.PHASE;

const pool = JSON.parse(readFileSync(join(root, 'data', 'pokemon-pool.example.json'), 'utf8'));
const pokedexPath = join(root, 'data', 'pokemon-pokedex.json');
const poolLargePath = join(root, 'data', 'pokemon-pool.champions-s1.json');
const poolLargeFile = existsSync(pokedexPath) ? pokedexPath : poolLargePath;
const poolLarge = JSON.parse(readFileSync(poolLargeFile, 'utf8'));



let errors = 0;

function assert(cond, msg) {

  if (!cond) {

    console.error('FAIL:', msg);

    errors++;

  } else {

    console.log('OK:', msg);

  }

}



assert(DraftState.PICKS_PER_PLAYER === 8, '8 picks par joueur');

assert(DraftState.TOTAL_PICKS === 64, '64 picks total');

assert(DraftState.TOTAL_BANS === 16, '16 bans total');



assert(DraftState.getSnakePlayerIndex(0) === 0, 'snake pick 0 → joueur 0');

assert(DraftState.getSnakePlayerIndex(8) === 7, 'snake pick 8 → joueur 7');

assert(DraftState.getSnakePlayerIndex(9) === 6, 'snake pick 9 → joueur 6');

assert(DraftState.getBanPlayerIndex(0) === 0, 'ban 0 → joueur 0');
assert(DraftState.getBanPlayerIndex(7) === 7, 'ban 7 → joueur 7');
assert(DraftState.getBanPlayerIndex(8) === 0, 'ban 8 (tour 2) → joueur 0');
assert(DraftState.getBanPlayerIndex(15) === 7, 'ban 15 (tour 2) → joueur 7');
assert(DraftState.getBanRound(0) === 1, 'ban 0 tour 1');
assert(DraftState.getBanRound(8) === 2, 'ban 8 tour 2');



let state = DraftState.createInitialState();

state.players = state.players.map((p, i) => ({ ...p, name: `P${i + 1}` }));

state = DraftState.startDraft(state);

assert(state.phase === PHASE.BAN, 'startDraft → phase bans');

assert(state.totalBansDone === 0, 'totalBansDone initial');



const mega = pool.pokemon.find((p) => p.id === '0003-m');

assert(DraftState.canBan(mega, state), 'canBan actif en phase ban');

state = DraftState.applyBan(state, mega);

assert(state.bans.length === 1, '1 ban enregistré');

assert(state.bans[0].playerIndex === 0, 'ban attribué au joueur 0');

assert(state.totalBansDone === 1, 'totalBansDone incrémenté');



const venusaur = pool.pokemon.find((p) => p.id === '0003');

assert(!PokemonSpecies.isSelectable(venusaur, state.usedSpecies), 'ban bloque la famille');



state = DraftState.undo(state);

assert(state.totalBansDone === 0, 'undo ban décrémente totalBansDone');

assert(state.phase === PHASE.BAN, 'undo ban reste en phase ban');



let pickState = DraftState.startDraft(DraftState.createInitialState());
pickState = { ...pickState, phase: PHASE.DRAFT, totalBansDone: DraftState.TOTAL_BANS };
const pickMon = pool.pokemon.find((p) => p.id === '0006');
const activePick = DraftState.getActivePlayerIndex(pickState);
assert(activePick === 0, 'premier pick → joueur 0');
assert(DraftState.canAssignPick(pickMon, pickState, activePick), 'canAssignPick joueur actif');
assert(!DraftState.canAssignPick(pickMon, pickState, 1), 'canAssignPick refuse autre joueur');
pickState = DraftState.assignPick(pickState, activePick, pickMon);
assert(pickState.teams[0].length === 1, 'pick assigné au joueur 0');
const megaX = pool.pokemon.find((p) => p.id === '0006-m-x');
assert(!PokemonSpecies.isSelectable(megaX, pickState.usedSpecies), 'pick charizard bloque méga X');

state = DraftState.startDraft(state);
for (let i = 0; i < DraftState.TOTAL_BANS; i++) {
  const active = DraftState.getActivePlayerIndex(state);
  const candidate = poolLarge.pokemon.find(
    (p) => p.enabled && PokemonSpecies.isSelectable(p, state.usedSpecies)
  );
  assert(candidate, `candidat ban ${i}`);
  assert(active === DraftState.getBanPlayerIndex(state.totalBansDone), `joueur actif ban ${i}`);
  state = DraftState.applyBan(state, candidate);
}
assert(state.phase === PHASE.DRAFT, '16 bans → phase draft');
assert(state.totalBansDone === 16, 'totalBansDone = 16');



for (let i = state.totalPicksDone; i < DraftState.TOTAL_PICKS; i++) {
  const active = DraftState.getActivePlayerIndex(state);
  const candidate = poolLarge.pokemon.find(
    (p) => p.enabled && PokemonSpecies.isSelectable(p, state.usedSpecies)
  );
  assert(candidate, `candidat pick ${i}`);
  state = DraftState.assignPick(state, active, candidate);
}

assert(state.phase === PHASE.COMPLETE, '64 picks → terminé');

assert(state.teams.every((t) => t.length === 8), '8 picks par joueur');



let pickTest = DraftState.startDraft(DraftState.createInitialState());
for (let i = 0; i < DraftState.TOTAL_BANS; i++) {
  const c = poolLarge.pokemon.find(
    (p) => p.enabled && PokemonSpecies.isSelectable(p, pickTest.usedSpecies)
  );
  pickTest = DraftState.applyBan(pickTest, c);
}
const active0 = DraftState.getActivePlayerIndex(pickTest);
for (let s = 0; s < DraftState.PICKS_PER_PLAYER; s++) {
  const c = poolLarge.pokemon.find(
    (p) => p.enabled && PokemonSpecies.isSelectable(p, pickTest.usedSpecies)
  );
  pickTest = DraftState.assignPick(pickTest, active0, c);
}
const extra = poolLarge.pokemon.find(
  (p) => p.enabled && PokemonSpecies.isSelectable(p, pickTest.usedSpecies)
);
if (extra) {
  assert(
    !DraftState.canAssignPick(extra, pickTest, active0),
    'refus 9e pick sur joueur plein'
  );
}



state = DraftState.undo(state);

assert(state.phase === PHASE.DRAFT, 'undo pick depuis complete → draft');



const migrated = DraftState.deserialize({ phase: 'banPhase', bans: [], usedSpecies: [], totalBansDone: 0 });

assert(migrated.phase === PHASE.SETUP, 'migration banPhase vide → setup');



let exportState = DraftState.startDraft(DraftState.createInitialState());

exportState = DraftState.setPlayerNames(exportState, [

  { slot: 0, name: 'Alice' },

  { slot: 1, name: 'Bob' },

  { slot: 2, name: 'Carol' },

  { slot: 3, name: 'Dave' },

  { slot: 4, name: 'Eve' },

  { slot: 5, name: 'Frank' },

  { slot: 6, name: 'Grace' },

  { slot: 7, name: 'Heidi' },

]);

const banCandidate = pool.pokemon.find(

  (p) => p.enabled && PokemonSpecies.isSelectable(p, exportState.usedSpecies)

);

exportState = DraftState.applyBan(exportState, banCandidate);



const payload = DraftState.createExportPayload(exportState, {

  leagueName: pool.leagueName,

  poolVersion: pool.version,

});

assert(payload.formatVersion === DraftState.EXPORT_FORMAT_VERSION, 'formatVersion export');

assert(payload.state && payload.state.phase === PHASE.BAN, 'export contient state banPhase');

assert(Array.isArray(payload.state.players) && payload.state.players.length === 8, 'export contient 8 joueurs');



const exportJson = JSON.stringify(payload);

const parsed = DraftState.parseImportPayload(exportJson);

assert(parsed.ok, 'parseImportPayload export valide');

assert(parsed.rawState.players[0].name === 'Alice', 'import conserve noms joueurs');



const restored = DraftState.importDraftState(parsed.rawState, pool);

assert(restored.phase === PHASE.BAN, 'import restore phase');

assert(restored.totalBansDone === 1, 'import restore totalBansDone');

assert(restored.players[0].name === 'Alice', 'import restore nom joueur');

assert(

  restored.usedSpecies.includes(banCandidate.speciesKey),

  'import recalcule usedSpecies'

);



const poolCheck = DraftState.validateStateAgainstPool(restored, pool);

assert(poolCheck.ok, 'import compatible pool exemple');



const badPayload = DraftState.parseImportPayload('{"foo":1}');

assert(!badPayload.ok, 'parseImportPayload rejette JSON invalide');



vm.runInContext(readFileSync(join(root, 'js', 'pool-import.js'), 'utf8'), ctx);

const v = ctx.PoolImport.validatePoolData(pool);

assert(v.ok, 'validation pool exemple');

try {
  const pokedex = JSON.parse(readFileSync(pokedexPath, 'utf8'));
  const vp = ctx.PoolImport.validatePoolData(pokedex);
  assert(vp.ok, 'validation pokemon-pokedex.json');
  const enabledCount = pokedex.pokemon.filter((p) => p.enabled).length;
  assert(enabledCount >= 200, `pokedex actifs >= 200 (${enabledCount})`);
} catch {
  console.log('SKIP: pokemon-pokedex.json absent (exécuter build-pokedex.mjs)');
}



if (errors === 0) {

  console.log('\nTous les tests passés.');

  process.exit(0);

}

process.exit(1);

