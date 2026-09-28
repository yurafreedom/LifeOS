import React from 'react';

const { useEffect } = React;

/* Paradise capsule click physics (Sprint 3.6 Batch 2.5).
   Delegated pointer listeners — covers capsule buttons inside
   lazily-mounted modals/drawers without per-button wiring.
   pointerdown → .pressing (CSS eases into scale+tilt);
   pointerup/leave/cancel → .releasing (damped wobble keyframe,
   removed on animationend). Paradise-only; under dark/light the
   classes are never added. Under prefers-reduced-motion the CSS
   neutralizes the transform/wobble (press = brightness dip). */
function useParadisePress() {
  useEffect(() => {
    const SEL = '.qa-btn-save, .set-btn-primary, .money-log, .medc-action-take, .btn--stakes, .btn--positive';
    let pressed = null;
    function release() {
      if (!pressed) return;
      const b = pressed;
      pressed = null;
      b.removeEventListener('pointerleave', release);
      if (!b.classList.contains('pressing')) return;
      b.classList.remove('pressing');
      b.classList.add('releasing');
    }
    function down(e) {
      if (document.documentElement.getAttribute('data-theme') !== 'paradise') return;
      const b = e.target.closest ? e.target.closest(SEL) : null;
      if (!b || b.disabled) return;
      pressed = b;
      b.classList.remove('releasing');
      b.classList.add('pressing');
      b.addEventListener('pointerleave', release);
    }
    function onAnimEnd(e) {
      if (e.animationName === 'paradise-btn-wobble') e.target.classList.remove('releasing');
    }
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', release, true);
    window.addEventListener('pointercancel', release, true);
    document.addEventListener('animationend', onAnimEnd, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
      document.removeEventListener('animationend', onAnimEnd, true);
    };
  }, []);
}

export { useParadisePress };
