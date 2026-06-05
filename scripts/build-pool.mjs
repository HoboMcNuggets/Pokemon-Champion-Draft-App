/**
 * Génère data/pokemon-pool.champions-s1.json depuis le Google Sheet
 * « Liste Pokémon » avec sprites Pokémon Showdown (ani + repli gen5).
 *
 * Usage : node scripts/build-pool.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  PLACEHOLDER,
  buildId,
  loadShowdownGen5Index,
  loadShowdownSpriteIndex,
  resolveShowdownSpriteFull,
  speciesKeyFromPokedexId,
} from './poke-sprites.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Gx2hVgpOaGdmfQmdWoK2RUN-tUmAbNBtcVdJUdbXdLA/gviz/tq?tqx=out:csv&sheet=Liste%20Pok%C3%A9mon';

const OUTPUT_JSON = path.join(root, 'data', 'pokemon-pool.champions-s1.json');
const POKEDEX_JSON = path.join(root, 'data', 'pokemon-pokedex.json');
const REPORT_JSON = path.join(root, 'data', 'sprite-import-report.json');

function loadAbilitiesById() {
  const map = new Map();
  if (!fs.existsSync(POKEDEX_JSON)) return map;
  const dex = JSON.parse(fs.readFileSync(POKEDEX_JSON, 'utf8'));
  for (const p of dex.pokemon || []) {
    if (Array.isArray(p.abilities) && p.abilities.length > 0) {
      map.set(p.id, p.abilities.map((a) => ({ name: a.name, isHidden: !!a.isHidden })));
    }
  }
  return map;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((x) => x !== '')) rows.push(row);
  }
  return rows;
}

function validatePool(pool) {
  const ctx = vm.createContext({ window: {} });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'pool-import.js'), 'utf8'), ctx);
  return ctx.PoolImport.validatePoolData(pool);
}

function classifySpriteReport(sprite, isMega) {
  if (!sprite) return null;
  if (sprite.source === 'gen5' && isMega && !sprite.fallback) {
    return 'fallbackGen5Static';
  }
  if (sprite.fallback === 'base') return 'fallbackBase';
  if (sprite.fallback === 'forme') return 'fallbackBase';
  return 'matched';
}

async function main() {
  console.log('Téléchargement du Google Sheet…');
  const csv = await (await fetch(SHEET_URL)).text();
  const rows = parseCsv(csv).slice(1);

  console.log('Indexation des sprites Pokémon Showdown (ani + gen5)…');
  const [spriteIndex, gen5Index] = await Promise.all([
    loadShowdownSpriteIndex(),
    loadShowdownGen5Index(),
  ]);
  console.log(`Sprites ani : ${spriteIndex.size}, gen5 : ${gen5Index.size}`);

  const counters = {};
  const abilitiesById = loadAbilitiesById();
  const report = { matched: [], missing: [], fallbackBase: [], fallbackGen5Static: [] };
  const pokemon = [];

  for (const row of rows) {
    const [pokedexId, , name, type1, type2, baseTotal, hp, attack, defense, spAtk, spDef, speed] = row;
    const isMega = String(pokedexId).endsWith('-M');
    const id = buildId(pokedexId, name, counters);

    const sprite = resolveShowdownSpriteFull(name, isMega, spriteIndex, gen5Index);
    const spriteUrl = sprite ? sprite.url : PLACEHOLDER;

    const bucket = classifySpriteReport(sprite, isMega);
    if (bucket === 'matched') {
      report.matched.push({
        id,
        name,
        showdownId: sprite.id,
        url: sprite.url,
        source: sprite.source,
      });
    } else if (bucket === 'fallbackGen5Static') {
      report.fallbackGen5Static.push({
        id,
        name,
        showdownId: sprite.id,
        url: sprite.url,
        reason: 'mega_no_ani',
      });
    } else if (bucket === 'fallbackBase') {
      report.fallbackBase.push({
        id,
        name,
        fallback: sprite.id,
        url: sprite.url,
        source: sprite.source,
        reason: sprite.fallback,
      });
    } else if (sprite) {
      report.matched.push({
        id,
        name,
        showdownId: sprite.id,
        url: sprite.url,
        source: sprite.source,
      });
    } else {
      report.missing.push({ id, name, reason: 'not_found' });
    }

    const abilities = abilitiesById.get(id);
    if (!abilities) {
      console.warn(`Avertissement : pas d'habiletés Pokédex pour ${id} (${name})`);
    }

    pokemon.push({
      pokedexId: String(pokedexId).startsWith('#') ? pokedexId : `#${pokedexId}`,
      id,
      name,
      type1,
      type2: type2 || '',
      baseTotal: Number(baseTotal),
      hp: Number(hp),
      attack: Number(attack),
      defense: Number(defense),
      spAtk: Number(spAtk),
      spDef: Number(spDef),
      speed: Number(speed),
      spriteUrl,
      enabled: true,
      speciesKey: speciesKeyFromPokedexId(pokedexId),
      isMega,
      abilities: abilities || [{ name: '—', isHidden: false }],
    });
  }

  const pool = {
    version: 1,
    leagueName: 'Pokémon Champions - Saison 1',
    poolLabel: 'Liste Pokémon',
    pokemon,
  };

  const validation = validatePool(pool);
  if (!validation.ok) {
    console.error('Validation échouée :', validation.errors);
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(pool, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`Pool écrit : ${OUTPUT_JSON}`);
  console.log(`Pokémon : ${pokemon.length}`);
  console.log(`Sprites trouvés : ${report.matched.length}`);
  console.log(`Sprites manquants : ${report.missing.length}`);
  console.log(`Fallback gen5 statique (Méga) : ${report.fallbackGen5Static.length}`);
  console.log(`Fallback forme de base : ${report.fallbackBase.length}`);
  if (validation.warnings.length) console.log('Avertissements :', validation.warnings);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
