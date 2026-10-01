# Browser matrix (Chromium via Claude in Chrome, production build + real API on lifeos_test)

Harness: the app loaded in a same-origin `<iframe>` of exact width (the automation window cannot go below
~625 px), theme / scene / font set through the app's own `localStorage` keys before load, UK switched through
Settings → оформление. Measured: `documentElement.scrollWidth - clientWidth`, elements whose right edge exceeds
the viewport, and text nodes with computed font-size < 12 px.

- Settings → Security: 5 widths (1440/1024/768/390/320) × RU/UK × Current/DejaVu × dark/light/paradise-day/
  paradise-night = **80 configurations, 0 overflow, 0 text < 12 px**.
- Home, Finances, Settings → monobank / export + legacy / categories, pet page: 5 widths × RU/UK ×
  dark + paradise-day (DejaVu at 320) = **120 configurations, 0 overflow**.
- Text < 12 px: Home only (20/20 Home configs), all **pre-existing** styles not touched by S1:
  `.stat-context.is-empty` (11 px), `.aa-eyebrow` (9.5 px), `.chart-card-eyebrow` (11 px). They are now visible
  more often because empty states are honest. Not fixed in S1 (no style churn outside the slice).

`browser-matrix.csv` aggregates every configuration per screen and width.
