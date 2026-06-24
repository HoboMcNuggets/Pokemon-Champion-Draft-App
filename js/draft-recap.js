/**
 * Récapitulatif de fin de draft — calculs, rendu stream et export image.
 *
 * Export : html2canvas sur un nœud offscreen. Les sprites Pokémon externes
 * (Showdown/Pokeos) ne sont pas inclus — ajout futur soumis à CORS.
 */
(function (global) {
  const TYPE_COLORS = {
    Normal: '#a8a878',
    Fire: '#ee8130',
    Water: '#2d6fa8',
    Grass: '#5cbd2e',
    Electric: '#8a7008',
    Ice: '#98d8d8',
    Fighting: '#c03028',
    Poison: '#a33ea1',
    Ground: '#e2bf65',
    Flying: '#a8c8e8',
    Psychic: '#f85888',
    Bug: '#6d7a12',
    Rock: '#8f7f3a',
    Ghost: '#705898',
    Dragon: '#3d4cb8',
    Dark: '#3a322c',
    Steel: '#b8b8d0',
    Fairy: '#d878c8',
    Stellar: '#3a9fd4',
  };

  const EXPORT_DEFAULTS = {
    width: 1920,
    scale: 2,
    backgroundColor: '#0f1117',
  };

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function computeDurationMs(state) {
    const start = state.draftStartedAt ? Date.parse(state.draftStartedAt) : NaN;
    const end = state.draftCompletedAt ? Date.parse(state.draftCompletedAt) : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return end - start;
  }

  function formatDuration(ms) {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function resolvePick(poolData, pick) {
    if (!pick?.id || !poolData) return null;
    return global.DraftState.findPokemon(poolData, pick.id);
  }

  function resolveTeamPokemon(poolData, picks) {
    return (picks || []).map((pick) => resolvePick(poolData, pick)).filter(Boolean);
  }

  function countDraftedTypes(state, poolData) {
    const typeCounts = {};
    for (const team of state.teams || []) {
      for (const pick of team) {
        const pokemon = resolvePick(poolData, pick);
        if (!pokemon) continue;
        [pokemon.type1, pokemon.type2]
          .filter((t) => t && String(t).trim())
          .forEach((type) => {
            const label = global.TypeDisplay?.displayLabel?.(type) || type;
            typeCounts[label] = (typeCounts[label] || 0) + 1;
          });
      }
    }
    return typeCounts;
  }

  function formatWeaknessDetail(weakness) {
    if (!weakness) return '—';
    const parts = [];
    if (weakness.weak4xCount > 0) parts.push(`${weakness.weak4xCount} ×4`);
    const x2Only = weakness.weakCount - weakness.weak4xCount;
    if (x2Only > 0) parts.push(`${x2Only} ×2`);
    return parts.length ? parts.join(', ') : '—';
  }

  function computePlayerStat(player, picks, poolData) {
    const teamPokemon = resolveTeamPokemon(poolData, picks);
    const bstTotal = teamPokemon.reduce(
      (sum, p) => sum + global.PokemonSpecies.getBaseTotal(p),
      0
    );
    const weakness = global.TypeChart.computeDominantWeakness(teamPokemon);
    return {
      name: player?.name || '—',
      bstTotal,
      resolvedCount: teamPokemon.length,
      pickCount: (picks || []).length,
      weaknessType: weakness?.type ?? null,
      weaknessScore: weakness?.score ?? 0,
      weakCount: weakness?.weakCount ?? 0,
      weak4xCount: weakness?.weak4xCount ?? 0,
    };
  }

  function buildBanMatrix(bans) {
    const playerCount = global.DraftState.PLAYER_COUNT;
    const round1 = Array.from({ length: playerCount }, () => null);
    const round2 = Array.from({ length: playerCount }, () => null);

    (bans || []).forEach((ban, index) => {
      const playerIndex =
        typeof ban.playerIndex === 'number' && ban.playerIndex >= 0 && ban.playerIndex < playerCount
          ? ban.playerIndex
          : global.DraftState.getBanPlayerIndex(index);
      const round = global.DraftState.getBanRound(index);
      if (round === 1) round1[playerIndex] = ban;
      else if (round === 2) round2[playerIndex] = ban;
    });

    return { round1, round2 };
  }

  function resolveBanPokemon(ban, poolData) {
    if (!ban) return null;
    if (ban.pokemon?.id) return ban.pokemon;
    if (ban.pokemonId && poolData) {
      return global.DraftState.findPokemon(poolData, ban.pokemonId);
    }
    return null;
  }

  function buildPlayerTeams(state, poolData) {
    return (state.players || []).map((player, index) => ({
      name: player?.name || '—',
      picks: (state.teams?.[index] || []).map((pick) => {
        const pokemon = resolvePick(poolData, pick);
        return {
          id: pick?.id || null,
          name: pokemon?.name || pick?.name || pick?.id || '—',
          pokemon,
        };
      }),
    }));
  }

  function buildBanBoard(state, poolData) {
    const { round1, round2 } = buildBanMatrix(state.bans);
    return {
      playerNames: (state.players || []).map((player) => player?.name || '—'),
      round1: round1.map((ban) => resolveBanPokemon(ban, poolData)),
      round2: round2.map((ban) => resolveBanPokemon(ban, poolData)),
    };
  }

  function computeRecap(state, poolData) {
    const durationMs = computeDurationMs(state);
    const typeCounts = countDraftedTypes(state, poolData);
    const playerStats = (state.players || []).map((player, index) =>
      computePlayerStat(player, state.teams?.[index] || [], poolData)
    );
    const typeTotal = Object.values(typeCounts).reduce((a, b) => a + b, 0);
    return {
      durationMs,
      durationLabel: formatDuration(durationMs),
      typeCounts,
      typeTotal,
      playerStats,
      playerTeams: buildPlayerTeams(state, poolData),
      banBoard: buildBanBoard(state, poolData),
    };
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function resolveExportSpriteUrl(pokemon) {
    const placeholder = global.SpriteImg?.PLACEHOLDER || 'assets/sprites/placeholder.svg';
    const resolved = global.SpriteImg?.resolveSprite?.(pokemon) || {
      url: pokemon?.spriteUrl || placeholder,
      fallbacks: [],
    };
    let url = resolved.url || placeholder;
    const fallbacks = resolved.fallbacks || [];

    const staticFallback = fallbacks.find((u) => /\.png$/i.test(u) && !/\.gif$/i.test(u));
    if (staticFallback) {
      url = staticFallback;
    } else if (/\.gif$/i.test(url) && /pokemonshowdown\.com\/sprites\/ani\//i.test(url)) {
      url = url.replace('/sprites/ani/', '/sprites/gen5/').replace(/\.gif$/i, '.png');
    }

    return url || placeholder;
  }

  function renderExportImgTag(pokemon) {
    const url = resolveExportSpriteUrl(pokemon);
    const isExternal = /^https?:\/\//i.test(url);
    const cors = isExternal ? ' crossorigin="anonymous"' : '';
    return `<img class="recap-export-sprite" src="${escapeAttr(url)}"${cors} alt="" draggable="false" decoding="async">`;
  }

  function renderExportPokemonSprite(pokemon, poolData) {
    if (!pokemon) {
      return '<div class="recap-export-sprite recap-export-sprite--empty" aria-hidden="true"></div>';
    }
    const img = renderExportImgTag(pokemon);
    const isMega = global.SpriteImg?.isMegaPokemon?.(pokemon, poolData);
    if (!isMega) {
      return `<div class="recap-export-sprite-wrap">${img}</div>`;
    }
    return `<div class="recap-export-sprite-wrap">${img}<span class="recap-export-mega-label">Mega</span></div>`;
  }

  function renderExportSprite(pokemon, poolData) {
    return renderExportPokemonSprite(pokemon, poolData);
  }

  function renderExportPokemonCell(pick, poolData) {
    const name = pick?.name || '—';
    const spriteHtml = renderExportSprite(pick?.pokemon, poolData);
    return `<div class="recap-export-pokemon">
      <div class="recap-export-pokemon__sprite">${spriteHtml}</div>
      <span class="recap-export-pokemon__name">${escapeHtml(name)}</span>
    </div>`;
  }

  function renderExportTeams(playerTeams, poolData) {
    const cards = (playerTeams || [])
      .map((playerTeam) => {
        const slots = (playerTeam.picks || [])
          .map((pick) => renderExportPokemonCell(pick, poolData))
          .join('');
        return `<article class="recap-export-player">
          <h4 class="recap-export-player__name">${escapeHtml(playerTeam.name)}</h4>
          <div class="recap-export-player__grid">${slots}</div>
        </article>`;
      })
      .join('');

    return `
      <section class="recap-export-section recap-export-section--teams" aria-label="Équipes">
        <h3 class="recap-export-section__title">Équipes</h3>
        <div class="recap-export-teams-grid">${cards}</div>
      </section>`;
  }

  function renderExportBanCell(pokemon, poolData) {
    if (!pokemon) {
      return `<div class="recap-export-ban-cell recap-export-ban-cell--empty" aria-hidden="true">
        <div class="recap-export-ban-cell__item"></div>
      </div>`;
    }
    const spriteHtml = renderExportImgTag(pokemon);
    const isMega = global.SpriteImg?.isMegaPokemon?.(pokemon, poolData);
    const megaHtml = isMega
      ? '<span class="recap-export-mega-label recap-export-mega-label--banned">Mega</span>'
      : '';
    return `<div class="recap-export-ban-cell">
      <div class="recap-export-ban-cell__item">${spriteHtml}</div>
      ${megaHtml}
      <span class="recap-export-ban-cell__name">${escapeHtml(pokemon.name)}</span>
    </div>`;
  }

  function renderExportBans(banBoard, poolData) {
    const names = banBoard?.playerNames || [];
    const headers = names
      .map((name) => `<div class="recap-export-bans__head">${escapeHtml(name)}</div>`)
      .join('');
    const row = (round) =>
      (round || []).map((pokemon) => renderExportBanCell(pokemon, poolData)).join('');

    return `
      <section class="recap-export-section recap-export-section--bans" aria-label="Bannis">
        <h3 class="recap-export-section__title">Bannis</h3>
        <div class="recap-export-bans">
          <div class="recap-export-bans__grid">
            <div class="recap-export-bans__corner" aria-hidden="true"></div>
            ${headers}
            <span class="recap-export-bans__round">Tour 1</span>
            ${row(banBoard?.round1)}
            <div class="recap-export-bans__separator" aria-hidden="true"></div>
            <span class="recap-export-bans__round">Tour 2</span>
            ${row(banBoard?.round2)}
          </div>
        </div>
      </section>`;
  }

  function renderExportInner(recap, poolData) {
    return `
      <div class="stream-recap__inner recap-export-inner">
        <header class="stream-recap__header">
          <h2 class="stream-recap__title">Récapitulatif</h2>
          <p class="stream-recap__duration">Durée totale : <strong>${escapeHtml(recap.durationLabel)}</strong></p>
        </header>
        ${renderExportTeams(recap.playerTeams, poolData)}
        ${renderExportBans(recap.banBoard, poolData)}
      </div>`;
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    if (endAngle - startAngle >= 359.999) {
      return [
        `M ${cx - r} ${cy}`,
        `A ${r} ${r} 0 1 0 ${cx + r} ${cy}`,
        `A ${r} ${r} 0 1 0 ${cx - r} ${cy}`,
        'Z',
      ].join(' ');
    }
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${cx} ${cy}`,
      `L ${start.x} ${start.y}`,
      `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      'Z',
    ].join(' ');
  }

  function renderPieChart(typeCounts, typeTotal, options = {}) {
    const interactive = options.interactive !== false;
    const entries = Object.entries(typeCounts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], 'fr');
    });

    if (!entries.length || typeTotal <= 0) {
      return '<p class="stream-recap__empty">Aucun type drafté</p>';
    }

    const cx = 50;
    const cy = 50;
    const r = 42;
    let angle = 0;
    const slices = entries.map(([type, count]) => {
      const sweep = (count / typeTotal) * 360;
      const path =
        sweep >= 360
          ? describeArc(cx, cy, r, 0, 360)
          : describeArc(cx, cy, r, angle, angle + sweep);
      const fill = TYPE_COLORS[type] || '#666';
      const pct = Math.round((count / typeTotal) * 100);
      angle += sweep;
      const tabIndex = interactive ? ' tabindex="0"' : '';
      return `<path d="${path}" fill="${fill}" class="stream-recap__pie-slice" data-type="${escapeHtml(type)}" data-pct="${pct}" data-count="${count}"${tabIndex}></path>`;
    });

    const legend = entries
      .map(([type, count]) => {
        const pct = Math.round((count / typeTotal) * 100);
        const badge = global.TypeDisplay?.renderBadge?.(type, { variant: 'orb' }) ?? escapeHtml(type);
        return `<li class="stream-recap__legend-item">
          <span class="stream-recap__legend-swatch" style="background:${TYPE_COLORS[type] || '#666'}"></span>
          ${badge}
          <span class="stream-recap__legend-meta">${count} · ${pct}%</span>
        </li>`;
      })
      .join('');

    const tooltipHtml = interactive
      ? '<div class="stream-recap__pie-tooltip" role="tooltip" aria-hidden="true"></div>'
      : '';

    return `
      <div class="stream-recap__pie-wrap">
        <div class="stream-recap__pie-stage">
          <svg class="stream-recap__pie" viewBox="0 0 100 100" role="img" aria-label="Répartition des types draftés">${slices.join('')}</svg>
          ${tooltipHtml}
        </div>
        <ul class="stream-recap__legend">${legend}</ul>
      </div>`;
  }

  function setupPieInteractions(container) {
    const stage = container.querySelector('.stream-recap__pie-stage');
    if (!stage) return;

    const tooltip = stage.querySelector('.stream-recap__pie-tooltip');
    const slices = stage.querySelectorAll('.stream-recap__pie-slice');
    if (!tooltip || !slices.length) return;

    let activeSlice = null;

    function positionTooltip(clientX, clientY) {
      const rect = stage.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    }

    function showTooltip(slice, clientX, clientY) {
      if (activeSlice && activeSlice !== slice) {
        activeSlice.classList.remove('stream-recap__pie-slice--active');
      }
      activeSlice = slice;
      slice.classList.add('stream-recap__pie-slice--active');
      tooltip.textContent = `${slice.dataset.type} · ${slice.dataset.pct}%`;
      tooltip.classList.add('stream-recap__pie-tooltip--visible');
      tooltip.setAttribute('aria-hidden', 'false');
      positionTooltip(clientX, clientY);
    }

    function hideTooltip() {
      if (activeSlice) {
        activeSlice.classList.remove('stream-recap__pie-slice--active');
        activeSlice = null;
      }
      tooltip.classList.remove('stream-recap__pie-tooltip--visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }

    slices.forEach((slice) => {
      slice.addEventListener('mouseenter', (e) => showTooltip(slice, e.clientX, e.clientY));
      slice.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
      slice.addEventListener('mouseleave', hideTooltip);
      slice.addEventListener('focus', () => {
        const rect = slice.getBoundingClientRect();
        showTooltip(slice, rect.left + rect.width / 2, rect.top + rect.height / 2);
      });
      slice.addEventListener('blur', hideTooltip);
    });
  }

  function renderPlayerTable(playerStats) {
    const rows = playerStats
      .map((p) => {
        const weaknessBadge = p.weaknessType
          ? global.TypeDisplay?.renderBadge?.(p.weaknessType, { variant: 'orb' }) ?? escapeHtml(p.weaknessType)
          : '—';
        const bstLabel =
          p.resolvedCount < p.pickCount
            ? `${p.bstTotal}*`
            : String(p.bstTotal);

        return `<tr>
          <td class="stream-recap__player">${escapeHtml(p.name)}</td>
          <td class="stream-recap__bst">${bstLabel}</td>
          <td class="stream-recap__weakness">
            <span class="stream-recap__weakness-type">${weaknessBadge}</span>
          </td>
        </tr>`;
      })
      .join('');

    return `
      <div class="stream-recap__table-wrap">
        <table class="stream-recap__table">
          <thead>
            <tr>
              <th scope="col">Nom</th>
              <th scope="col">Total Stats</th>
              <th scope="col">Faiblesse</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderRecapInner(recap, options = {}) {
    const interactive = options.interactive !== false;
    return `
      <div class="stream-recap__inner">
        <header class="stream-recap__header">
          <h2 class="stream-recap__title">Récapitulatif</h2>
          <p class="stream-recap__duration">Durée totale : <strong>${escapeHtml(recap.durationLabel)}</strong></p>
        </header>
        <div class="stream-recap__columns">
          <section class="stream-recap__section stream-recap__section--types" aria-label="Types draftés">
            <h3 class="stream-recap__section-title">Types draftés</h3>
            ${renderPieChart(recap.typeCounts, recap.typeTotal, { interactive })}
          </section>
          <section class="stream-recap__section stream-recap__section--teams" aria-label="Joueurs">
            <h3 class="stream-recap__section-title">Joueur</h3>
            ${renderPlayerTable(recap.playerStats)}
          </section>
        </div>
      </div>`;
  }

  function renderStream(container, recap) {
    if (!container || !recap) return;
    container.innerHTML = renderRecapInner(recap, { interactive: true });
    setupPieInteractions(container);
  }

  function defaultExportFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `draft-recap-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
  }

  function buildExportHost(recap, poolData) {
    const host = document.createElement('div');
    host.className = 'recap-export-host';
    host.setAttribute('aria-hidden', 'true');
    host.innerHTML = `<div class="stream-recap recap-export-card">${renderExportInner(recap, poolData)}</div>`;
    return host;
  }

  function waitForImage(img, timeoutMs = 8000) {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve(true);
        return;
      }
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(ok);
      };
      const timer = setTimeout(() => done(false), timeoutMs);
      img.onload = () => done(true);
      img.onerror = () => done(false);
    });
  }

  async function preloadExternalSprite(url, cache) {
    if (cache.has(url)) return cache.get(url);
    const promise = new Promise((resolve, reject) => {
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.onload = () => resolve(true);
      probe.onerror = () => reject(new Error('preload failed'));
      probe.src = url;
    });
    cache.set(url, promise);
    return promise;
  }

  async function prepareExportImages(root) {
    const imgs = [...root.querySelectorAll('img[src]')];
    const localDataCache = new Map();
    const externalPreloadCache = new Map();
    let degraded = false;

    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute('src') || '';
        if (!src || src.startsWith('data:')) return;

        img.removeAttribute('onerror');
        img.removeAttribute('onload');
        img.removeAttribute('data-sprite-fallbacks');
        img.removeAttribute('data-sprite-src');

        if (!/^https?:\/\//i.test(src)) {
          try {
            if (!localDataCache.has(src)) {
              const res = await fetch(src);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const text = await res.text();
              localDataCache.set(
                src,
                `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`
              );
            }
            img.src = localDataCache.get(src);
          } catch {
            degraded = true;
            img.remove();
          }
          return;
        }

        try {
          await preloadExternalSprite(src, externalPreloadCache);
          if (!img.crossOrigin) img.crossOrigin = 'anonymous';
          const ok = await waitForImage(img);
          if (!ok) throw new Error('load failed');
        } catch {
          degraded = true;
          img.remove();
        }
      })
    );

    return { degraded };
  }

  async function exportRecapImage(recap, options = {}) {
    if (!recap) {
      return { ok: false, error: 'Récapitulatif indisponible.' };
    }
    if (typeof global.html2canvas !== 'function') {
      return { ok: false, error: 'Bibliothèque html2canvas non chargée.' };
    }

    const width = options.width ?? EXPORT_DEFAULTS.width;
    const scale = options.scale ?? EXPORT_DEFAULTS.scale;
    const backgroundColor = options.backgroundColor ?? EXPORT_DEFAULTS.backgroundColor;
    const filename = options.filename ?? defaultExportFilename();

    const poolData = options.poolData ?? null;
    const host = buildExportHost(recap, poolData);
    document.body.appendChild(host);
    const card = host.querySelector('.recap-export-card');

    try {
      const { degraded } = await prepareExportImages(host);

      const canvas = await global.html2canvas(card, {
        backgroundColor,
        scale,
        width,
        useCORS: true,
        logging: false,
        imageTimeout: 0,
      });

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Échec de la génération PNG.'));
        }, 'image/png');
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);

      return { ok: true, degraded };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    } finally {
      host.remove();
    }
  }

  global.DraftRecap = {
    computeDurationMs,
    formatDuration,
    computeRecap,
    renderStream,
    renderRecapInner,
    renderExportInner,
    buildExportHost,
    exportRecapImage,
    buildPlayerTeams,
    buildBanBoard,
    countDraftedTypes,
    computePlayerStat,
    formatWeaknessDetail,
    TYPE_COLORS,
    EXPORT_DEFAULTS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
