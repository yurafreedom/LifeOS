

/* global React */
/* Life OS category seed data.
   Each entry: { id, kind, icon (LIcons key), tint, name: { ru, uk } }.

   v0.3.1 — TINT RULE CORRECTED.
   Stakes is NOT a property of a category. Stakes is a property of an
   EVENT (budget at 80%+, milestone hit, one-off purchase above threshold,
   irreversible action). Tinting whole expense categories orange just
   pollutes the signal.

   Tints:
     - 'neutral' — ALL expense categories, no exceptions
                   (rent / utilities / health / education / travel
                    are recurring, however large — they're routine,
                    not stakes-as-moments)
     - 'income'  — green, all income categories
*/

const LIFE_CATEGORIES = [
  /* ── EXPENSES — all neutral ───────────────────────────────── */
  { id: 'groceries',     kind: 'expense', icon: 'shoppingCart',   tint: 'neutral', name: { ru: 'продукты',           uk: 'продукти' } },
  { id: 'restaurants',   kind: 'expense', icon: 'utensils',       tint: 'neutral', name: { ru: 'рестораны, кафе',    uk: 'ресторани, кафе' } },
  { id: 'transport',     kind: 'expense', icon: 'car',            tint: 'neutral', name: { ru: 'транспорт',          uk: 'транспорт' } },
  { id: 'utilities',     kind: 'expense', icon: 'zap',            tint: 'neutral', name: { ru: 'коммуналка',         uk: 'комуналка' } },
  { id: 'rent',          kind: 'expense', icon: 'home',           tint: 'neutral', name: { ru: 'аренда, ипотека',    uk: 'оренда, іпотека' } },
  { id: 'connectivity',  kind: 'expense', icon: 'wifi',           tint: 'neutral', name: { ru: 'связь и интернет',   uk: "зв'язок та інтернет" } },
  { id: 'subscriptions', kind: 'expense', icon: 'creditCard',     tint: 'neutral', name: { ru: 'подписки, софт',     uk: 'підписки, софт' } },
  { id: 'health',        kind: 'expense', icon: 'pill',           tint: 'neutral', name: { ru: 'здоровье, аптека',   uk: "здоров'я, аптека" } },
  { id: 'clothing',      kind: 'expense', icon: 'shirt',          tint: 'neutral', name: { ru: 'одежда',             uk: 'одяг' } },
  { id: 'entertainment', kind: 'expense', icon: 'film',           tint: 'neutral', name: { ru: 'развлечения',        uk: 'розваги' } },
  { id: 'education',     kind: 'expense', icon: 'bookOpen',       tint: 'neutral', name: { ru: 'образование, курсы', uk: 'освіта, курси' } },
  { id: 'gifts_out',     kind: 'expense', icon: 'gift',           tint: 'neutral', name: { ru: 'подарки',            uk: 'подарунки' } },
  { id: 'travel',        kind: 'expense', icon: 'plane',          tint: 'neutral', name: { ru: 'путешествия',        uk: 'подорожі' } },
  { id: 'care',          kind: 'expense', icon: 'scissors',       tint: 'neutral', name: { ru: 'красота, уход',      uk: 'краса, догляд' } },
  { id: 'household',     kind: 'expense', icon: 'package',        tint: 'neutral', name: { ru: 'дом, быт',           uk: 'дім, побут' } },
  { id: 'other_out',     kind: 'expense', icon: 'moreHorizontal', tint: 'neutral', name: { ru: 'другое',             uk: 'інше' } },

  /* ── INCOME — all green ───────────────────────────────────── */
  { id: 'salary',        kind: 'income',  icon: 'briefcase',      tint: 'income',  name: { ru: 'зарплата',           uk: 'зарплата' } },
  { id: 'freelance',     kind: 'income',  icon: 'laptop',         tint: 'income',  name: { ru: 'фриланс, контракты', uk: 'фріланс, контракти' } },
  { id: 'cortexmd',      kind: 'income',  icon: 'building',       tint: 'income',  name: { ru: 'CortexMD выручка',   uk: 'CortexMD виручка' } },
  { id: 'investments',   kind: 'income',  icon: 'trendingUp',     tint: 'income',  name: { ru: 'инвестиции, дивиденды', uk: 'інвестиції, дивіденди' } },
  { id: 'gifts_in',      kind: 'income',  icon: 'gift',           tint: 'income',  name: { ru: 'подарки (входящие)', uk: 'подарунки (вхідні)' } },
  { id: 'other_in',      kind: 'income',  icon: 'moreHorizontal', tint: 'income',  name: { ru: 'другое',             uk: 'інше' } },
];

const CAT_TINT_CLASS = {
  income:  'cat-tint-income',
  neutral: 'cat-tint-neutral',
};

const LifeCategories = LIFE_CATEGORIES;
const LifeCatTintClass = CAT_TINT_CLASS;
const LifeExpenseCats = LIFE_CATEGORIES.filter(c => c.kind === 'expense');
const LifeIncomeCats = LIFE_CATEGORIES.filter(c => c.kind === 'income');

export { LifeCategories, LifeCatTintClass, LifeExpenseCats, LifeIncomeCats };
