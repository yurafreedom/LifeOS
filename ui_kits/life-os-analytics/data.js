/* Adaptive Analytics — seed data. RU copy, as the product ships.
   Every value here is a *fact* or a *stored intent*; deltas are derived at render. */
window.AAData = {
  signals: [
    {
      id: 'sig-project',
      domain: 'редизайн life os',
      kind: 'material',
      title: 'Прогноз сдвинулся',
      from: '24 авг',
      to: '26 авг',
      magnitude: '+2 дня',
      body: 'Прогноз завершения обновлён после аудита дизайна. Это третье изменение за месяц.',
      ts: '2 часа назад',
      prov: { source: 'Выведено Life OS', basis: 'История задач проекта · 41 событие', when: '24 авг, 09:12', how: 'Пересчёт по объёму и скорости за 14 дней' },
      metric: 'project'
    },
    {
      id: 'sig-finance',
      domain: 'финансы · август',
      kind: 'material',
      stakes: true, /* trigger #7: budget at 98% — the only warm signal */
      title: 'Расходы выше текущего ожидания',
      from: '₴62,000',
      to: '₴61,200',
      magnitude: 'осталось 3 дня',
      body: 'Ожидание вы меняли дважды: ₴50,000 → ₴57,000 → ₴62,000. Месяц ещё не закрыт.',
      ts: 'сегодня, 08:40',
      prov: { source: 'Из моих записей + импорт', basis: '184 операции · monobank', when: '28 авг, 08:40', how: 'Сумма расходов за период минус корректировки' },
      metric: 'finance'
    },
    {
      id: 'sig-review',
      domain: 'ревью',
      kind: 'info',
      title: 'Доступно ревью',
      body: 'Вы меняли оценку сроков три раза в этом месяце. Можно посмотреть, что менялось.',
      ts: 'вчера',
      prov: { source: 'Выведено Life OS', basis: '3 версии прогноза', when: '27 авг', how: 'Отслеживание версий ожидания' },
      metric: 'project'
    }
  ],

  finance: {
    label: 'Расходы · август',
    unit: '₴',
    expected: 62000,
    expectedInitial: 50000,
    actual: 61200,
    typical: 54300,
    forecast: 67800,
    coverage: '28 из 31 дня',
    expectations: [
      { when: '1 авг', value: 50000, note: 'Первоначальное ожидание' },
      { when: '10 авг', value: 57000, note: 'Обновлено после ремонта' },
      { when: '20 авг', value: 62000, note: 'Обновлено вручную' }
    ],
    series: [3200, 7400, 11800, 15200, 19900, 24100, 27300, 31500, 36800, 41200, 44900, 48300, 52100, 55400, 58200, 61200],
    events: [
      { at: 9, label: 'корректировка' },
      { at: 12, label: 'ожидание' }
    ],
    history: [
      { when: '28 авг', what: '<b>Операция исправлена</b> · ₴12,000 → ₴1,200', prov: 'Моя правка' },
      { when: '20 авг', what: '<b>Ожидание изменено</b> · ₴57,000 → ₴62,000', prov: 'Моя запись' },
      { when: '17 авг', what: 'Расход записан · ₴4,180 → продукты', prov: 'Импорт' },
      { when: '10 авг', what: '<b>Ожидание изменено</b> · ₴50,000 → ₴57,000', prov: 'Моя запись' },
      { when: '1 авг', what: 'Ожидание на месяц · ₴50,000', prov: 'Моя запись' }
    ]
  },

  project: {
    label: 'Редизайн Life OS · срок',
    started: '12 июл',
    expectedInitial: '20 авг',      /* first recorded forecast, 12 авг */
    expectedInitialWhen: '12 авг',
    expected: '26 авг',             /* last recorded forecast, 20 авг */
    expectedWhen: '20 авг',
    actual: '25 авг',
    typical: 'обычно +3 дня к оценке',
    forecasts: [
      { when: '12 авг', value: '20 авг' },
      { when: '15 авг', value: '24 авг' },
      { when: '20 авг', value: '26 авг' },
      { when: '25 авг', value: '25 авг', actual: true }
    ],
    history: [
      { when: '25 авг', what: '<b>Проект завершён</b> · 25 авг', prov: 'Наблюдение системы' },
      { when: '20 авг', what: '<b>Прогноз изменён</b> · 24 авг → 26 авг', prov: 'Выведено Life OS' },
      { when: '16 авг', what: 'Объём увеличен на 14 задач', prov: 'Наблюдение системы' },
      { when: '15 авг', what: '<b>Прогноз изменён</b> · 20 авг → 24 авг', prov: 'Выведено Life OS' },
      { when: '12 авг', what: 'Первый прогноз · 20 авг', prov: 'Выведено Life OS' }
    ]
  },

  subjective: {
    duration: '8 ч 35 мин',
    energy: 'низкая',
    stress: 7,
    note: 'Слишком много созвонов, к вечеру полностью выгорел.',
    when: '24 авг, 21:40'
  },

  tradeoffs: [
    { label: 'Рабочие часы', value: '+11 ч' },
    { label: 'Свободное время', value: '−9 ч' },
    { label: 'Сон', value: '−11%' },
    { label: 'Энергия', value: 'ниже' }
  ],

  experiments: [
    {
      id: 'exp-sleep',
      title: 'Не работать после 00:30',
      status: 'review',            /* draft · running · review · decided */
      hypothesis: 'Если заканчивать работу до 00:30, длительность сна вырастет.',
      hypothesisWhen: '1 авг · моя запись',
      baseline: { value: '6 ч 18 м', window: '14 дней до старта · 18 июл — 31 июл', prov: { source: 'Из моих записей', basis: '14 наблюдений сна', when: '31 июл', how: 'Среднее по дням с записью' } },
      intervention: 'Закрывать ноутбук до 00:30. Ничего больше не менять.',
      window: '14 дней · 1 авг — 14 авг',
      adherence: { kept: 9, elapsed: 14, total: 14, note: '5 дней правило не соблюдалось' },
      conditions: [
        { text: 'Две поездки в середине периода', kind: 'observed' },
        { text: 'Аллергия с 6 по 9 авг', kind: 'observed' }
      ],
      observations: [
        { label: 'сон · среднее за период', value: '6 ч 42 м', prov: 'из моих записей' },
        { label: 'дней с записью', value: '12 из 14', prov: 'наблюдение системы' },
        { label: 'энергия утром', value: 'чаще «нормально»', prov: 'моя запись' }
      ],
      result: { delta: '+24 м', desire: 'neutral', sub: 'к базовому уровню 6 ч 18 м' },
      decision: null
    },
    {
      id: 'exp-walk',
      title: 'Прогулка 20 минут после обеда',
      status: 'running',
      hypothesis: 'Короткая прогулка снизит вечернюю усталость.',
      hypothesisWhen: '20 авг · моя запись',
      baseline: { value: 'усталость 6.4 / 10', window: '10 дней до старта', prov: { source: 'Из моих записей', basis: '10 вечерних отметок', when: '19 авг', how: 'Среднее по отметкам' } },
      intervention: 'Выходить на 20 минут после обеда.',
      window: '21 день · 20 авг — 9 сен',
      adherence: { kept: 6, elapsed: 9, total: 21, note: 'период не закончен · 12 дней впереди' },
      conditions: [],
      observations: [
        { label: 'усталость · пока', value: '5.9 / 10', prov: 'из моих записей' },
        { label: 'дней пройдено', value: '9 из 21', prov: 'наблюдение системы' }
      ],
      result: null,
      decision: null
    }
  ],

  /* J · simultaneous changes over one window. Unlike units, никогда не складываются. */
  changes: {
    window: '1 авг — 28 авг · 28 дней',
    items: [
      { id: 'c1', domain: 'работа', label: 'Рабочие часы', value: '+11 ч', unit: 'часы · к июлю', coverage: 'полное', prov: { source: 'Выведено Life OS', basis: 'Записи задач · 214 событий', when: '28 авг', how: 'Сумма трекнутого времени по дням' } },
      { id: 'c2', domain: 'задачи', label: 'Задач закрыто', value: '+24%', unit: 'штуки · к июлю', coverage: 'полное', prov: { source: 'Наблюдение системы', basis: '58 задач', when: '28 авг', how: 'Сравнение с предыдущим месяцем' } },
      { id: 'c3', domain: 'сон', label: 'Сон', value: '−11%', unit: 'минуты · к июлю', coverage: 'частичное · 19 из 28 дней', prov: { source: 'Из моих записей', basis: '19 наблюдений', when: '27 авг', how: 'Среднее по дням с записью' } },
      { id: 'c4', domain: 'самочувствие', label: 'Энергия утром', value: 'ниже', unit: 'субъективно · шкала', coverage: 'частичное · 12 отметок', prov: { source: 'Из моих записей', basis: '12 отметок', when: '26 авг', how: 'Категориальная шкала, без усреднения' } },
      { id: 'c5', domain: 'финансы', label: 'Расходы', value: '−₴800', unit: '₴ · к ожиданию', coverage: 'полное · 28 из 31 дня', prov: { source: 'Из моих записей + импорт', basis: '184 операции', when: '28 авг', how: 'Сумма расходов минус корректировки' } },
      { id: 'c6', domain: 'связь', label: 'Часы и сон', value: 'связь не установлена', unit: 'наблюдение', coverage: 'частичное', prov: { source: 'Выведено Life OS', basis: '19 совпадающих дней', when: '28 авг', how: 'Совпадение по дням; причинность не проверялась' } }
    ]
  },

  systemReview: {
    window: 'август',
    changed: [
      { text: '<b>Прогноз срока</b> пересматривался · 20 → 24 → 26 авг; факт 25 авг', prov: 'Выведено Life OS' },
      { text: '<b>Ожидание по расходам</b> менялось дважды · ₴50,000 → ₴57,000 → ₴62,000', prov: 'Моя запись' },
      { text: '<b>Расходы</b> ниже текущего ожидания · −₴800 · цель на месяц не задавалась', prov: 'Из моих записей' },
      { text: '<b>Задач закрыто</b> больше, чем в июле · +24%', prov: 'Наблюдение системы' },
      { text: '<b>Рабочие часы</b> выросли · +11 ч к июлю', prov: 'Выведено Life OS' },
      { text: '<b>Сон</b> короче · −11% к июлю', prov: 'Из моих записей' }
    ],
    /* Desirability must come from an explicit TARGET, user PREFERENCE/ORIENTIR or user
       DECISION that names a desired direction. An EXPECTATION is predictive, not
       normative — being under or over it is not improvement on its own. Numeric
       direction alone is never grounds. Items without such grounding stay in `changed`.
       `basis` names the grounding and is always shown. */
    improved: [
      { text: '<b>Правило сна</b> соблюдалось 9 из 14 дней эксперимента', prov: 'Наблюдение системы', basis: 'по вашему ориентиру: не работать после 00:30' }
    ],
    repeated: [
      { text: 'Три инженерные задачи снова превысили первую оценку', prov: 'Наблюдение системы' },
      { text: 'Оценка сроков корректируется вверх третий месяц подряд', prov: 'Выведено Life OS' }
    ],
    contradictions: [
      { text: '<b>Задач закрыто больше</b>, но <b>сон короче</b> · связь не установлена', prov: 'Выведено Life OS' }
    ],
    pending: { reviews: 2, experiments: '1 закончен · 1 идёт' },
    quality: [
      { text: 'Субъективные отметки: 12 из 28 дней', prov: 'Из моих записей' },
      { text: 'Сон: 19 из 28 дней', prov: 'Из моих записей' },
      { text: 'Финансы: 28 из 31 дня · 1 исправление', prov: 'Импорт' }
    ],
    adjustments: [
      'Записывать сон каждый день — иначе сравнивать нечего',
      'Ставить срок проекта с запасом 3 дня (типично для меня)',
      'Ожидание по расходам задавать один раз в начале месяца'
    ]
  },

  factors: [
    { id: 'f1', text: 'Объём вырос на 14 задач', kind: 'observed' },
    { id: 'f2', text: 'Недооценил сложность', kind: 'mine' },
    { id: 'f3', text: 'Переключение контекста', kind: 'maybe' }
  ]
};
