/**
 * Génère data/pokemon-pool.champions-s1.json depuis le Google Sheet
 * « Liste Pokémon » avec sprites Pokémon Showdown (ani).
 *
 * Usage : node scripts/build-pool.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1Gx2hVgpOaGdmfQmdWoK2RUN-tUmAbNBtcVdJUdbXdLA/gviz/tq?tqx=out:csv&sheet=Liste%20Pok%C3%A9mon';

const SHOWDOWN_SPRITE_BASE = 'https://play.pokemonshowdown.com/sprites/ani/';
const SHOWDOWN_INDEX_URL = SHOWDOWN_SPRITE_BASE;
const OUTPUT_JSON = path.join(root, 'data', 'pokemon-pool.champions-s1.json');
const REPORT_JSON = path.join(root, 'data', 'sprite-import-report.json');
const PLACEHOLDER = 'assets/sprites/placeholder.svg';

const NAME_ALIASES = {
  Manetric: 'manectric',
  'Mega Manetric': 'manectric-mega',
  'Mr. Rime': 'mrrime',
};

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

function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-|-$/g, '');
}

function baseSpeciesName(name) {
  return name.replace(/\s*\([^)]*\)\s*/g, '').replace(/^Mega\s+/i, '').trim();
}

function speciesKeyFromPokedexId(pokedexId) {
  return '#' + String(pokedexId).replace(/-M$/i, '').replace(/^#?/, '').padStart(4, '0');
}

function dexNumber(pokedexId) {
  return String(pokedexId).replace(/-M$/i, '').replace(/^#?/, '').padStart(4, '0');
}

function buildId(pokedexId, name, counters) {
  const num = dexNumber(pokedexId);
  const isMega = String(pokedexId).endsWith('-M');

  if (/mega charizard y/i.test(name)) return `${num}-m-y`;
  if (/mega charizard x/i.test(name)) return `${num}-m-x`;
  if (isMega) return `${num}-m`;

  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const form = paren[1].toLowerCase();
    if (form.includes('alolan')) return `${num}-alola`;
    if (form.includes('galarian')) return `${num}-galar`;
    if (form.includes('hisuian')) return `${num}-hisui`;
    if (form.includes('paldean')) {
      if (form.includes('combat')) return `${num}-p-combat`;
      if (form.includes('blaze')) return `${num}-p-blaze`;
      if (form.includes('aqua')) return `${num}-p-aqua`;
      return `${num}-paldea`;
    }
    if (form.includes('female')) return `${num}-female`;
    if (/\bmale\b/.test(form) || form === 'male') return `${num}-male`;
    if (form.includes('wash')) return `${num}-wash`;
    if (form.includes('heat')) return `${num}-heat`;
    if (form.includes('mow')) return `${num}-mow`;
    if (form.includes('fan')) return `${num}-fan`;
    if (form.includes('frost')) return `${num}-frost`;
    if (form.includes('midnight')) return `${num}-midnight`;
    if (form.includes('midday')) return `${num}-midday`;
    if (form.includes('dusk')) return `${num}-dusk`;
    if (form.includes('small')) return `${num}-small`;
    if (form.includes('medium')) return `${num}-medium`;
    if (form.includes('large')) return `${num}-large`;
    if (form.includes('jumbo')) return `${num}-jumbo`;
    if (form.includes('eternal')) return `${num}-eternal`;
    const slug = slugify(form);
    return `${num}-${slug}`;
  }

  const key = num;
  counters[key] = (counters[key] || 0) + 1;
  if (counters[key] > 1) return `${num}-${counters[key]}`;
  return num;
}

function guessShowdownSpriteIds(name, isMega) {
  const candidates = [];
  const alias = NAME_ALIASES[name];
  if (alias) candidates.push(alias);

  if (/mega charizard y/i.test(name)) candidates.push('charizard-megay');
  else if (/mega charizard x/i.test(name)) candidates.push('charizard-megax');
  else if (isMega) candidates.push(`${slugify(baseSpeciesName(name))}-mega`);

  const paren = name.match(/\(([^)]+)\)/);
  if (paren) {
    const form = paren[1].toLowerCase();
    const base = slugify(baseSpeciesName(name));
    if (form.includes('alolan')) candidates.push(`${base}-alola`);
    else if (form.includes('galarian')) candidates.push(`${base}-galar`);
    else if (form.includes('hisuian')) candidates.push(`${base}-hisui`);
    else if (form.includes('paldean')) {
      if (form.includes('combat')) candidates.push(`${base}-paldeacombat`);
      else if (form.includes('blaze')) candidates.push(`${base}-paldeablaze`);
      else if (form.includes('aqua')) candidates.push(`${base}-paldeaaqua`);
    } else if (form.includes('female')) {
      if (base === 'basculegion') candidates.push('basculegion-f');
      else if (base === 'meowstic') candidates.push('meowstic-f');
      else candidates.push(`${base}-f`, `${base}-female`);
    } else if (/\bmale\b/.test(form) || form === 'male') {
      if (base === 'basculegion') candidates.push('basculegion');
      else if (base === 'meowstic') candidates.push('meowstic');
      else candidates.push(base, `${base}-male`);
    } else if (form.includes('midday')) candidates.push(base);
    else if (form.includes('midnight')) candidates.push(`${base}-midnight`);
    else if (form.includes('dusk')) candidates.push(`${base}-dusk`);
    else if (form.includes('small')) candidates.push(`${base}-small`);
    else if (form.includes('medium')) candidates.push(base, `${base}-medium`);
    else if (form.includes('large')) candidates.push(`${base}-large`);
    else if (form.includes('jumbo')) candidates.push(`${base}-super`);
    else if (form.includes('eternal')) candidates.push(`${base}-eternal`);
    else if (form.includes('wash')) candidates.push(`${base}-wash`);
    else if (form.includes('heat')) candidates.push(`${base}-heat`);
    else if (form.includes('mow')) candidates.push(`${base}-mow`);
    else if (form.includes('fan')) candidates.push(`${base}-fan`);
    else if (form.includes('frost')) candidates.push(`${base}-frost`);
    else candidates.push(`${base}-${slugify(form.replace(/\s*-\s*/g, ' '))}`);
  }

  if (!isMega && !paren) candidates.push(slugify(baseSpeciesName(name)));

  return [...new Set(candidates)];
}

