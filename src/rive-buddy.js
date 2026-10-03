// =========================================
// src/rive-buddy.js
// Loads Rive mascot on any <canvas class="buddy-rive">
// Exposes window.setBuddyAnimation(enabled) to pause/play/recreate
// =========================================

(function () {
  if (typeof rive === 'undefined') {
    console.warn('[Rive Buddy] rive runtime not loaded');
    return;
  }

  const instances = new WeakMap();
  let animationEnabled = true;

  function createRiveInstance(canvas) {
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
        console.log('[Rive Buddy] Loaded on', canvas.id || canvas.className);

        // If animations disabled, pause immediately
        if (!animationEnabled) {
          try { r.pause(); } catch (e) {}
        }
      },
      onLoadError: (err) => {
        console.error('[Rive Buddy] Load failed:', err);
      }
    });

    instances.set(canvas, r);
    return r;
  }

  function initRiveCanvas(canvas) {
    if (!canvas || instances.has(canvas)) return;

    // Create instance
    createRiveInstance(canvas);

    // Bind click (once per canvas)
    if (!canvas.dataset.buddyClickBound) {
      canvas.dataset.buddyClickBound = 'true';

      canvas.addEventListener('click', () => {
        console.log('[Rive Buddy] Click. Enabled =', animationEnabled);
        if (!animationEnabled) return;

        const r = instances.get(canvas);
        if (!r) return;

        try {
          const inputs = r.stateMachineInputs('Buddy Animation');
          if (!inputs) {
            console.warn('[Rive Buddy] No state machine inputs');
            return;
          }
          const waveInput = inputs.find(i => i.name === 'wave');
          if (waveInput) {
            waveInput.fire();
            console.log('[Rive Buddy] Wave fired');
          } else {
            console.warn('[Rive Buddy] No "wave" input. Available:', inputs.map(i => i.name));
          }
        } catch (err) {
          console.error('[Rive Buddy] Click error:', err);
        }
      });
    }
  }

  function initAll(root = document) {
    root.querySelectorAll('canvas.buddy-rive').forEach(initRiveCanvas);
  }

  // =========================================
  // PUBLIC: Enable / disable mascot animation
  // =========================================
  window.setBuddyAnimation = function (enabled) {
    const newState = !!enabled;
    const changed = newState !== animationEnabled;
    animationEnabled = newState;

    console.log('[Rive Buddy] setBuddyAnimation →', animationEnabled, '| changed:', changed);

    document.querySelectorAll('canvas.buddy-rive').forEach(canvas => {
      const r = instances.get(canvas);

      if (!r) {
        console.log('[Rive Buddy] No instance yet for canvas');
        return;
      }

      if (animationEnabled) {
        // ── ENABLE ──
        if (changed) {
          // Recreate instance for fresh state machine
          console.log('[Rive Buddy] Recreating instance...');
          try {
            r.cleanup();
          } catch (e) {
            console.warn('[Rive Buddy] cleanup failed:', e);
          }
          instances.delete(canvas);
          createRiveInstance(canvas);
        } else {
          // No change, just try play
          try { r.play(); } catch (e) {}
        }
      } else {
        // ── DISABLE ──
        try { r.pause(); } catch (e) {}
      }
    });
  };

  // =========================================
  // Bootstrap
  // =========================================
  document.addEventListener('DOMContentLoaded', () => {
    initAll();

    const observer = new MutationObserver(() => initAll());
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.addEventListener('resize', () => {
    document.querySelectorAll('canvas.buddy-rive').forEach(c => {
      const r = instances.get(c);
      if (r) r.resizeDrawingSurfaceToCanvas();
    });
  });

  window.initRiveBuddies = initAll;
})();