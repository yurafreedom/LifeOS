

/* global */
/* Dog seed data. Placeholders deliberate — user fills in real values
   when the dog is bought. The vet visit dates follow standard Maltipoo F1
   puppy vaccination schedule (DHP → DHPP → DHPP+rabies → yearly boosters);
   user should verify with their actual vet upon purchase. */

const LifeDogSeed = {
  profile: {
    name:   '',                  // user names the dog post-purchase
    breed:  { ru: 'мальтипу F1', uk: 'мальтіпу F1' },
    breedEn: 'Maltipoo F1',
    birth:  '',                  // empty until known
    weight: '',                  // empty until first vet visit
  },
  feeding: {
    meals: [
      { id: 'm1', time: '08:00', portion: '' },
      { id: 'm2', time: '14:00', portion: '' },
      { id: 'm3', time: '20:00', portion: '' },
    ],
  },
  inventory: {
    food:    { remainingG: 0, totalG: 0, daysPerKg: 0 },
    treats:  null,
    hygiene: null,
  },
  vet: {
    last: { date: '06.10.2025', note_ru: 'профилактический осмотр, чип, первая вакцинация.', note_uk: 'профілактичний огляд, чип, перша вакцинація.' },
    next: { date: '12.12.2025', note_ru: 'ревакцинация DHPPi+L.', note_uk: 'ревакцинація DHPPi+L.' },
    /* TODO: verify schedule with actual vet upon purchase. Standard
       Maltipoo F1 puppy plan per public veterinary references:
         6–8 wk : DHP (first)
         10–12wk: DHPP
         14–16wk: DHPP + rabies
         yearly : boosters */
  },
  reminders: {
    /* mock countdowns — Sprint 3 wires these to real timers */
    nextFeedIn:  '2ч 14м',
    nextWalkIn:  '45м',
  },
  tasks: [],
  expenses: { thisMonth: 0, byCategory: {} },
};

export { LifeDogSeed };
