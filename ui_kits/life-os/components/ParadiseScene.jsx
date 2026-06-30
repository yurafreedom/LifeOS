/* global React */
/* ════════════════════════════════════════════════════════════════
   ParadiseScene — Sprint 3.6
   Living island scene, ported from the approved reference
   (living-island-v3.html). Mounted ONLY under data-theme="paradise";
   day/night driven by the data-scene attribute on <html> (set by
   useTheme + the anti-flash head script — this component never
   computes time itself, it only reacts to the attribute).

   THREE MANDATORY PERFORMANCE PATTERNS (do not "simplify" away):
   1. OPAQUE DAY FLOOR — .ps-bg-day is always opacity:1 at the bottom
      of the stack; night fades in ABOVE it. Crossfading two layers
      lets the dark page bg bleed through mid-transition → dark
      flashing bands.
   2. SINGLE SEA FILTER LAYER — exactly one displaced (#ps-ripple)
      layer exists. Scene change = fade to 0 (.7s) → swap image →
      fade back (720ms timeout). Two simultaneous filtered layers
      double CPU → tile-band flicker.
   3. STATIC ISLAND PATCH — unfiltered day+night pair masked to the
      small island sits above the sea so displacement never touches
      it ("jelly pixels" otherwise). Native-pixel, cheap.

   Degradation: prefers-reduced-motion → static (no breathe, no sea,
   no glints, no clouds). Viewport <768px → no sea / glint / patch.
   ════════════════════════════════════════════════════════════════ */
