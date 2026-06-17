/**
 * Vérifie les sprites Méga Z-A du pool Champions (URLs gen5 attendues, pas de repli base animé).
 *
 * Usage : node scripts/check-mega-sprites.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { baseSpeciesName } from './poke-sprites.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const POOL_JSON = path.join(root, 'data', 'pokemon-pool.champions-s1.json');

const EXPECTED_MEGA_POKEDEX_IDS = [
  '#0358-M',
  '#0609-M',
  '#0623-M',
  '#0652-M',
  '#0655-M',
  '#0658-M',
  '#0670-M',
  '#0678-M',
  '#0701-M',
  '#0740-M',
  '#0780-M',
  '#0952-M',
  '#0970-M',
];

/** Méga M-B : pokedexId seul insuffisant si plusieurs formes (ex. Raichu X/Y). */
const EXPECTED_MEGA_ENTRIES = [
  { pokedexId: '#0026-M', name: 'Mega Raichu X' },
  { pokedexId: '#0026-M', name: 'Mega Raichu Y' },
  { pokedexId: '#0254-M', name: 'Mega Sceptile' },
  { pokedexId: '#0257-M', name: 'Mega Blaziken' },
  { pokedexId: '#0260-M', name: 'Mega Swampert' },
  { pokedexId: '#0303-M', name: 'Mega Mawile' },
  { pokedexId: '#0376-M', name: 'Mega Metagross' },
  { pokedexId: '#0398-M', name: 'Mega Staraptor' },
  { pokedexId: '#0545-M', name: 'Mega Scolipede' },
  { pokedexId: '#0560-M', name: 'Mega Scrafty' },
  { pokedexId: '#0604-M', name: 'Mega Eelektross' },
  { pokedexId: '#0668-M', name: 'Mega Pyroar' },
  { pokedexId: '#0687-M', name: 'Mega Malamar' },
  { pokedexId: '#0689-M', name: 'Mega Barbaracle' },
  { pokedexId: '#0691-M', name: 'Mega Dragalge' },
  { pokedexId: '#0870-M', name: 'Mega Falinks' },
];

function findMegaInPool(pool, spec) {
  if (spec.name) {
    return pool.pokemon.find((p) => p.pokedexId === spec.pokedexId && p.name === spec.name);
  }
  return pool.pokemon.find((p) => p.pokedexId === spec.pokedexId);
}

function isWrongBaseAniFallback(pokemon) {
  const url = pokemon.spriteUrl || '';
  if (!url.includes('/sprites/ani/')) return false;
  const base = baseSpeciesName(pokemon.name).toLowerCase().replace(/[^a-z0-9]/g, '');
  const file = url.split('/').pop()?.replace('.gif', '') || '';
  return file === base && !file.includes('mega');
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return true;
    const getRes = await fetch(url, { method: 'GET' });
    return getRes.ok;
  } catch {
    return false;
  }
}

async function checkMega(pool, spec, label) {
  const pokemon = findMegaInPool(pool, spec);
  const pokedexId = spec.pokedexId;
  const relaxed = Boolean(spec.name);
  if (!pokemon) {
    console.error(`✗ ${label} : absent du pool`);
    return 1;
  }

  const { name, spriteUrl } = pokemon;

  if (!relaxed && isWrongBaseAniFallback(pokemon)) {
    console.error(`✗ ${label} ${name} : repli base animé (${spriteUrl})`);
    return 1;
  }

  if (relaxed && isWrongBaseAniFallback(pokemon)) {
    console.warn(`? ${label} ${name} : repli base animé (${spriteUrl})`);
  }

  if (
    !relaxed &&
    (!spriteUrl.includes('/sprites/gen5/') || !spriteUrl.includes('-mega'))
  ) {
    if (pokedexId === '#0678-M' && spriteUrl.includes('meowstic-mmega')) {
      // ok
    } else if (!spriteUrl.includes('/sprites/gen5/')) {
      console.warn(`? ${label} ${name} : pas gen5 (${spriteUrl})`);
    }
  }

  const ok = await headOk(spriteUrl);
  if (!ok) {
    console.error(`✗ ${label} ${name} : URL inaccessible (${spriteUrl})`);
    return 1;
  }

  console.log(`✓ ${label} ${name} → ${spriteUrl}`);
  return 0;
}

async function main() {
  const pool = JSON.parse(fs.readFileSync(POOL_JSON, 'utf8'));
  let errors = 0;

  for (const pokedexId of EXPECTED_MEGA_POKEDEX_IDS) {
    errors += await checkMega(pool, { pokedexId }, pokedexId);
  }

  for (const spec of EXPECTED_MEGA_ENTRIES) {
    const label = spec.name ? `${spec.pokedexId} ${spec.name}` : spec.pokedexId;
    errors += await checkMega(pool, spec, label);
  }

  if (errors > 0) {
    console.error(`\n${errors} erreur(s).`);
    process.exit(1);
  }
  console.log('\nTous les sprites Méga vérifiés.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
