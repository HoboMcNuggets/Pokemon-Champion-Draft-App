/**
 * Animations pick / ban — mode Stream (pop-in CSS + vol FLIP spotlight).
 */
(function (global) {
  let pendingTurnAction = null;
  let suppressOnce = false;
  const activeAnimations = [];
  let flyGhostEl = null;
  let incomingTargetEl = null;
  let capturedOriginRect = null;
  let capturedAction = null;

  function prefersReducedMotion() {
    return global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  function shouldAnimate() {
    if (suppressOnce) return false;
    if (prefersReducedMotion()) return false;
    return true;
  }

  function suppressNextRender() {
    suppressOnce = true;
  }

  function consumeSuppressOnce() {
    const wasSuppressed = suppressOnce;
    suppressOnce = false;
    return wasSuppressed;
  }

  function isSuppressed() {
    return suppressOnce;
  }

  function prepareTurnAction(meta) {
    pendingTurnAction = meta ? { ...meta } : null;
  }

  function consumeTurnAction() {
    const action = pendingTurnAction;
    pendingTurnAction = null;
    return action;
  }

  function captureSpotlightOrigin() {
    const action = consumeTurnAction();
    capturedAction = action;
    if (!action) {
      capturedOriginRect = null;
      return null;
    }
    const sprite = document.querySelector('#stream-spotlight-frame .stream-spotlight__sprite');
    capturedOriginRect = sprite ? sprite.getBoundingClientRect() : null;
    return { action, originRect: capturedOriginRect };
  }

  function getCapturedFlyContext() {
    const ctx = {
      action: capturedAction,
      originRect: capturedOriginRect,
    };
    capturedAction = null;
    capturedOriginRect = null;
    return ctx;
  }

  function removeLandingClasses() {
    document.querySelectorAll('.stream-slot--landing').forEach((el) => {
      el.classList.remove('stream-slot--landing');
    });
    document.querySelectorAll('.stream-banned__item--landing').forEach((el) => {
      el.classList.remove('stream-banned__item--landing');
    });
  }

  function cancelAll() {
    activeAnimations.forEach((anim) => {
      try {
        anim.cancel();
      } catch (_) {
        /* ignore */
      }
    });
    activeAnimations.length = 0;

    if (flyGhostEl) {
      flyGhostEl.remove();
      flyGhostEl = null;
    }

    if (incomingTargetEl) {
      incomingTargetEl.classList.remove('stream-slot--incoming', 'stream-banned__cell--incoming');
      incomingTargetEl = null;
    }

    removeLandingClasses();
  }

  function trackAnimation(anim) {
    activeAnimations.push(anim);
    anim.addEventListener(
      'finish',
      () => {
        const idx = activeAnimations.indexOf(anim);
        if (idx >= 0) activeAnimations.splice(idx, 1);
      },
      { once: true }
    );
    anim.addEventListener(
      'cancel',
      () => {
        const idx = activeAnimations.indexOf(anim);
        if (idx >= 0) activeAnimations.splice(idx, 1);
      },
      { once: true }
    );
  }

  function playLandAnimation(el, className) {
    if (!shouldAnimate() || !el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    const onEnd = (event) => {
      if (event.target !== el && !el.contains(event.target)) return;
      el.classList.remove(className);
      el.removeEventListener('animationend', onEnd);
    };
    el.addEventListener('animationend', onEnd);
  }

  function playSlotLand(slotEl) {
    if (!slotEl) return;
    playLandAnimation(slotEl, 'stream-slot--landing');
  }

  function playBanLand(cellEl) {
    if (!cellEl) return;
    const item = cellEl.querySelector('.stream-banned__item:not(.stream-banned__item--empty)');
    if (!item) return;
    playLandAnimation(item, 'stream-banned__item--landing');
  }

  function resolveSpriteUrl(pickOrBan, poolData) {
    if (!pickOrBan) return '';
    if (pickOrBan.spriteUrl) return pickOrBan.spriteUrl;
    const id = pickOrBan.id || pickOrBan.pokemonId;
    if (!id || !poolData || !global.DraftState) return '';
    const pokemon = global.DraftState.findPokemon(poolData, id);
    return pokemon?.spriteUrl || '';
  }

  function playFlyToTarget({ originRect, targetEl, spriteUrl, kind, onComplete }) {
    if (!shouldAnimate() || !originRect || !targetEl || !spriteUrl) {
      onComplete?.();
      return false;
    }

    const targetSprite = targetEl.querySelector('.stream-slot__sprite, .stream-banned__item img');
    const targetRect = (targetSprite || targetEl).getBoundingClientRect();
    if (!targetRect.width && !targetRect.height) {
      onComplete?.();
      return false;
    }

    const fromW = originRect.width || 1;
    const fromH = originRect.height || 1;
    const toW = targetRect.width || fromW;
    const toH = targetRect.height || fromH;
    const scale = Math.min(toW / fromW, toH / fromH);
    const dx =
      targetRect.left + targetRect.width / 2 - (originRect.left + originRect.width / 2);
    const dy =
      targetRect.top + targetRect.height / 2 - (originRect.top + originRect.height / 2);

    if (flyGhostEl) {
      flyGhostEl.remove();
      flyGhostEl = null;
    }
    if (incomingTargetEl) {
      incomingTargetEl.classList.remove('stream-slot--incoming', 'stream-banned__cell--incoming');
      incomingTargetEl = null;
    }

    const ghost = document.createElement('div');
    ghost.className = 'stream-fly-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = spriteUrl;
    img.alt = '';
    img.className = 'stream-fly-ghost__sprite';
    img.decoding = 'async';
    ghost.appendChild(img);
    ghost.style.left = `${originRect.left}px`;
    ghost.style.top = `${originRect.top}px`;
    ghost.style.width = `${fromW}px`;
    ghost.style.height = `${fromH}px`;
    document.body.appendChild(ghost);
    flyGhostEl = ghost;

    if (kind === 'ban') {
      targetEl.classList.add('stream-banned__cell--incoming');
    } else {
      targetEl.classList.add('stream-slot--incoming');
    }
    incomingTargetEl = targetEl;

    const shrinkOffset = 0.38;
    const anim = ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1)', offset: 0 },
        { transform: `translate(0, 0) scale(${scale})`, offset: shrinkOffset },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          offset: 1,
        },
      ],
      {
        duration: 480,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      }
    );
    trackAnimation(anim);

    const cleanup = () => {
      if (ghost.isConnected) ghost.remove();
      if (flyGhostEl === ghost) flyGhostEl = null;
      targetEl.classList.remove('stream-slot--incoming', 'stream-banned__cell--incoming');
      if (incomingTargetEl === targetEl) incomingTargetEl = null;
    };

    anim.addEventListener(
      'finish',
      () => {
        cleanup();
        onComplete?.();
      },
      { once: true }
    );

    anim.addEventListener(
      'cancel',
      () => {
        cleanup();
      },
      { once: true }
    );

    return true;
  }

  function matchesPickAction(action, playerIndex, slotIndex) {
    return (
      action?.kind === 'pick' &&
      action.playerIndex === playerIndex &&
      action.slotIndex === slotIndex
    );
  }

  function matchesBanAction(action, playerIndex) {
    return action?.kind === 'ban' && action.playerIndex === playerIndex;
  }

  function playPickAnimation(slotEl, pick, flyContext, poolData, playerIndex, slotIndex) {
    if (!shouldAnimate() || !slotEl || !pick) return;

    const { action, originRect } = flyContext || {};
    const spriteUrl = action?.spriteUrl || resolveSpriteUrl(pick, poolData);

    if (matchesPickAction(action, playerIndex, slotIndex)) {
      const flew = playFlyToTarget({
        originRect,
        targetEl: slotEl,
        spriteUrl,
        kind: 'pick',
        onComplete: () => playSlotLand(slotEl),
      });
      if (flew) return;
    }

    playSlotLand(slotEl);
  }

  function playBanAnimation(cellEl, ban, flyContext, poolData, playerIndex) {
    if (!shouldAnimate() || !cellEl || !ban) return;

    const { action, originRect } = flyContext || {};
    const pokemon = ban.pokemon || ban;
    const spriteUrl = action?.spriteUrl || resolveSpriteUrl(pokemon, poolData);

    if (matchesBanAction(action, playerIndex)) {
      const flew = playFlyToTarget({
        originRect,
        targetEl: cellEl,
        spriteUrl,
        kind: 'ban',
        onComplete: () => playBanLand(cellEl),
      });
      if (flew) return;
    }

    playBanLand(cellEl);
  }

  global.StreamAnimations = {
    prepareTurnAction,
    captureSpotlightOrigin,
    getCapturedFlyContext,
    cancelAll,
    shouldAnimate,
    suppressNextRender,
    consumeSuppressOnce,
    isSuppressed,
    playSlotLand,
    playBanLand,
    playPickAnimation,
    playBanAnimation,
  };
})(window);
