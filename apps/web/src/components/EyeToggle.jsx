import React from 'react';
import { LIcons } from './icons.jsx';

/* global React */
/* Sprint 3B · shared eye toggle.
   Two states (included / excluded). 150ms fade between glyphs.
   Used in:
     · /finances transaction rows
     · Settings → категории grid
*/

function EyeToggle({ included, onToggle, size, title, ariaLabel }) {
  const I = LIcons;
  const px = size || 14;
  const Icon = included ? I.eye : I.eyeOff;
  return (
    <button
      type="button"
      className={"eye-tog" + (included ? " is-on" : " is-off")}
      onClick={(e) => { e.stopPropagation(); onToggle && onToggle(); }}
      title={title || ''}
      aria-label={ariaLabel || title || ''}
      aria-pressed={!included}>
      {Icon ? <Icon size={px} /> : null}
    </button>
  );
}

export { EyeToggle };
