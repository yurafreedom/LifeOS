

/* global */
/* Profile seed data and size-conversion utility. Loaded as a plain
   global; v2.1+ may move this to /data/profile.js with serialized
   persistence. */

const LifeProfileSeed = {
  identity: {
    name: '',
    age: 25,
    city: '',
    bio: '',
  },
  body: {
    heightCm: 178,
    weightKg: 72.4,
    history: [
      { date: '01.05', weight: 73.4 },
      { date: '08.05', weight: 72.9 },
      { date: '15.05', weight: 72.4 },
    ],
    notes: 'утром натощак.',
  },
  measurements: {
    chest: 96,
    waist: 80,
    hips:  96,
    neck:  38,
    shoulders: 45,
    sleeve: 64,
    inseam: 80,
    shoe:   27.5,
    notes:  '',
  },
  sizes: {
    /* canonical EU value per type. shoes is EU shoe size,
       pants is EU waist cm, others are EU jacket-style numbers. */
    shirt:  48,
    pants:  81,
    jacket: 48,
    shoes:  42,
    suit:   48,
    tshirt: 48,
  },
  food: {
    allergies: [],
    likes:     [],
    dislikes:  [],
    notes:     '',
  },
};

/* ──────────────────────────────────────────────────────────
   Size conversion tables. EU is the source of truth; US +
   regional column auto-derived. Lookup is exact-match on the
   EU column — if the user enters a non-table EU value (e.g.
   shirt 49), we return null and the table shows "—".
   ────────────────────────────────────────────────────────── */
const SHIRT_TABLE = [
  { eu: 44, us: 34, ua: '44 (XS)' },
  { eu: 46, us: 36, ua: '46 (S)'  },
  { eu: 48, us: 38, ua: '48 (M)'  },
  { eu: 50, us: 40, ua: '50 (L)'  },
  { eu: 52, us: 42, ua: '52 (XL)' },
  { eu: 54, us: 44, ua: '54 (XXL)'},
];
const PANTS_TABLE = [
  { eu: 71, us: 'W28' },
  { eu: 76, us: 'W30' },
  { eu: 81, us: 'W32' },
  { eu: 86, us: 'W34' },
  { eu: 91, us: 'W36' },
  { eu: 96, us: 'W38' },
];
const SHOES_TABLE = [
  { eu: 40, us: 7,  uk: 6.5  },
  { eu: 41, us: 8,  uk: 7.5  },
  { eu: 42, us: 9,  uk: 8.5  },
  { eu: 43, us: 10, uk: 9.5  },
  { eu: 44, us: 11, uk: 10.5 },
  { eu: 45, us: 12, uk: 11.5 },
  { eu: 46, us: 13, uk: 12.5 },
];

/* Convert an EU size to {us, alt, altLabel} for the given type.
   altLabel is 'UA' for shirt-family rows and 'UK' for shoes. */
const lifeConvertSize = function lifeConvertSize(type, eu) {
  if (eu == null || eu === '') return { us: '—', alt: '—', altLabel: 'UA' };
  const n = Number(eu);
  if (type === 'shoes') {
    const row = SHOES_TABLE.find(r => r.eu === n);
    return row ? { us: row.us, alt: row.uk, altLabel: 'UK' }
               : { us: '—',    alt: '—',    altLabel: 'UK' };
  }
  if (type === 'pants') {
    const row = PANTS_TABLE.find(r => r.eu === n);
    return row ? { us: row.us, alt: n,    altLabel: 'UA' }
               : { us: '—',    alt: '—',  altLabel: 'UA' };
  }
  /* shirt-family: shirt / jacket / suit / tshirt */
  const row = SHIRT_TABLE.find(r => r.eu === n);
  return row ? { us: row.us, alt: row.ua, altLabel: 'UA' }
             : { us: '—',    alt: '—',    altLabel: 'UA' };
};

export { LifeProfileSeed, lifeConvertSize };
