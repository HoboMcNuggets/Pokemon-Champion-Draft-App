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

async function main() {
  const pool = JSON.parse(fs.readFileSync(POOL_JSON, 'utf8'));
  let errors = 0;

  for (const pokedexId of EXPECTED_MEGA_POKEDEX_IDS) {
    const pokemon = pool.pokemon.find((p) => p.pokedexId === pokedexId);
    if (!pokemon) {
      console.error(`✗ ${pokedexId} : absent du pool`);
      errors++;
      continue;
    }

    const { name, spriteUrl } = pokemon;

    if (isWrongBaseAniFallback(pokemon)) {
      console.error(`✗ ${pokedexId} ${name} : repli base animé (${spriteUrl})`);
      errors++;
      continue;
    }

    if (!spriteUrl.includes('/sprites/gen5/') || !spriteUrl.includes('-mega')) {
      if (pokedexId === '#0678-M' && spriteUrl.includes('meowstic-mmega')) {
        // ok
      } else if (!spriteUrl.includes('/sprites/gen5/')) {
        console.warn(`? ${pokedexId} ${name} : pas gen5 (${spriteUrl})`);
      }
    }

    const ok = await headOk(spriteUrl);
    if (!ok) {
      console.error(`✗ ${pokedexId} ${name} : URL inaccessible (${spriteUrl})`);
      errors++;
      continue;
    }

    console.log(`✓ ${pokedexId} ${name} → ${spriteUrl}`);
  }

  if (errors > 0) {
    console.error(`\n${errors} erreur(s).`);
    process.exit(1);
  }
  console.log('\nTous les sprites Méga Z-A sont valides.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