(function () {
  const { useState: usePsState, useEffect: usePsEffect, useRef: usePsRef } = React;

  /* Relative to index.html (ui_kits/life-os/) → project /assets/scene/ */
  const PS_IMG_DAY = '../../assets/scene/island-day.jpg';
  const PS_IMG_NIGHT = '../../assets/scene/island-night.jpg';

  const PS_CSS = `
#paradise-scene{position:fixed;inset:0;z-index:0;overflow:hidden;background:#0b1320;pointer-events:none}
.ps-layer{position:absolute;inset:-3%;background-size:cover;background-position:center;
  animation:ps-breathe 50s ease-in-out infinite alternate;transform:translateZ(0)}
@keyframes ps-breathe{from{transform:scale(1.0) translateY(0)}to{transform:scale(1.045) translateY(-1%)}}

/* base: DAY is the permanent floor (always opaque), NIGHT fades in above it */
.ps-bg-day{background-image:url("${PS_IMG_DAY}")}
.ps-bg-night{background-image:url("${PS_IMG_NIGHT}");opacity:0;transition:opacity 1.4s ease;will-change:opacity}
html[data-scene="night"] .ps-bg-night{opacity:1}

/* SEA: a SINGLE displaced layer; JS swaps its image at scene change (fade out -> swap -> fade in) */
#ps-sea{-webkit-mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 43%, #000 88%);
        mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 43%, #000 88%);
  filter:url(#ps-ripple);background-image:url("${PS_IMG_DAY}");
  transition:opacity .7s ease;will-change:opacity}

/* glints */
.ps-glint{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:.4;
  -webkit-mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 45%, #000 90%);
          mask:radial-gradient(ellipse 52% 56% at 50% 52%, transparent 45%, #000 90%)}
html[data-scene="night"] .ps-glint{opacity:.25}
.ps-glint::before{content:"";position:absolute;inset:-20%;
  background:radial-gradient(140px 60px at 25% 35%,rgba(190,230,255,.18),transparent 60%),
            radial-gradient(160px 70px at 72% 62%,rgba(160,215,255,.15),transparent 60%),
            radial-gradient(120px 50px at 50% 82%,rgba(200,235,255,.16),transparent 60%);
  animation:ps-drift1 30s linear infinite}
@keyframes ps-drift1{0%{transform:translate(0,0)}100%{transform:translate(5%,-4%)}}

/* STATIC PATCH over the small island: day floor + night overlay (no filter, cheap) */
.ps-patch{-webkit-mask:radial-gradient(ellipse 18% 22% at 77% 12%, #000 55%, transparent 98%);
              mask:radial-gradient(ellipse 18% 22% at 77% 12%, #000 55%, transparent 98%);
  pointer-events:none}
.ps-patch-day{background-image:url("${PS_IMG_DAY}")}
.ps-patch-night{background-image:url("${PS_IMG_NIGHT}");opacity:0;transition:opacity 1.4s ease;will-change:opacity}
html[data-scene="night"] .ps-patch-night{opacity:1}

/* clouds */
.ps-cloud{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.5),transparent 70%);
  filter:blur(8px);pointer-events:none;opacity:.45;will-change:transform}
.ps-c1{width:340px;height:120px;top:8%;left:-20%;animation:ps-cloud 90s linear infinite}
.ps-c2{width:260px;height:90px;top:18%;left:-30%;animation:ps-cloud 120s linear infinite;animation-delay:-50s;opacity:.35}
@keyframes ps-cloud{from{transform:translateX(0)}to{transform:translateX(160vw)}}
html[data-scene="night"] .ps-cloud{opacity:.16}

/* degradation: reduced motion = static island + day/night crossfade only */
@media (prefers-reduced-motion: reduce){
  .ps-layer{animation:none}
  #ps-sea,.ps-glint,.ps-cloud{display:none}
}
`;

  function ParadiseScene() {
    const [psNarrow, setPsNarrow] = usePsState(() =>
      window.matchMedia && window.matchMedia('(max-width: 767px)').matches);
    const seaRef = usePsRef(null);
    const curNightRef = usePsRef(null);
    const swapTRef = usePsRef(null);

    /* viewport <768px: do not render sea / glint / patch at all */
    usePsEffect(() => {
      if (!window.matchMedia) return;
      const mq = window.matchMedia('(max-width: 767px)');
      const handler = e => setPsNarrow(e.matches);
      mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
      return () => {
        mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
      };
    }, []);

    /* Preload both images so the day↔night swap never pops */
    usePsEffect(() => {
      [PS_IMG_DAY, PS_IMG_NIGHT].forEach(src => { const im = new Image(); im.src = src; });
    }, []);

    /* Single-sea image swap, reacting to data-scene on <html>.
       Pattern from reference: fade out .7s → swap → fade in (720ms). */
    usePsEffect(() => {
      const el = document.documentElement;
      curNightRef.current = null;
      function sync() {
        const night = el.getAttribute('data-scene') === 'night';
        const sea = seaRef.current;
        if (sea) {
          const want = 'url("' + (night ? PS_IMG_NIGHT : PS_IMG_DAY) + '")';
          if (curNightRef.current === null) {
            sea.style.backgroundImage = want; /* first paint: no fade */
          } else if (curNightRef.current !== night) {
            sea.style.opacity = '0';
            clearTimeout(swapTRef.current);
            swapTRef.current = setTimeout(() => {
              if (seaRef.current) {
                seaRef.current.style.backgroundImage = want;
                seaRef.current.style.opacity = '1';
              }
            }, 720);
          }
        }
        curNightRef.current = night;
      }
      sync();
      const mo = new MutationObserver(sync);
      mo.observe(el, { attributes: true, attributeFilter: ['data-scene'] });
      return () => { mo.disconnect(); clearTimeout(swapTRef.current); };
    }, [psNarrow]);

    return (
      <div id="paradise-scene" aria-hidden="true">
        <style>{PS_CSS}</style>
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <filter id="ps-ripple" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="3" result="n">
              <animate attributeName="baseFrequency" dur="20s" values="0.012 0.02;0.016 0.025;0.012 0.02" repeatCount="indefinite"></animate>
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
          </filter>
        </svg>
        <div className="ps-layer ps-bg-day"></div>
        <div className="ps-layer ps-bg-night"></div>
        {!psNarrow && <div className="ps-layer" id="ps-sea" ref={seaRef}></div>}
        {!psNarrow && <div className="ps-glint"></div>}
        {!psNarrow && <div className="ps-layer ps-patch ps-patch-day"></div>}
        {!psNarrow && <div className="ps-layer ps-patch ps-patch-night"></div>}
        <div className="ps-cloud ps-c1"></div>
        <div className="ps-cloud ps-c2"></div>
      </div>
    );
  }

  window.ParadiseScene = ParadiseScene;
})();
