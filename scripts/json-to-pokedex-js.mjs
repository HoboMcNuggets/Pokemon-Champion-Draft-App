/**
 * Embarque data/pokemon-pokedex.json dans js/pokemon-pokedex-data.js (compatible file://).
 *
 * Usage : node scripts/json-to-pokedex-js.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const INPUT = path.join(root, 'data', 'pokemon-pokedex.json');
const OUTPUT = path.join(root, 'js', 'pokemon-pokedex-data.js');

const pool = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const body = JSON.stringify(pool);
const out =
  '/**\n' +
  ' * Pokédex embarqué — généré depuis data/pokemon-pokedex.json (file:// sans serveur HTTP).\n' +
  ' * Regénérer : node scripts/json-to-pokedex-js.mjs (ou build-pokedex.mjs)\n' +
  ' */\n' +
  `window.POKEDEX_POOL = ${body};\n`;

fs.writeFileSync(OUTPUT, out, 'utf8');
console.log(`Écrit : ${OUTPUT} (${(out.length / 1024 / 1024).toFixed(2)} Mo)`);
