(() => {
  const scene = document.querySelector('#about .creator-scene');
  if (!scene) return;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const anticipationDuration = 160, openingDuration = 560, closingDuration = 360;
  let state = 'idle', lastPointer = '', pointerInside = false, hoverSuppressed = false;
  let phaseTimer, leaveTimer;

  function setState(next) {
    state = next;
    const active = next === 'opening' || next === 'open';
    scene.dataset.state = next;
    scene.classList.toggle('is-active', active);
    scene.setAttribute('aria-pressed', String(active));
    scene.setAttribute('aria-label', active ? '关闭星光彩蛋，回到 XPG 日常状态' : '查看 XPG 星光手柄彩蛋');
  }

  function clearPhase() {
    window.clearTimeout(phaseTimer);
    phaseTimer = undefined;
  }

  function clearLeave() {
    window.clearTimeout(leaveTimer);
    leaveTimer = undefined;
  }

  function startOpening() {
    clearPhase();
    if (motionPreference.matches) { setState('open'); return; }
    setState('opening');
    phaseTimer = window.setTimeout(() => {
      phaseTimer = undefined;
      setState('open');
    }, openingDuration);
  }

  function open(anticipate = false) {
    clearLeave();
    clearPhase();
    if (!anticipate || motionPreference.matches) { startOpening(); return; }
    setState('anticipating');
    phaseTimer = window.setTimeout(startOpening, anticipationDuration);
  }

  function close(immediate = false) {
    clearLeave();
    clearPhase();
    if (immediate || motionPreference.matches || state === 'idle' || state === 'anticipating') {
      setState('idle');
      return;
    }
    setState('closing');
    phaseTimer = window.setTimeout(() => {
      phaseTimer = undefined;
      setState('idle');
    }, closingDuration);
  }

  function reset() {
    close(true);
    // A reset while the pointer rests here must not immediately reopen it.
    hoverSuppressed = pointerInside;
  }

  setState('idle');
  scene.addEventListener('pointerenter', event => {
    lastPointer = event.pointerType;
    if (event.pointerType !== 'mouse') return;
    pointerInside = true;
    clearLeave();
    if (hoverSuppressed || state === 'open' || state === 'opening') return;
    // Re-entry during closing resumes promptly; a fresh visit gets the hint.
    open(state !== 'closing');
  });
  scene.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    pointerInside = false;
    hoverSuppressed = false;
    clearLeave();
    // Do not open a portal after a quick pass over the resting character.
    if (state === 'anticipating') clearPhase();
    leaveTimer = window.setTimeout(() => close(), 80);
  });
  scene.addEventListener('pointerdown', event => { lastPointer = event.pointerType; });
  scene.addEventListener('pointercancel', reset);
  scene.addEventListener('click', event => {
    // Native button activation covers Enter/Space, assistive technology and
    // touch/pen taps. Mouse users discover the portal through hover.
    if (event.detail !== 0 && lastPointer === 'mouse') return;
    if (state === 'opening' || state === 'open') {
      hoverSuppressed = pointerInside;
      close();
    } else {
      open();
    }
  });
  scene.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      hoverSuppressed = pointerInside;
      close();
    }
  });
  scene.addEventListener('blur', reset);
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) reset();
  });

  motionPreference.addEventListener('change', () => {
    const active = state === 'opening' || state === 'open'
      || (state === 'anticipating' && pointerInside && !hoverSuppressed);
    clearLeave();
    clearPhase();
    setState(active ? 'open' : 'idle');
  });
  new MutationObserver(reset).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
})();
