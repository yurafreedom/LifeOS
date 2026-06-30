/* data/medications.js
 *
 * Personal medication data for Life OS. All pharmacokinetic values
 * are standard pharmacological estimates from public references;
 * they should be verified by the user's pharmacist or psychiatrist
 * before being used for clinical decisions. This data exists only
 * to power the in-app tracker — Life OS does NOT provide medical
 * advice.
 *
 * CYP2D6 NOTE: bupropion (and its active metabolites) is a moderate-
 * to-strong CYP2D6 inhibitor. Sertraline at ≥150 mg/day is also a
 * moderate CYP2D6 inhibitor. Concurrent use raises exposure of
 * CYP2D6-substrate drugs in this list — see `interactions` field at
 * the bottom.
 *
 * NOTE: The spec hands this off as an ES module (`export const`).
 * Life OS currently loads everything via plain <script> tags + Babel
 * standalone, so we mount the same shapes onto window globals. The
 * structure is unchanged from the spec — Sprint 3 reads from these
 * directly. */

window.LifeMeds = [
  {
    id: "sertraline",
    name_ru: "Сертралин",
    name_ua: "Сертралін",
    brand_common: "Золофт / Zoloft",
    active_en: "Sertraline",
    status: "active",
    strength_mg: 50,
    current_dose_mg_per_day: 150,
    doses_per_day: 1,
    schedule_default: ["morning"],
    half_life_h: 26,
    dose_interval_h: 24,
    cyp2d6_role: "weak_inhibitor",  // dose-dependent ≥150 mg/day
    interaction_flags: ["self_2d6_inhibitor_at_high_dose"],
    inventory_count: 0,  // user fills
    notes_ru: "При дозе 150 мг сам по себе становится умеренным " +
              "ингибитором CYP2D6.",
  },
  {
    id: "bupropion",
    name_ru: "Бупропион",
    name_ua: "Бупропіон",
    brand_common: "Бупринол (UA) / Wellbutrin",
    active_en: "Bupropion",
    status: "active",
    strength_mg: 150,
    current_dose_mg_per_day: 225,
    doses_per_day: 2,
    schedule_default: ["morning", "midday"],
    schedule_notes_ru: "Утром — 150 мг. В обед — 75 мг " +
                       "(половина таблетки 150 мг — производитель " +
                       "не рекомендует ломать, пользователь делает " +
                       "это намеренно).",
    half_life_h: 14,
    half_life_metabolite_h: 24,  // hydroxybupropion, active
    dose_interval_h: 6,  // between morning and midday dose
    cyp2d6_role: "moderate_inhibitor",  // via metabolites
    interaction_flags: ["primary_2d6_inhibitor"],
    inventory_count: 0,
    notes_ru: "Мощный ингибитор CYP2D6 через метаболиты " +
              "(threohydrobupropion, erythrohydrobupropion). " +
              "Повышает экспозицию субстратов CYP2D6 в этом списке.",
  },
  {
    id: "vortioxetine",
    name_ru: "Вортиоксетин",
    name_ua: "Вортіоксетин",
    brand_common: "Бринтелликс / Brintellix / Trintellix",
    active_en: "Vortioxetine",
    status: "active",
    strength_mg: 10,
    current_dose_mg_per_day: 10,
    doses_per_day: 1,
    schedule_default: ["morning"],
    half_life_h: 66,
    dose_interval_h: 24,
    cyp2d6_role: "substrate",
    interaction_flags: ["2d6_substrate"],
    inventory_count: 0,
    notes_ru: "Метаболизируется преимущественно CYP2D6. С " +
              "бупропионом AUC увеличивается в 2.3 раза, Cmax в " +
              "2.1 раза (Springer Clin Pharmacokinet 2017). " +
              "Производитель официально рекомендует снижать дозу " +
              "вдвое при совместном приёме с сильными " +
              "ингибиторами CYP2D6.",
  },
  {
    id: "duloxetine",
    name_ru: "Дулоксетин",
    name_ua: "Дулоксетин",
    brand_common: "Симбалта / Cymbalta",
    active_en: "Duloxetine",
    status: "active",
    strength_mg: 30,
    current_dose_mg_per_day: 30,
    doses_per_day: 1,
    schedule_default: ["morning"],
    half_life_h: 12,
    dose_interval_h: 24,
    cyp2d6_role: "substrate",
    interaction_flags: ["2d6_substrate_partial", "1a2_substrate"],
    inventory_count: 0,
    notes_ru: "Частично метаболизируется CYP2D6 и CYP1A2. " +
              "Теоретически бупропион может повысить уровни, но " +
              "клинически значимый эффект не подтверждён " +
              "(Mental Health Clin 2016).",
  },
  {
    id: "milnacipran",
    name_ru: "Милнаципран",
    name_ua: "Мілнаципран",
    brand_common: "Иксел / Savella",
    active_en: "Milnacipran",
    status: "active",
    strength_mg: 50,
    current_dose_mg_per_day: 50,
    doses_per_day: 1,
    schedule_default: ["morning"],
    half_life_h: 8,
    dose_interval_h: 24,
    cyp2d6_role: "none",
    interaction_flags: [],
    inventory_count: 0,
    notes_ru: "Не метаболизируется через CYP2D6 значимо. " +
              "Минимальный риск взаимодействий с бупропионом.",
  },
  {
    id: "lamotrigine",
    name_ru: "Ламотриджин",
    name_ua: "Ламотриджин",
    brand_common: "Епілептал (UA) / Lamictal",
    active_en: "Lamotrigine",
    status: "active",
    strength_mg: 50,
    current_dose_mg_per_day: 50,
    doses_per_day: 1,
    schedule_default: ["evening"],
    half_life_h: 25,
    dose_interval_h: 24,
    cyp2d6_role: "none",
    interaction_flags: ["ugt_substrate"],
    inventory_count: 0,
    notes_ru: "Метаболизируется через UGT, не через CYP2D6. " +
              "Без значимых взаимодействий с этим списком.",
  },
  {
    id: "atomoxetine",
    name_ru: "Атомоксетин",
    name_ua: "Атомоксетин",
    brand_common: "Страттера / Strattera",
    active_en: "Atomoxetine",
    status: "inactive",  // not currently taken; might return later
    strength_mg: 18,
    current_dose_mg_per_day: 0,
    doses_per_day: 0,
    schedule_default: [],
    schedule_notes_ru: "Раньше принимался 10/18 мг с делением " +
                       "пополам. Сейчас не принимается. " +
                       "Возможен возврат в будущем.",
    half_life_h: 5,  // extensive 2D6 metabolizers; ~24h with 2D6 inhibitor
    half_life_h_with_2d6_inhibitor: 24,
    dose_interval_h: 24,
    cyp2d6_role: "substrate_major",
    interaction_flags: ["2d6_substrate_major", "5x_exposure_with_bupropion"],
    inventory_count: 0,
    notes_ru: "Сильно зависит от CYP2D6 (PubMed 27518170). С " +
              "бупропионом AUC увеличивается в 5.1 раза, t½ " +
              "удлиняется значительно. Если будет возврат — " +
              "потребует пересмотра дозы при сочетании с " +
              "бупропионом или сертралином 150 мг.",
  },
  {
    id: "methylphenidate",
    name_ru: "Метилфенидат",
    name_ua: "Метилфенідат",
    brand_common: "Concerta / Ritalin / Medikinet",
    active_en: "Methylphenidate",
    status: "planned",  // готовится к РДУГ диагностике
    strength_mg: null,
    current_dose_mg_per_day: 0,
    doses_per_day: 0,
    schedule_default: [],
    half_life_h: 3,  // immediate-release; ER varies
    half_life_h_er: 8,
    dose_interval_h: null,
    cyp2d6_role: "none",
    interaction_flags: ["ces1_substrate"],
    inventory_count: 0,
    notes_ru: "Метаболизируется в основном эстеразой CES1, " +
              "практически не зависит от CYP2D6. Бупропион не " +
              "должен значимо влиять на экспозицию. Ожидание " +
              "получения после РДУГ-диагностики.",
  },
  {
    id: "cariprazine",
    name_ru: "Карипразин",
    name_ua: "Каріпразин",
    brand_common: "Vraylar / Reagila",
    active_en: "Cariprazine",
    status: "considering",  // под вопросом, не принимался
    strength_mg: 1.5,
    current_dose_mg_per_day: 0,
    doses_per_day: 0,
    schedule_default: [],
    half_life_h: 48,  // parent compound
    half_life_active_metabolite_h: 360,  // ~15 days (DDCAR)
    dose_interval_h: 24,
    cyp2d6_role: "none",
    interaction_flags: ["3a4_substrate", "extremely_long_half_life"],
    inventory_count: 0,
    notes_ru: "Метаболизируется через CYP3A4, не CYP2D6. " +
              "Активный метаболит didesmethyl-cariprazine имеет " +
              "период полувыведения ~2-3 недели — выход на " +
              "стабильный уровень и вывод из организма занимают " +
              "недели. Решение об началe требует осознанности " +
              "из-за инерции препарата.",
  },
  {
    id: "nac",
    name_ru: "NAC (N-ацетилцистеин)",
    name_ua: "NAC (N-ацетилцистеїн)",
    brand_common: "NAC supplement",
    active_en: "N-Acetylcysteine",
    status: "active",
    strength_mg: 600,
    current_dose_mg_per_day: 1200,
    doses_per_day: 2,  // 2 таблетки по 600 мг
    schedule_default: ["morning", "evening"],
    half_life_h: 6,
    dose_interval_h: 12,
    cyp2d6_role: "none",
    interaction_flags: ["supplement"],
    is_supplement: true,
    inventory_count: 0,
    notes_ru: "БАД, не лекарство. Без значимых взаимодействий с " +
              "психиатрическими препаратами в этом списке.",
  },
  {
    id: "magtein",
    name_ru: "Magtein (Magnesium L-Threonate)",
    name_ua: "Magtein (Магній L-треонат)",
    brand_common: "Magtein / Magnesium L-Threonate",
    active_en: "Magnesium L-Threonate",
    status: "active",
    strength_mg: null,  // dose by capsules, not mg
    current_dose_mg_per_day: null,
    doses_per_day: 3,  // 3 капсулы вечером
    schedule_default: ["evening"],
    schedule_notes_ru: "3 капсулы вечером, одной дозой.",
    half_life_h: null,
    dose_interval_h: 24,
    cyp2d6_role: "none",
    interaction_flags: ["supplement"],
    is_supplement: true,
    inventory_count: 0,
    notes_ru: "БАД для поддержки памяти и обучения. Без " +
              "значимых взаимодействий с препаратами списка.",
  },
];

