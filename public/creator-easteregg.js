(() => {
  const scene = document.querySelector('#about .creator-scene');
  if (!scene) return;
  let lastPointer = '', leaveTimer;
  function show(active) {
    clearTimeout(leaveTimer);
    scene.classList.toggle('is-active', active);
    scene.setAttribute('aria-pressed', String(active));
    scene.setAttribute('aria-label', active ? '关闭星光彩蛋，回到 XPG 日常状态' : '查看 XPG 星光手柄彩蛋');
  }
  scene.addEventListener('pointerenter', event => {
    lastPointer = event.pointerType;
    if (event.pointerType === 'mouse') show(true);
  });
  scene.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') leaveTimer = setTimeout(() => show(false), 90);
  });
  scene.addEventListener('pointerdown', event => { lastPointer = event.pointerType; });
  scene.addEventListener('pointercancel', () => show(false));
  scene.addEventListener('click', event => {
    if (event.detail === 0 || lastPointer !== 'mouse') show(!scene.classList.contains('is-active'));
  });
  scene.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); show(false); }
  });
  scene.addEventListener('blur', () => show(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) show(false); });
})();
