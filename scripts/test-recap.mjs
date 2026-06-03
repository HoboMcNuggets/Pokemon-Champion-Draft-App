/**
 * Tests unitaires (Node) — récap draft, types, faiblesses.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ctx = vm.createContext({
  window: {},
  document: {
    createElement() {
      return { textContent: '', innerHTML: '' };
    },
  },
});
ctx.window = ctx;
ctx.globalThis = ctx;

function loadScript(relativePath) {
  vm.runInContext(readFileSync(join(root, relativePath), 'utf8'), ctx);
}

loadScript('js/species.js');
loadScript('js/state.js');
loadScript('js/type-display.js');
loadScript('js/type-chart.js');
loadScript('js/draft-recap.js');

const { TypeChart, DraftRecap, DraftState, PokemonSpecies } = ctx;
const pool = JSON.parse(readFileSync(join(root, 'data', 'pokemon-pool.example.json'), 'utf8'));

let errors = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    errors++;
  } else {
    console.log('OK:', msg);
  }
}

assert(TypeChart.getOffensiveMultiplier('Water', 'Fire') === 2, 'Eau → Feu = ×2');
assert(TypeChart.getOffensiveMultiplier('Water', 'Grass') === 0.5, 'Eau → Plante = ×0.5');
assert(TypeChart.getOffensiveMultiplier('Ground', 'Flying') === 0, 'Sol → Vol = ×0');

assert(
  TypeChart.getDefensiveMultiplier('Rock', 'Fire', 'Flying') === 4,
  'Roche vs Feu/Vol = ×4'
);
assert(
  TypeChart.getDefensiveMultiplier('Grass', 'Water', 'Flying') === 1,
  'Plante vs Eau/Vol = ×1 (neutralisé)'
);

const teamWeak = [
  { type1: 'Grass', type2: 'Flying' },
  { type1: 'Ground', type2: 'Rock' },
];
const weakness = TypeChart.computeDominantWeakness(teamWeak);
assert(weakness?.type === 'Ice', 'Faiblesse dominante équipe test = Glace');
assert(weakness?.score === 6, 'Score Glace = 6 (×2 + ×4)');

const typeCounts = DraftRecap.countDraftedTypes(
  {
    teams: [
      [
        { id: '0006' },
        { id: '0003' },
      ],
    ],
  },
  pool
);
assert(typeCounts.Fire === 1, 'Comptage Fire = 1');
assert(typeCounts.Flying === 1, 'Comptage Flying = 1');
assert(typeCounts.Grass === 1, 'Comptage Grass = 1');
assert(typeCounts.Poison === 1, 'Comptage Poison = 1 (double-type)');

assert(DraftRecap.formatDuration(125000) === '2:05', 'Format durée M:SS');
assert(DraftRecap.formatDuration(3725000) === '1:02:05', 'Format durée H:MM:SS');
assert(DraftRecap.formatDuration(null) === '—', 'Durée manquante = —');

let state = DraftState.createInitialState();
state = DraftState.startDraft(state);
const charizard = DraftState.findPokemon(pool, '0006');
state = DraftState.applyBan(state, charizard);
assert(state.draftStartedAt != null, 'draftStartedAt au premier ban');

const start = state.draftStartedAt;
state = { ...state, draftCompletedAt: new Date(Date.parse(start) + 90000).toISOString(), phase: DraftState.PHASE.COMPLETE };
assert(DraftRecap.computeDurationMs(state) === 90000, 'Durée calculée = 90s');

const recap = DraftRecap.computeRecap(state, pool);
assert(recap.durationLabel === '1:30', 'Libellé durée récap');
assert(Array.isArray(recap.playerStats) && recap.playerStats.length === 8, '8 joueurs dans le récap');

if (errors > 0) {
  console.error(`\n${errors} test(s) en échec`);
  process.exit(1);
}

console.log('\nTous les tests récap OK');
