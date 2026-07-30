/**
 * Onglet Pokédex — liste complète et stats JSON.
 */
(function (global) {
  const PLACEHOLDER = 'assets/sprites/placeholder.svg';
  const PAGE_SIZE = 50;
  const MAX_TYPE_FILTERS = 2;

  function typeClass(type) {
    return global.TypeDisplay?.typeClass(type) ?? '';
  }

  function renderTypeBadge(type) {
    if (!type || !global.TypeDisplay) return '';
    return global.TypeDisplay.renderBadge(type, { variant: 'badge' });
  }

  function renderAbilitiesCell(pokemon) {
    const abilities = pokemon?.abilities;
    if (!Array.isArray(abilities) || abilities.length === 0) {
      return '<td class="pokedex-table__abilities"><span class="pokedex-table__empty">—</span></td>';
    }
    const lines = abilities
      .map((ability) => {
        const label = global.PokemonSpecies.formatAbilityName(ability);
        if (!label) return '';
        const hiddenClass = ability.isHidden ? 'pokedex-table-ability--hidden' : '';
        return global.AbilityDisplay?.renderChip(ability, {
          label,
          chipClass: 'ability-chip pokedex-table-ability',
          hiddenClass,
        }) || `<span class="pokedex-table-ability${ability.isHidden ? ' pokedex-table-ability--hidden' : ''}">${escapeHtml(label)}</span>`;
      })
      .filter(Boolean)
      .join('');
    return `<td class="pokedex-table__abilities"><div class="pokedex-table-abilities">${lines}</div></td>`;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function spriteImg(pokemon) {
    return global.SpriteImg.tagForPokemon(pokemon, {
      alt: pokemon.name,
      loading: 'lazy',
      decoding: 'async',
    });
  }

  function getAllTypeSlugs() {
    const labels = global.TypeDisplay?.TYPE_LABEL_EN;
    if (!labels) return [];
    return Object.keys(labels).sort((a, b) =>
      global.TypeDisplay.displayLabel(a).localeCompare(global.TypeDisplay.displayLabel(b), 'fr')
    );
  }

  function normalizeTypeFilters(filters) {
    if (Array.isArray(filters?.typeFilters)) {
      return filters.typeFilters.filter(Boolean).slice(0, MAX_TYPE_FILTERS);
    }
    if (filters?.typeFilter) {
      return [filters.typeFilter];
    }
    return [];
  }

  function pokemonMatchesTypeFilters(pokemon, typeFilters) {
    if (!typeFilters?.length || !global.TypeDisplay) return true;
    const types = [
      global.TypeDisplay.typeSlug(pokemon.type1),
      global.TypeDisplay.typeSlug(pokemon.type2),
    ].filter(Boolean);
    return typeFilters.every((filter) => types.includes(filter));
  }

  function filterList(pool, filters) {
    let list = [...pool];
    list = global.PokemonSpecies.searchPokemon(list, filters.search);

    const enabledFilter = filters.enabledFilter || 'all';
    if (enabledFilter === 'active') {
      list = list.filter((p) => p.enabled === true);
    } else if (enabledFilter === 'inactive') {
      list = list.filter((p) => p.enabled === false);
    }

    const typeFilters = normalizeTypeFilters(filters);
    if (typeFilters.length) {
      list = list.filter((p) => pokemonMatchesTypeFilters(p, typeFilters));
    }

    const sortKey = filters.sortKey || 'name';
    const sortDir = filters.sortDir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      let va;
      let vb;
      if (sortKey === 'name') {
        va = a.name.toLowerCase();
        vb = b.name.toLowerCase();
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      }
      if (sortKey === 'baseTotal') {
        va = global.PokemonSpecies.getBaseTotal(a);
        vb = global.PokemonSpecies.getBaseTotal(b);
      } else if (sortKey === 'pokedexId') {
        va = a.pokedexId;
        vb = b.pokedexId;
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      } else if (sortKey === 'enabled' || sortKey === 'isMega') {
        va = Number(!!a[sortKey]);
        vb = Number(!!b[sortKey]);
      } else {
        va = a[sortKey] ?? 0;
        vb = b[sortKey] ?? 0;
      }
      return (va - vb) * sortDir;
    });

    return list;
  }

  function getPaginationMeta(listLength, page) {
    const totalPages = Math.max(1, Math.ceil(listLength / PAGE_SIZE));
    const safePage = Math.min(totalPages, Math.max(1, page || 1));
    const rangeStart = listLength === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(safePage * PAGE_SIZE, listLength);
    return {
      page: safePage,
      totalPages,
      totalItems: listLength,
      rangeStart,
      rangeEnd,
    };
  }

  function slicePage(list, page) {
    const start = (page - 1) * PAGE_SIZE;
    return list.slice(start, start + PAGE_SIZE);
  }

  function buildPageRange(current, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set([1, totalPages, current, current - 1, current + 1]);
    const sorted = [...pages]
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i += 1) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  }

  function renderActiveStatusCell(pokemon, canEditActive) {
    if (canEditActive) {
      const checked = pokemon.enabled ? ' checked' : '';
      const label = pokemon.enabled ? 'Actif' : 'Inactif';
      return `<td class="pokedex-table__status">
        <label class="pokedex-active-toggle" title="Activer ou désactiver ce Pokémon">
          <input type="checkbox" class="pokedex-active-toggle__input" data-pokemon-id="${escapeAttr(pokemon.id)}"${checked} aria-label="${escapeAttr(label)} — ${escapeAttr(pokemon.name)}">
          <span class="pokedex-active-toggle__track" aria-hidden="true"></span>
          <span class="pokedex-active-toggle__label">${label}</span>
        </label>
      </td>`;
    }
    const statutCol = pokemon.enabled ? 'Actif' : 'Inactif';
    return `<td class="pokedex-table__status pokedex-table__status--readonly" title="Modifiable uniquement avant le démarrage du draft">${statutCol}</td>`;
  }

  function renderSortableTh(label, key, sortKey, sortDir) {
    const active = sortKey === key;
    const dirClass = active ? (sortDir === 'desc' ? ' is-sorted-desc' : ' is-sorted-asc') : '';
    const ariaSort = active ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none';
    const indicator = active
      ? `<span class="pokedex-table__sort-ind" aria-hidden="true">${sortDir === 'desc' ? '↑' : '↓'}</span>`
      : '';
    return `<th class="sortable${dirClass}" data-sort="${escapeHtml(key)}" aria-sort="${ariaSort}">${label}${indicator}</th>`;
  }

  function renderTable(container, list, canEditActive, sortKey, sortDir) {
    const key = sortKey || 'name';
    const dir = sortDir === 'desc' ? 'desc' : 'asc';
    const th = (label, sortField) => renderSortableTh(label, sortField, key, dir);
    const rows = list
      .map((p) => {
        const rowClass = !p.enabled ? 'row-inactif' : '';
        const bst = global.PokemonSpecies.getBaseTotal(p);
        const megaCol = p.isMega ? 'Oui' : '—';
        return `<tr class="${rowClass}">
          <td>${escapeHtml(p.pokedexId)}</td>
          <td>${spriteImg(p)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${renderTypeBadge(p.type1)}</td>
          <td>${renderTypeBadge(p.type2 || '')}</td>
          ${renderAbilitiesCell(p)}
          <td><strong>${bst}</strong></td>
          <td>${p.hp}</td>
          <td>${p.attack}</td>
          <td>${p.defense}</td>
          <td>${p.spAtk}</td>
          <td>${p.spDef}</td>
          <td>${p.speed}</td>
          ${renderActiveStatusCell(p, canEditActive)}
          <td>${megaCol}</td>
        </tr>`;
      })
      .join('');

    container.innerHTML = `
      <table class="pokedex-table">
        <thead>
          <tr>
            ${th('# Pokédex', 'pokedexId')}
            <th>Sprite</th>
            ${th('Pokémon', 'name')}
            <th>Type 1</th>
            <th>Type 2</th>
            <th>Habileté</th>
            ${th('BST', 'baseTotal')}
            ${th('PV', 'hp')}
            ${th('Attaque', 'attack')}
            ${th('Défense', 'defense')}
            ${th('Atq. Spé.', 'spAtk')}
            ${th('Déf. Spé.', 'spDef')}
            ${th('Vitesse', 'speed')}
            ${th('Statut', 'enabled')}
            ${th('Mega', 'isMega')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderPagination(container, meta, options) {
    const { page, totalPages, totalItems, rangeStart, rangeEnd } = meta;
    const pageRange = buildPageRange(page, totalPages);
    const rangeLabel =
      totalItems === 0
        ? 'Aucun résultat'
        : `${rangeStart}–${rangeEnd} sur ${totalItems}`;
    const ariaLabel =
      options?.position === 'bottom'
        ? 'Pagination du Pokédex — bas de liste'
        : 'Pagination du Pokédex';

    const pageButtons = pageRange
      .map((item) => {
        if (item === '…') {
          return '<span class="pokedex-pagination__gap" aria-hidden="true">…</span>';
        }
        const active = item === page ? ' pokedex-page-btn--active' : '';
        const ariaCurrent = item === page ? ' aria-current="page"' : '';
        return `<button type="button" class="pokedex-page-btn${active}" data-pokedex-page="${item}"${ariaCurrent}>${item}</button>`;
      })
      .join('');

    container.innerHTML = `
      <nav class="pokedex-pagination" aria-label="${ariaLabel}">
        <span class="pokedex-pagination__range">${rangeLabel}</span>
        <div class="pokedex-pagination__nav" role="group" aria-label="Pages">
          <button type="button" class="pokedex-page-btn pokedex-page-btn--edge" data-pokedex-page="first" aria-label="Première page"${page <= 1 ? ' disabled' : ''}>«</button>
          <button type="button" class="pokedex-page-btn pokedex-page-btn--edge" data-pokedex-page="prev" aria-label="Page précédente"${page <= 1 ? ' disabled' : ''}>‹</button>
          <div class="pokedex-pagination__pages">${pageButtons}</div>
          <button type="button" class="pokedex-page-btn pokedex-page-btn--edge" data-pokedex-page="next" aria-label="Page suivante"${page >= totalPages ? ' disabled' : ''}>›</button>
          <button type="button" class="pokedex-page-btn pokedex-page-btn--edge" data-pokedex-page="last" aria-label="Dernière page"${page >= totalPages ? ' disabled' : ''}>»</button>
        </div>
        <label class="pokedex-pagination__jump">
          <span>Aller à</span>
          <input type="number" class="pokedex-page-jump" min="1" max="${totalPages}" value="${page}" inputmode="numeric" aria-label="Numéro de page">
          <span>/ ${totalPages}</span>
        </label>
      </nav>`;
  }

  function scrollToTop(root) {
    const el = root?.querySelector('.pokedex-header') || root;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderTypeFilterTriggerContent(typeFilters) {
    const selected = normalizeTypeFilters({ typeFilters });
    if (!selected.length) {
      return '<span class="pokedex-type-filter__option-label">Tous les types</span>';
    }
    return `<span class="pokedex-type-filter__value-badges">${selected
      .map((slug) => renderTypeBadge(slug))
      .join('')}</span>`;
  }

  function renderTypeFilterMenu(typeFilters) {
    const selected = normalizeTypeFilters({ typeFilters });
    const maxReached = selected.length >= MAX_TYPE_FILTERS;
    const typeOptions = getAllTypeSlugs()
      .map((slug) => {
        const isSelected = selected.includes(slug);
        const locked = maxReached && !isSelected;
        const pressed = isSelected ? 'true' : 'false';
        const lockedClass = locked ? ' pokedex-type-filter__option--locked' : '';
        const label = global.TypeDisplay?.displayLabel(slug) || slug;
        return `<button type="button" class="pokedex-type-filter__option${lockedClass}" data-pokedex-type-value="${escapeAttr(slug)}" aria-pressed="${pressed}" aria-label="${escapeAttr(label)}"${locked ? ' disabled' : ''}>${renderTypeBadge(slug)}</button>`;
      })
      .join('');
    const clearDisabled = selected.length ? '' : ' disabled';
    return `
      <div class="pokedex-type-filter__menu-head">
        <span class="pokedex-type-filter__hint">Sélectionnez jusqu'à ${MAX_TYPE_FILTERS} types</span>
        <button type="button" class="pokedex-type-filter__clear" data-pokedex-type-clear${clearDisabled}>Tout effacer</button>
      </div>
      <div class="pokedex-type-filter__grid" role="group" aria-label="Types Pokémon">
        ${typeOptions}
      </div>`;
  }

  function setTypeFilterMenuOpen(wrap, open) {
    if (!wrap) return;
    const menu = wrap.querySelector('.pokedex-type-filter__menu');
    const trigger = wrap.querySelector('.pokedex-type-filter__trigger');
    if (!menu || !trigger) return;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function closeAllTypeFilterMenus(root) {
    root.querySelectorAll('.pokedex-type-filter').forEach((wrap) => setTypeFilterMenuOpen(wrap, false));
  }

  function renderHeaderControls(filters) {
    const enabledFilter = filters.enabledFilter || 'all';
    const typeFilters = normalizeTypeFilters(filters);
    const actions = document.createElement('div');
    actions.className = 'pokedex-header__actions';
    actions.innerHTML = `
          <input type="search" id="pokedex-search" placeholder="Nom ou # Pokédex…" value="${escapeAttr(filters.search || '')}">
          <div class="pokedex-type-filter" id="pokedex-type-filter">
            <button type="button" class="pokedex-type-filter__trigger" id="pokedex-type-filter-trigger" aria-haspopup="true" aria-expanded="false" aria-label="Filtrer par type">
              <span class="pokedex-type-filter__value">${renderTypeFilterTriggerContent(typeFilters)}</span>
              <span class="pokedex-type-filter__caret" aria-hidden="true">▾</span>
            </button>
            <div class="pokedex-type-filter__menu" hidden>
              ${renderTypeFilterMenu(typeFilters)}
            </div>
          </div>
          <select id="pokedex-enabled-filter" aria-label="Filtrer par statut">
            <option value="all"${enabledFilter === 'all' ? ' selected' : ''}>Tous</option>
            <option value="active"${enabledFilter === 'active' ? ' selected' : ''}>Actif</option>
            <option value="inactive"${enabledFilter === 'inactive' ? ' selected' : ''}>Inactif</option>
          </select>`;
    return actions;
  }

  function syncHeaderControls(headerEl, filters) {
    const typeFilters = normalizeTypeFilters(filters);
    const enabledFilter = filters.enabledFilter || 'all';
    const searchInput = headerEl.querySelector('#pokedex-search');
    const typeFilterWrap = headerEl.querySelector('#pokedex-type-filter');
    const filterSelect = headerEl.querySelector('#pokedex-enabled-filter');

    if (searchInput && searchInput !== document.activeElement) {
      searchInput.value = filters.search || '';
    }
    if (typeFilterWrap) {
      const menu = typeFilterWrap.querySelector('.pokedex-type-filter__menu');
      const trigger = typeFilterWrap.querySelector('.pokedex-type-filter__trigger');
      const wasOpen = menu && !menu.hidden;
      const valueEl = typeFilterWrap.querySelector('.pokedex-type-filter__value');
      if (valueEl) valueEl.innerHTML = renderTypeFilterTriggerContent(typeFilters);
      if (menu) menu.innerHTML = renderTypeFilterMenu(typeFilters);
      if (wasOpen && menu && trigger) {
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
      }
    }
    if (filterSelect && filterSelect !== document.activeElement) {
      filterSelect.value = enabledFilter;
    }
  }

  function renderHeader(headerEl, poolData, filters, list) {
    const league = poolData?.leagueName || 'Pokédex';
    const label = poolData?.poolLabel ? ` — ${poolData.poolLabel}` : '';
    const total = poolData?.pokemon?.length || 0;
    const shown = list.length;
    const countLine =
      shown === total
        ? `${total} Pokémon dans le Pokédex`
        : `${shown} affichés sur ${total} Pokémon`;

    let top = headerEl.querySelector('.pokedex-header__top');
    if (!top) {
      headerEl.innerHTML = `
      <div class="pokedex-header__top">
        <div class="pokedex-header__title">
          <h2></h2>
          <p></p>
        </div>
      </div>`;
      top = headerEl.querySelector('.pokedex-header__top');
    }

    if (
      !headerEl.querySelector('#pokedex-search') ||
      !headerEl.querySelector('#pokedex-type-filter') ||
      !headerEl.querySelector('.pokedex-type-filter__grid')
    ) {
      headerEl.querySelector('.pokedex-header__actions')?.remove();
      top.appendChild(renderHeaderControls(filters));
    }

    const titleEl = headerEl.querySelector('.pokedex-header__title h2');
    const countEl = headerEl.querySelector('.pokedex-header__title p');
    if (titleEl) titleEl.textContent = `${league}${label}`;
    if (countEl) countEl.textContent = countLine;

    syncHeaderControls(headerEl, filters);
  }

  function render(root, poolData, uiState, options) {
    if (!root) return;
    const canEditActive = options?.canEditActive === true;
    const pool = poolData?.pokemon || [];
    const headerEl = root.querySelector('.pokedex-header');
    const contentEl = root.querySelector('.pokedex-content');

    const filters = uiState.pokedexFilters || {
      search: '',
      sortKey: 'name',
      sortDir: 'asc',
      enabledFilter: 'all',
      typeFilters: [],
      page: 1,
    };

    if (!pool.length) {
      if (headerEl) {
        headerEl.innerHTML = `
          <div class="pokedex-header__top">
            <div class="pokedex-header__title">
              <h2>Pokédex</h2>
              <p>Chargement du Pokédex…</p>
            </div>
          </div>`;
      }
      if (contentEl) {
        contentEl.innerHTML = '<div class="pokedex-empty">Aucun Pokémon dans le Pokédex.</div>';
      }
      return;
    }

    const list = filterList(pool, filters);
    const meta = getPaginationMeta(list.length, filters.page);
    filters.page = meta.page;

    if (headerEl) renderHeader(headerEl, poolData, filters, list);

    if (!contentEl) return;

    if (list.length === 0) {
      contentEl.innerHTML = '<div class="pokedex-empty">Aucun résultat pour cette recherche.</div>';
      return;
    }

    const pageList = slicePage(list, meta.page);

    contentEl.innerHTML = `
      <div class="pokedex-toolbar"></div>
      <div class="pokedex-table-wrap"></div>
      <div class="pokedex-toolbar pokedex-toolbar--bottom"></div>`;

    renderPagination(contentEl.querySelector('.pokedex-toolbar:not(.pokedex-toolbar--bottom)'), meta);
    renderTable(
      contentEl.querySelector('.pokedex-table-wrap'),
      pageList,
      canEditActive,
      filters.sortKey,
      filters.sortDir
    );
    renderPagination(contentEl.querySelector('.pokedex-toolbar--bottom'), meta, { position: 'bottom' });
  }

  function bindFilters(root, onChange) {
    root.addEventListener('input', (e) => {
      const id = e.target.id;
      if (id === 'pokedex-search') onChange(e);
    });
    root.addEventListener('change', (e) => {
      const id = e.target.id;
      if (id === 'pokedex-enabled-filter' || e.target.closest('.pokedex-page-jump')) {
        onChange(e);
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllTypeFilterMenus(root);
        return;
      }
      if (e.target.closest('.pokedex-page-jump') && e.key === 'Enter') {
        e.preventDefault();
        onChange(e);
      }
    });
    root.addEventListener('click', (e) => {
      const clearTypes = e.target.closest('[data-pokedex-type-clear]');
      if (clearTypes && !clearTypes.disabled) {
        e.preventDefault();
        onChange(e, { typeFilterClear: true });
        return;
      }
      const typeOption = e.target.closest('[data-pokedex-type-value]');
      if (typeOption && !typeOption.disabled) {
        e.preventDefault();
        onChange(e, { typeFilterToggle: typeOption.dataset.pokedexTypeValue });
        return;
      }
      const typeTrigger = e.target.closest('#pokedex-type-filter-trigger');
      if (typeTrigger) {
        e.preventDefault();
        const wrap = typeTrigger.closest('.pokedex-type-filter');
        const menu = wrap?.querySelector('.pokedex-type-filter__menu');
        const willOpen = !!menu?.hidden;
        closeAllTypeFilterMenus(root);
        if (wrap && willOpen) setTypeFilterMenuOpen(wrap, true);
        return;
      }
      if (!e.target.closest('.pokedex-type-filter')) {
        closeAllTypeFilterMenus(root);
      }
      if (e.target.closest('.pokedex-active-toggle')) {
        e.stopPropagation();
        return;
      }
      const pageBtn = e.target.closest('[data-pokedex-page]');
      if (pageBtn && !pageBtn.disabled) {
        e.preventDefault();
        onChange(e, { pageNav: pageBtn.dataset.pokedexPage });
        return;
      }
      const th = e.target.closest('th.sortable');
      if (th) {
        onChange(e, { sortKey: th.dataset.sort });
      }
    });
    root.addEventListener('change', (e) => {
      const toggle = e.target.closest('.pokedex-active-toggle__input');
      if (toggle?.dataset.pokemonId) {
        e.stopPropagation();
        onChange(e, { toggleId: toggle.dataset.pokemonId });
      }
    });
  }

  global.PokedexView = {
    PLACEHOLDER,
    PAGE_SIZE,
    MAX_TYPE_FILTERS,
    typeClass,
    render,
    bindFilters,
    filterList,
    normalizeTypeFilters,
    scrollToTop,
  };
})(typeof window !== 'undefined' ? window : globalThis);
