
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

    createRiveInstance(canvas);

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
        if (changed) {
          console.log('[Rive Buddy] Recreating instance...');
          try {
            r.cleanup();
          } catch (e) {
            console.warn('[Rive Buddy] cleanup failed:', e);
          }
          instances.delete(canvas);
          createRiveInstance(canvas);
        } else {
          try { r.play(); } catch (e) {}
        }
      } else {
        try { r.pause(); } catch (e) {}
      }
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    initAll();

    // [R12] The observer used to re-scan the whole document on every DOM
    // mutation. Only react to actually added nodes now.
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;
          if (node.matches('canvas.buddy-rive')) {
            initRiveCanvas(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('canvas.buddy-rive').forEach(initRiveCanvas);
          }
        }
      }
    });
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