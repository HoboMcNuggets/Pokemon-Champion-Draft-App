/**
 * Génère data/pokemon-pokedex.json depuis PokeAPI + fusion pool Champions (enabled).
 *
 * Usage : node scripts/build-pokedex.mjs
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

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const OLD_POOL_JSON = path.join(root, 'data', 'pokemon-pool.champions-s1.json');
const OUTPUT_JSON = path.join(root, 'data', 'pokemon-pokedex.json');
const REQUEST_DELAY_MS = 120;

const TYPE_LABELS = {
  normal: 'Normal',
  fire: 'Fire',
  water: 'Water',
  electric: 'Electric',
  grass: 'Grass',
  ice: 'Ice',
  fighting: 'Fighting',
  poison: 'Poison',
  ground: 'Ground',
  flying: 'Flying',
  psychic: 'Psychic',
  bug: 'Bug',
  rock: 'Rock',
  ghost: 'Ghost',
  dragon: 'Dragon',
  dark: 'Dark',
  steel: 'Steel',
  fairy: 'Fairy',
};

const STAT_KEYS = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  'special-attack': 'spAtk',
  'special-defense': 'spDef',
  speed: 'speed',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function titleCaseWords(s) {
  return s
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getNationalDex(species) {
  const nat = species.pokedex_numbers?.find((p) => p.pokedex.name === 'national');
  return nat ? nat.entry_number : null;
}

function isMegaSlug(slug) {
  return /-mega/i.test(slug) || slug.endsWith('-mega');
}

function displayNameFromApi(slug, species) {
  const en = species.names?.find((n) => n.language.name === 'en');
  const baseEn = en?.name || titleCaseWords(slug.split('-')[0]);

  if (/-mega-x$/i.test(slug)) return `Mega ${baseEn} X`;
  if (/-mega-y$/i.test(slug)) return `Mega ${baseEn} Y`;
  if (/-mega$/i.test(slug) || slug.includes('-mega-')) {
    const base = slug.replace(/-mega.*$/i, '').replace(/-/g, ' ');
    return `Mega ${titleCaseWords(base)}`;
  }
  if (slug.includes('-alola')) return `${baseEn} (Alolan)`;
  if (slug.includes('-galar')) return `${baseEn} (Galarian)`;
  if (slug.includes('-hisui')) return `${baseEn} (Hisuian)`;
  if (slug.includes('-paldea')) {
    if (slug.includes('combat')) return `${baseEn} (Paldean - Combat)`;
    if (slug.includes('blaze')) return `${baseEn} (Paldean - Blaze)`;
    if (slug.includes('aqua')) return `${baseEn} (Paldean - Aqua)`;
    return `${baseEn} (Paldean)`;
  }
  if (slug.endsWith('-female')) return `${baseEn} (Female)`;
  if (slug.endsWith('-male')) return `${baseEn} (Male)`;
  if (slug.includes('-wash')) return `${baseEn} (Wash)`;
  if (slug.includes('-heat')) return `${baseEn} (Heat)`;
  if (slug.includes('-mow')) return `${baseEn} (Mow)`;
  if (slug.includes('-fan')) return `${baseEn} (Fan)`;
  if (slug.includes('-frost')) return `${baseEn} (Frost)`;
  if (slug.includes('-midnight')) return `${baseEn} (Midnight)`;
  if (slug.includes('-midday')) return `${baseEn} (Midday)`;
  if (slug.includes('-dusk')) return `${baseEn} (Dusk)`;
  if (slug.includes('-small')) return `${baseEn} (Small)`;
  if (slug.includes('-large')) return `${baseEn} (Large)`;
  if (slug.includes('-super')) return `${baseEn} (Jumbo)`;
  if (slug.includes('-eternal')) return `${baseEn} (Eternal)`;
  if (slug.includes('-gmax')) return `${baseEn} (Gigantamax)`;

  const parts = slug.split('-');
  if (parts.length > 1 && parts[0] === parts[0].toLowerCase()) {
    const baseSlug = parts[0];
    const form = parts.slice(1).join('-');
    if (form && form !== baseSlug && !['mega', 'gmax'].includes(form)) {
      return `${titleCaseWords(baseSlug)} (${titleCaseWords(form)})`;
    }
  }

  return titleCaseWords(slug.replace(/-/g, ' '));
}

function mapStats(pokemon) {
  const out = { hp: 0, attack: 0, defense: 0, spAtk: 0, spDef: 0, speed: 0 };
  for (const s of pokemon.stats || []) {
    const key = STAT_KEYS[s.stat.name];
    if (key) out[key] = s.base_stat;
  }
  return out;
}

function mapTypes(pokemon) {
  const sorted = [...(pokemon.types || [])].sort((a, b) => a.slot - b.slot);
  const type1 = TYPE_LABELS[sorted[0]?.type?.name] || 'Normal';
  const type2 = sorted[1] ? TYPE_LABELS[sorted[1].type.name] || '' : '';
  return { type1, type2 };
}

async function mapAbilities(pokemon, abilityCache) {
  const sorted = [...(pokemon.abilities || [])].sort((a, b) => a.slot - b.slot);
  const out = [];
  for (const entry of sorted) {
    const url = entry.ability?.url;
    const slug = entry.ability?.name || '';
    let name = titleCaseWords(slug.replace(/-/g, ' '));
    if (url) {
      let detail = abilityCache.get(url);
      if (!detail) {
        detail = await fetchJson(url);
        abilityCache.set(url, detail);
        await sleep(REQUEST_DELAY_MS);
      }
      const en = detail?.names?.find((n) => n.language?.name === 'en');
      if (en?.name) name = en.name;
    }
    out.push({ name, isHidden: !!entry.is_hidden });
  }
  return out;
}

function pokeApiSpriteUrl(pokemon) {
  return (
    pokemon.sprites?.other?.['official-artwork']?.front_default ||
    pokemon.sprites?.front_default ||
    null
  );
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} : ${url}`);
  return res.json();
}

async function fetchAllPokemonUrls() {
  const urls = [];
  let next = `${POKEAPI_BASE}/pokemon?limit=2000`;
  while (next) {
    const data = await fetchJson(next);
    urls.push(...data.results.map((r) => r.url));
    next = data.next;
    await sleep(REQUEST_DELAY_MS);
  }
  return urls;
}

function validatePool(pool) {
  const ctx = vm.createContext({ window: {} });
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.runInContext(fs.readFileSync(path.join(root, 'js', 'pool-import.js'), 'utf8'), ctx);
  return ctx.PoolImport.validatePoolData(pool);
}

async function main() {
  const oldPool = JSON.parse(fs.readFileSync(OLD_POOL_JSON, 'utf8'));
  const championsActive = getChampionsActiveEntries(oldPool);

  console.log('Liste des Pokémon PokeAPI…');
  const pokemonUrls = await fetchAllPokemonUrls();
  console.log(`Ressources /pokemon : ${pokemonUrls.length}`);

  console.log('Indexation des sprites Pokémon Showdown (ani + gen5)…');
  const [spriteIndex, gen5Index] = await Promise.all([
    loadShowdownSpriteIndex(),
    loadShowdownGen5Index(),
  ]);
  console.log(`Sprites ani : ${spriteIndex.size}, gen5 : ${gen5Index.size}`);

  const speciesCache = new Map();
  const abilityCache = new Map();
  const counters = {};
  const existingIds = new Set();
  const pokemon = [];
  let processed = 0;

  for (const url of pokemonUrls) {
    processed++;
    if (processed % 50 === 0) {
      console.log(`Détail ${processed}/${pokemonUrls.length}…`);
    }

    const detail = await fetchJson(url);
    await sleep(REQUEST_DELAY_MS);

    const speciesUrl = detail.species?.url;
    let species = speciesCache.get(speciesUrl);
    if (!species && speciesUrl) {
      species = await fetchJson(speciesUrl);
      speciesCache.set(speciesUrl, species);
      await sleep(REQUEST_DELAY_MS);
    }
    species = species || { names: [], pokedex_numbers: [] };

    const national = getNationalDex(species) ?? detail.id;
    const num = String(national).padStart(4, '0');
    const isMega = isMegaSlug(detail.name);
    const pokedexId = isMega ? `#${num}-M` : `#${num}`;
    const name = displayNameFromApi(detail.name, species);
    let id = buildId(pokedexId, name, counters);
    if (existingIds.has(id)) {
      id = `${id}-p${detail.id}`;
    }
    if (existingIds.has(id)) {
      id = `${id}-${detail.name}`;
    }
    const { type1, type2 } = mapTypes(detail);
    const stats = mapStats(detail);
    const abilities = await mapAbilities(detail, abilityCache);
    const baseTotal = Object.values(stats).reduce((a, b) => a + b, 0);

    const sprite = resolveShowdownSpriteFull(name, isMega, spriteIndex, gen5Index, detail.name);
    const spriteUrl = sprite?.url || pokeApiSpriteUrl(detail) || PLACEHOLDER;

    const entry = {
      pokedexId,
      id,
      name,
      type1,
      type2,
      baseTotal,
      ...stats,
      spriteUrl,
      enabled: false,
      speciesKey: speciesKeyFromPokedexId(pokedexId),
      isMega,
      abilities,
    };

    existingIds.add(id);
    pokemon.push(entry);
  }

  for (const old of championsActive) {
    const idx = findChampionsMatch(pokemon, old);
    if (idx >= 0) {
      if (pokemon[idx].id !== old.id) {
        existingIds.delete(pokemon[idx].id);
        existingIds.add(old.id);
      }
      applyChampionsOverlay(pokemon[idx], old);
      continue;
    }
  }

  let merged = 0;
  for (const old of championsActive) {
    const already = findChampionsMatch(pokemon, old) >= 0;
    if (!already) {
      let mergeId = old.id;
      if (existingIds.has(mergeId)) {
        mergeId = `${old.id}-pool`;
      }
      if (existingIds.has(mergeId)) {
        continue;
      }
      const entry = { ...old, id: mergeId, enabled: true };
      if (!Array.isArray(entry.abilities) || entry.abilities.length === 0) {
        const donor =
          pokemon.find(
            (p) =>
              p.pokedexId === old.pokedexId &&
              p.isMega === old.isMega &&
              Array.isArray(p.abilities) &&
              p.abilities.length > 0
          ) ||
          pokemon.find(
            (p) =>
              p.speciesKey === old.speciesKey &&
              p.isMega === old.isMega &&
              Array.isArray(p.abilities) &&
              p.abilities.length > 0
          );
        if (donor) entry.abilities = donor.abilities.map((a) => ({ ...a }));
      }
      pokemon.push(entry);
      existingIds.add(mergeId);
      merged++;
    }
  }

  function findAbilityDonor(entry) {
    const basePokedexId = String(entry.pokedexId || '').replace(/-M$/i, '');
    return (
      pokemon.find(
        (p) =>
          p !== entry &&
          p.pokedexId === entry.pokedexId &&
          Array.isArray(p.abilities) &&
          p.abilities.length > 0
      ) ||
      pokemon.find(
        (p) =>
          p !== entry &&
          p.speciesKey === entry.speciesKey &&
          p.isMega === entry.isMega &&
          Array.isArray(p.abilities) &&
          p.abilities.length > 0
      ) ||
      pokemon.find(
        (p) =>
          p !== entry &&
          p.speciesKey === entry.speciesKey &&
          Array.isArray(p.abilities) &&
          p.abilities.length > 0
      ) ||
      pokemon.find(
        (p) =>
          p !== entry &&
          basePokedexId &&
          p.pokedexId === basePokedexId &&
          Array.isArray(p.abilities) &&
          p.abilities.length > 0
      ) ||
      pokemon.find(
        (p) =>
          p !== entry &&
          normalizeKey(p.name) === normalizeKey(entry.name) &&
          Array.isArray(p.abilities) &&
          p.abilities.length > 0
      )
    );
  }

  let abilitiesFilled = 0;
  for (const entry of pokemon) {
    if (!Array.isArray(entry.abilities) || entry.abilities.length === 0) {
      const donor = findAbilityDonor(entry);
      if (donor) {
        entry.abilities = donor.abilities.map((a) => ({ ...a }));
        abilitiesFilled++;
      }
    }
  }
  if (abilitiesFilled) {
    console.log(`Habilités complétées par correspondance : ${abilitiesFilled}`);
  }

  const enabledCount = pokemon.filter((p) => p.enabled).length;

  const pool = {
    version: 1,
    leagueName: 'Pokémon Champions - Saison 1',
    poolLabel: 'Pokédex national',
    pokemon,
  };

  const validation = validatePool(pool);
  if (!validation.ok) {
    console.error('Validation échouée :', validation.errors);
    process.exit(1);
  }

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(pool, null, 2) + '\n', 'utf8');

  const embedPath = path.join(root, 'js', 'pokemon-pokedex-data.js');
  const embedBody = JSON.stringify(pool);
  fs.writeFileSync(
    embedPath,
    '/** Pokédex embarqué (file://) — généré par build-pokedex.mjs */\n' +
      `window.POKEDEX_POOL = ${embedBody};\n`,
    'utf8'
  );
  console.log(`Pokédex embarqué : ${embedPath} (${(embedBody.length / 1024 / 1024).toFixed(2)} Mo)`);

  console.log(`Pokédex écrit : ${OUTPUT_JSON}`);
  console.log(`Pokémon total : ${pokemon.length}`);
  console.log(`Actifs (enabled) : ${enabledCount}`);
  console.log(`Entrées fusionnées depuis l’ancien pool : ${merged}`);
  if (validation.warnings.length) console.log('Avertissements :', validation.warnings);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
