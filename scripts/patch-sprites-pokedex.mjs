/**
 * Met à jour spriteUrl dans pokemon-pokedex.json (ani + repli gen5) sans rappeler PokeAPI.
 *
 * Usage : node scripts/patch-sprites-pokedex.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadShowdownGen5Index,
  loadShowdownSpriteIndex,
  resolveShowdownSpriteFull,
} from './poke-sprites.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const POKEDEX_JSON = path.join(root, 'data', 'pokemon-pokedex.json');

async function main() {
  console.log('Indexation Showdown ani + gen5…');
  const [aniIndex, gen5Index] = await Promise.all([
    loadShowdownSpriteIndex(),
    loadShowdownGen5Index(),
  ]);

  const dex = JSON.parse(fs.readFileSync(POKEDEX_JSON, 'utf8'));
  let updated = 0;
  let gen5Mega = 0;

  for (const entry of dex.pokemon) {
    const sprite = resolveShowdownSpriteFull(
      entry.name,
      !!entry.isMega,
      aniIndex,
      gen5Index
    );
    if (!sprite || sprite.url === entry.spriteUrl) continue;
    entry.spriteUrl = sprite.url;
    updated++;
    if (entry.isMega && sprite.source === 'gen5') gen5Mega++;
  }

  fs.writeFileSync(POKEDEX_JSON, JSON.stringify(dex, null, 2) + '\n', 'utf8');
  console.log(`Pokédex mis à jour : ${updated} spriteUrl modifiés (${gen5Mega} Méga gen5 statiques).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
