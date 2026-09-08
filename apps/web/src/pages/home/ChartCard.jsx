import React from 'react';

/* global React */
/* ChartCard — shared wrapper for both trend + category charts.
   Layout:
     · eyebrow (mono uppercase --text-xs)
     · big total beneath (--text-2xl, mono)
     · optional control row (toggle / filter chip)
     · body fills the remainder
     · optional footer (muted line — partial-data warning etc) */
function ChartCard({ eyebrow, total, controls, children, footer, variant }) {
  return (
    <div className={"chart-card" + (variant ? ' is-' + variant : '')}>
      <div className="chart-card-head">
        <div className="chart-card-eyebrow mono">{eyebrow}</div>
        {total != null && <div className="chart-card-total mono">{total}</div>}
      </div>
      {controls && <div className="chart-card-controls">{controls}</div>}
      <div className="chart-card-body">{children}</div>
      {footer && <div className="chart-card-footer mono">{footer}</div>}
    </div>
  );
}

export { ChartCard };
