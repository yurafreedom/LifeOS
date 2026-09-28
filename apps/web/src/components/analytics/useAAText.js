import React from 'react';
import { LifeLocaleContext, LifeMakeT } from '../../context/LocaleContext.jsx';

const RUSSIAN = LifeMakeT('ru');

/** The active locale's `t`, or Russian — the primary locale — when none is provided. */
export function useAAText() {
  const context = React.useContext(LifeLocaleContext);
  return typeof context?.t === 'function' ? context.t : RUSSIAN;
}
