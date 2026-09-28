import React from 'react';

/* Settings row primitive shared by SettingsPage and its extracted sections. */
function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-row-left">
        <div className="set-row-label">{label}</div>
        {hint && <div className="set-row-hint mono">{hint}</div>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

export { Row };
