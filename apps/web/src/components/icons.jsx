import React from 'react';

/* global React */
/* Inline Lucide-style icons. Stroke 1.5, no fill, sharp corners. currentColor.
   Sized by parent — use width/height/font-size or class. */

const __ic = (children) => (props = {}) => {
  const size = props.size || 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
};

const LIcons = {
  /* ── nav / chrome ─────────────────────────────────────── */
  inbox:    __ic(<g><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></g>),
  repeat:   __ic(<g><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></g>),
  calendar: __ic(<g><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></g>),
  target:   __ic(<g><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></g>),
  flag:     __ic(<g><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></g>),
  dollar:   __ic(<g><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></g>),
  search:   __ic(<g><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></g>),
  plus:     __ic(<g><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></g>),
  check:    __ic(<polyline points="20 6 9 17 4 12"/>),
  x:        __ic(<g><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></g>),
  chevDown: __ic(<polyline points="6 9 12 15 18 9"/>),
  command:  __ic(<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/>),
  clock:    __ic(<g><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></g>),
  star:     __ic(<path d="M12 2 L13.8 7.5 L19.5 7.8 L15 11.6 L16.5 17.2 L12 14 L7.5 17.2 L9 11.6 L4.5 7.8 L10.2 7.5 Z"/>),

  /* ── category icons ───────────────────────────────────── */
  shoppingCart:   __ic(<g><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></g>),
  utensils:       __ic(<g><path d="M3 2v7c0 1.1.9 2 2 2h2v11"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/></g>),
  car:            __ic(<g><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></g>),
  zap:            __ic(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>),
  home:           __ic(<g><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></g>),
  wifi:           __ic(<g><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></g>),
  creditCard:     __ic(<g><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></g>),
  pill:           __ic(<g><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></g>),
  shirt:          __ic(<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>),
  film:           __ic(<g><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></g>),
  bookOpen:       __ic(<g><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></g>),
  gift:           __ic(<g><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></g>),
  plane:          __ic(<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>),
  scissors:       __ic(<g><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></g>),
  package:        __ic(<g><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></g>),
  moreHorizontal: __ic(<g><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></g>),
  briefcase:      __ic(<g><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></g>),
  laptop:         __ic(<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>),
  building:       __ic(<g><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></g>),
  trendingUp:     __ic(<g><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></g>),

  /* ── v2 sidebar additions ─────────────────────────────── */
  user:           __ic(<g><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></g>),
  listChecks:     __ic(<g><polyline points="3 8 5 10 9 6"/><polyline points="3 16 5 18 9 14"/><line x1="13" y1="9" x2="21" y2="9"/><line x1="13" y1="17" x2="21" y2="17"/></g>),
  heart:          __ic(<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>),
  paw:            __ic(<g><circle cx="6"  cy="10" r="2"/><circle cx="10" cy="6"  r="2"/><circle cx="14" cy="6"  r="2"/><circle cx="18" cy="10" r="2"/><path d="M8.5 14.5C8 17 6.5 18 6.5 20a2.5 2.5 0 0 0 4.4 1.6 2 2 0 0 1 2.2 0A2.5 2.5 0 0 0 17.5 20c0-2-1.5-3-2-5.5-.4-2-1.7-3-3.5-3s-3.1 1-3.5 3z"/></g>),
  stickyNote:     __ic(<g><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11l5-5V5a2 2 0 0 0-2-2z"/><polyline points="16 21 16 16 21 16"/></g>),
  wallet:         __ic(<g><path d="M20 12V8H6a2 2 0 0 1-2-2V18a2 2 0 0 0 2 2h14v-4"/><path d="M20 12v4h-4a2 2 0 0 1 0-4z"/><path d="M4 6V18"/></g>),
  calendarRange:  __ic(<g><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8"  y1="2" x2="8"  y2="6"/><line x1="3"  y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="22"/></g>),
  coins:          __ic(<g><ellipse cx="8" cy="9"  rx="6" ry="3"/><path d="M2 9v5c0 1.7 2.7 3 6 3s6-1.3 6-3V9"/><ellipse cx="16" cy="15" rx="6" ry="3"/><path d="M10 15v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/></g>),
  chevLeft:       __ic(<polyline points="15 18 9 12 15 6"/>),
  chevRight:      __ic(<polyline points="9 18 15 12 9 6"/>),
  panelLeft:      __ic(<g><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></g>),
  bell:           __ic(<g><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></g>),
  bone:           __ic(<path d="M17.4 6a2.4 2.4 0 0 0-3.4-3.4l-1 1a2.4 2.4 0 0 1-3.4 0l-1-1A2.4 2.4 0 0 0 6 6 2.4 2.4 0 0 0 2.6 9.4l1 1a2.4 2.4 0 0 1 0 3.4l-1 1A2.4 2.4 0 0 0 6 18a2.4 2.4 0 0 0 3.4 3.4l1-1a2.4 2.4 0 0 1 3.4 0l1 1A2.4 2.4 0 0 0 18 18a2.4 2.4 0 0 0 3.4-3.4l-1-1a2.4 2.4 0 0 1 0-3.4l1-1A2.4 2.4 0 0 0 17.4 6z"/>),
  ruler:          __ic(<g><path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="m7.5 12.5 2 2"/><path d="m10.5 9.5 2 2"/><path d="m13.5 6.5 2 2"/><path d="m4.5 15.5 2 2"/></g>),
  scale:          __ic(<g><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></g>),
  utensilsAlt:    __ic(<g><path d="M17 22V11"/><path d="M9 22V13"/><path d="M5 22V2"/><path d="M5 6h4"/><path d="M21 14a4 4 0 0 0-4-4"/></g>),
  syringe:        __ic(<g><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="m19 9-8.5 8.5a1 1 0 0 1-1.5 0L7 16l-3 3 1 1 3-3 1.5 1.5a1 1 0 0 0 1.5 0L19 9z"/><path d="m9 11 4 4"/></g>),
  alertTriangle:  __ic(<g><path d="m10.29 3.86-8.18 14.39A2 2 0 0 0 3.84 21h16.32a2 2 0 0 0 1.74-2.75L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9"  x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></g>),
  edit2:          __ic(<g><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></g>),
  trash:          __ic(<g><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></g>),
  arrowUpRight:   __ic(<g><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></g>),
  flame:          __ic(<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>),

  /* ── Sprint 3B · flexible finance toggle ────────────── */
  eye:            __ic(<g><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></g>),
  eyeOff:         __ic(<g><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></g>),
  filter:         __ic(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>),
};

export { LIcons };
