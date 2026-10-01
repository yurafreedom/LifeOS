/* The initial operational snapshot (state.version 2) for a new account.

   JENKIN S1 · honest production state: a new account starts EMPTY. No
   fabricated medications, dose logs, pharmacist notes, transactions, body
   measurements, pet profile, goals, habits or private notes. Demo content lives
   only in the explicit fixture `demoState.js` (tests / design review).
   Pure and React-free; LifeDataContext.jsx re-exports buildInitialState. */

/* Blank profile structure: every field the Profile cards edit, with no value.
   Unknown is null / empty — never a plausible-looking default. */
function buildEmptyProfile() {
  return {
    identity: { name: '', age: null, city: '', bio: '' },
    body: { heightCm: null, weightKg: null, history: [], notes: '' },
    measurements: {
      chest: null, waist: null, hips: null, neck: null, shoulders: null,
      sleeve: null, inseam: null, shoe: null, notes: '',
    },
    sizes: { shirt: null, pants: null, jacket: null, shoes: null, suit: null, tshirt: null },
    food: { allergies: [], likes: [], dislikes: [], notes: '' },
  };
}

function buildInitialState() {
  return {
    version: 2,
    profile: buildEmptyProfile(),
    dog: {},
    medications: [],
    doseLogs: {},
    pharmNotes: {},
    modeStyles: {},
    tasks: [],
    transactions: [],
    categoryOverrides: {},
    projects: [],
    goals: [],
    habits: [],
    quickNotes: [],
    waitingItems: [],
    references: [],
    activityLog: [],
  };
}

export { buildEmptyProfile, buildInitialState };
