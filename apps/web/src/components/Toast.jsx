import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useContext: useCtxToast } = React;

function Toast({ toast }) {
  const { t } = useCtxToast(LifeLocaleContext);
  if (!toast) return null;
  return (
    <div className={"toast " + (toast.kind === 'bot' ? "is-bot" : "")}>
      <div className={"toast-av " + (toast.kind === 'bot' ? "is-bot" : "")}>
        {toast.kind === 'bot' ? 'tg' : 'sys'}
      </div>
      <div className="toast-body">
        <div className={"toast-name mono " + (toast.kind === 'bot' ? "is-bot" : "")}>
          {toast.kind === 'bot' ? t('toast_name_bot') : t('toast_name_sys')}
        </div>
        <div className="toast-msg">{toast.msg}</div>
        <div className="toast-ts mono">{toast.ts}</div>
      </div>
    </div>
  );
}

export { Toast };
