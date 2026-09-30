import React from 'react';

/* JENKIN brand marks — the owner-approved 01 Editorial direction.
 *
 * Geometry is copied verbatim from the outlined reference SVGs in
 * design-references/jenkin-branding/logo/ (01-editorial-currentcolor.svg and
 * the serif J of jenkin-icon.svg), so no web font is needed at runtime and the
 * marks do not change when the interface font preference changes. Ink is
 * currentColor; each surface sets `color` per theme in CSS. The viewBoxes are
 * cropped to the glyph bounds (the reference canvases are 720 × 160 and
 * 160 × 160).
 *
 * Both marks are decorative: the enclosing control supplies the accessible
 * name ("JENKIN"), so the SVG is aria-hidden and never announced twice.
 * Latin Modern outlines: B. Jackowski and J. M. Nowacki, GUST Font License —
 * see design-references/jenkin-branding/logo/FONT-NOTICES.txt.
 */

const EDITORIAL_GLYPH_ORIGIN = 'translate(63.747 134.391) scale(0.163090 -0.163090)';

/* [advance offset in font units, outline] for J E N K I N. */
const EDITORIAL_GLYPHS = [
  [0, "M419 657V683L321 681C279 681 233 681 191 683V657H215C293 657 295 646 295 610V147C295 55 245 0 194 0C168 0 108 12 82 73C86 72 91 71 95 71C114 71 138 84 138 114C138 138 121 156 96 156C72 156 53 141 53 112C53 45 114 -16 196 -16C274 -16 346 40 358 124C359 131 359 133 359 167V587C359 604 359 632 361 638C365 657 388 657 419 657Z"],
  [491, "M607 253H589C567 106 554 26 378 26H239C199 26 197 31 197 65V341H291C385 341 394 307 394 224H412V484H394C394 401 385 367 291 367H197V616C197 650 199 655 239 655H376C531 655 549 593 563 460H581L557 681H51V655C120 655 131 655 131 610V71C131 26 120 26 51 26V0H571Z"],
  [1139, "M641 657V683C618 681 576 681 551 681C526 681 484 681 461 683V657C541 657 541 610 541 585V122L205 671C198 682 197 683 178 683H51V657H70C110 657 128 652 131 651V98C131 73 131 26 51 26V0C74 2 116 2 141 2C166 2 208 2 231 0V26C151 26 151 73 151 98V637C158 631 158 629 165 619L536 12C543 0 546 0 551 0C561 0 561 3 561 22V585C561 610 561 657 641 657Z"],
  [1852, "M685 0V26C637 26 622 32 592 78L369 419L542 592C578 627 616 655 672 657V683L607 681C580 681 533 681 507 683V657C533 655 537 637 537 630C537 623 533 612 529 606L197 273V612C197 657 208 657 277 657V683C248 681 195 681 164 681C133 681 80 681 51 683V657C120 657 131 657 131 612V71C131 26 120 26 51 26V0C80 2 133 2 164 2C195 2 248 2 277 0V26C208 26 197 26 197 71V248L325 375L514 85C520 75 527 62 527 52C527 26 499 26 486 26V0C518 2 564 2 597 2C621 2 662 2 685 0Z"],
  [2591, "M281 0V26C209 26 197 26 197 71V612C197 657 209 657 281 657V683C249 681 198 681 164 681C130 681 79 681 47 683V657C119 657 131 657 131 612V71C131 26 119 26 47 26V0C79 2 130 2 164 2C198 2 249 2 281 0Z"],
  [2939, "M641 657V683C618 681 576 681 551 681C526 681 484 681 461 683V657C541 657 541 610 541 585V122L205 671C198 682 197 683 178 683H51V657H70C110 657 128 652 131 651V98C131 73 131 26 51 26V0C74 2 116 2 141 2C166 2 208 2 231 0V26C151 26 151 73 151 98V637C158 631 158 629 165 619L536 12C543 0 546 0 551 0C561 0 561 3 561 22V585C561 610 561 657 641 657Z"],
];

const J_OUTLINE = EDITORIAL_GLYPHS[0][1];

function JenkinWordmark({ className = '' }) {
  return (
    <svg className={'jenkin-wordmark' + (className ? ' ' + className : '')}
         viewBox="70 21 580 118" fill="currentColor"
         aria-hidden="true" focusable="false">
      <g transform={EDITORIAL_GLYPH_ORIGIN}>
        {EDITORIAL_GLYPHS.map(([x, d]) => <path key={x} transform={`translate(${x} 0)`} d={d} />)}
      </g>
    </svg>
  );
}

/* Serif J with the amber point — the compact mark for the collapsed sidebar,
   matching the favicon. The point is enlarged from r=5 so it stays visible
   at sidebar size. */
function JenkinMark({ className = '' }) {
  return (
    <svg className={'jenkin-mark' + (className ? ' ' + className : '')}
         viewBox="40 18 96 124" fill="currentColor"
         aria-hidden="true" focusable="false">
      <g transform="translate(41.511 134.391) scale(0.163090 -0.163090)">
        <path d={J_OUTLINE} />
      </g>
      <circle className="jenkin-mark-point" cx="123" cy="122" r="7" />
    </svg>
  );
}

export { JenkinWordmark, JenkinMark, EDITORIAL_GLYPHS };