function resolveShowdownSprite(name, isMega, spriteIndex) {
  const candidates = guessShowdownSpriteIds(name, isMega);
  for (const id of candidates) {
    if (spriteIndex.has(id)) {
      return {
        id,
        url: SHOWDOWN_SPRITE_BASE + id + '.gif',
      };
    }
  }
  return null;
}

async function loadShowdownSpriteIndex() {
  const html = await (await fetch(SHOWDOWN_INDEX_URL)).text();
  const ids = new Set();
  for (const m of html.matchAll(/href="\.\/([a-z0-9-]+)\.gif"/gi)) {
    ids.add(m[1].toLowerCase());
  }
  return ids;
}

function validatePool(pool) {
  const ctx = vm.createContext({ window: {} });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'pool-import.js'), 'utf8'), ctx);
  return ctx.PoolImport.validatePoolData(pool);
}

async function main() {
  console.log('Téléchargement du Google Sheet…');
  const csv = await (await fetch(SHEET_URL)).text();
  const rows = parseCsv(csv).slice(1);

  console.log('Indexation des sprites Pokémon Showdown…');
  const spriteIndex = await loadShowdownSpriteIndex();
  console.log(`Sprites indexés : ${spriteIndex.size}`);

  const counters = {};
  const report = { matched: [], missing: [], fallbackBase: [] };
  const pokemon = [];

  for (const row of rows) {
    const [pokedexId, , name, type1, type2, baseTotal, hp, attack, defense, spAtk, spDef, speed] = row;
    const isMega = String(pokedexId).endsWith('-M');
    const id = buildId(pokedexId, name, counters);

    let sprite = resolveShowdownSprite(name, isMega, spriteIndex);

    if (!sprite && isMega) {
      const baseSprite = resolveShowdownSprite(baseSpeciesName(name), false, spriteIndex);
      if (baseSprite) {
        sprite = baseSprite;
        report.fallbackBase.push({ id, name, fallback: baseSprite.id, reason: 'mega' });
      }
    }

    if (!sprite && name.includes('(')) {
      const baseSprite = resolveShowdownSprite(baseSpeciesName(name), false, spriteIndex);
      if (baseSprite) {
        sprite = baseSprite;
        report.fallbackBase.push({ id, name, fallback: baseSprite.id, reason: 'forme' });
      }
    }

    const spriteUrl = sprite ? sprite.url : PLACEHOLDER;
    if (sprite) report.matched.push({ id, name, showdownId: sprite.id, url: sprite.url });
    else report.missing.push({ id, name, reason: 'not_found' });

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
  console.log(`Fallback forme de base : ${report.fallbackBase.length}`);
  if (validation.warnings.length) console.log('Avertissements :', validation.warnings);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
