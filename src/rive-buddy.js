// =========================================
// src/rive-buddy.js
// Loads Rive mascot on any <canvas class="buddy-rive">
// Attaches click → fire "wave" trigger
// =========================================

(function () {
  if (typeof rive === 'undefined') {
    console.warn('[Rive Buddy] rive runtime not loaded');
    return;
  }

  const instances = new WeakMap();

  function initRiveCanvas(canvas) {
    if (!canvas || instances.has(canvas)) return;

    const r = new rive.Rive({
      src: 'assets/buddy.riv',
      canvas: canvas,
      autoplay: true,
      stateMachines: 'Buddy Animation',
      layout: new rive.Layout({
        fit: rive.Fit.Contain,
        alignment: rive.Alignment.Center
      }),
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas();
        instances.set(canvas, r);
        console.log('[Rive Buddy] Loaded on', canvas.id || canvas.className);
      },
      onLoadError: (err) => {
        console.error('[Rive Buddy] Load failed:', err);
      }
    });

    // Click → wave
    canvas.addEventListener('click', () => {
      const inputs = r.stateMachineInputs('Buddy Animation');
      if (!inputs) return;
      const waveInput = inputs.find(i => i.name === 'wave');
      if (waveInput) {
        waveInput.fire();
        console.log('[Rive Buddy] Wave fired');
      }
    });
  }

  function initAll(root = document) {
    root.querySelectorAll('canvas.buddy-rive').forEach(initRiveCanvas);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initAll();

    // Auto-bind whenever new canvas injected (view switch)
    const observer = new MutationObserver(() => initAll());
    observer.observe(document.body, { childList: true, subtree: true });
  });

  // Resize on window change
  window.addEventListener('resize', () => {
    document.querySelectorAll('canvas.buddy-rive').forEach(c => {
      const r = instances.get(c);
      if (r) r.resizeDrawingSurfaceToCanvas();
    });
  });

  // Expose for external use
  window.initRiveBuddies = initAll;
})();