// Known clinically significant interactions in this user's list.
// Sprint 3 will render these as warning chips on the relevant
// medication cards.
window.LifeMedInteractions = [
  {
    a: "bupropion",
    b: "atomoxetine",
    severity: "major",
    effect_ru: "AUC атомоксетина увеличивается в 5.1× из-за " +
               "ингибирования CYP2D6 бупропионом.",
    clinical_action_ru: "Требует значительного снижения дозы " +
                        "атомоксетина или замены препарата.",
    source: "PubMed 27518170 (Todor et al. 2016)",
  },
  {
    a: "bupropion",
    b: "vortioxetine",
    severity: "moderate",
    effect_ru: "AUC вортиоксетина увеличивается в 2.3×, Cmax в " +
               "2.1×. Adverse events наблюдаются в 3 раза чаще.",
    clinical_action_ru: "Производитель рекомендует снижать дозу " +
                        "вортиоксетина вдвое при сочетании.",
    source: "Springer Clin Pharmacokinet 2017",
  },
  {
    a: "bupropion",
    b: "duloxetine",
    severity: "minor",
    effect_ru: "Теоретическое повышение экспозиции дулоксетина " +
               "через CYP2D6 + CYP1A2.",
    clinical_action_ru: "Клинически значимый эффект не " +
                        "подтверждён. Мониторинг побочных " +
                        "эффектов рекомендован.",
    source: "Mental Health Clin 2016",
  },
  {
    a: "sertraline",
    b: "vortioxetine",
    severity: "minor",
    effect_ru: "Сертралин в дозе 150 мг сам по себе — умеренный " +
               "ингибитор CYP2D6, что может усилить эффект " +
               "бупропиона на вортиоксетин.",
    clinical_action_ru: "Учитывать кумулятивный эффект двух " +
                        "ингибиторов CYP2D6 в схеме.",
    source: "Mental Health Clin 2016",
  },
];

window.LifeMedStatusLabels = {
  active:       { ru: "принимается",    ua: "приймається",    color: "blue"   },
  inactive:     { ru: "приостановлен",  ua: "призупинений",   color: "muted"  },
  planned:      { ru: "ожидается",      ua: "очікується",     color: "orange" },
  considering:  { ru: "под вопросом",   ua: "під питанням",   color: "muted"  },
};
