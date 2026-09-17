import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExportSection } from '../components/SettingsPage.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeMakeT } from '../context/LocaleContext.jsx';

describe('Settings infrastructure export', () => {
  for (const locale of ['ru', 'uk']) {
    it(`retains snapshot export alongside the complete server ZIP in ${locale}`, () => {
      const t = LifeMakeT(locale);
      const html = renderToStaticMarkup(
        <LifeDataContext.Provider value={{ exportJSON: () => '{}' }}>
          <ExportSection t={t} />
        </LifeDataContext.Provider>,
      );
      expect(html).toContain(t('set_export_json'));
      expect(html).toContain(t('set_export_account'));
      expect(html).toContain(t('set_export_account_download'));
      expect(html).toContain(t('set_export_account_hint'));
      expect(html).not.toContain('role="alert"');
    });
  }
});
