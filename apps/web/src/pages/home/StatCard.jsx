import React from 'react';

/* global React */
const { useContext: useCtxSC } = React;

/* StatCard — one glanceable number, one context line, one mono eyebrow.
   No progress bars, no sub-breakdowns. Clicking navigates to the
   dedicated tab via the onClick passed in by the page.

   Props:
     eyebrow       — mono uppercase top label
     value         — big number (or null when empty)
     valueClass    — extra class to apply to the value (e.g. "is-stakes"
                     for orange, "is-over" for red)
     context       — small line below the number
     emptyContext  — context line when value is null (rendered muted)
     onClick       — navigate callback */
function StatCard({ eyebrow, value, valueClass, context, emptyContext, onClick }) {
  const empty = value == null || value === '' || value === '—';
  return (
    <button className={"stat-card" + (empty ? " is-empty" : "")}
            onClick={onClick}
            type="button">
      <span className="stat-eyebrow mono">{eyebrow}</span>
      <span className={"stat-value mono" + (valueClass ? ' ' + valueClass : '')}>
        {empty ? '—' : value}
      </span>
      <span className={"stat-context" + (empty ? ' is-empty' : '')}>
        {empty ? (emptyContext || '') : context}
      </span>
    </button>
  );
}

export { StatCard };
