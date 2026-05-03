import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';

export type Locale = 'id' | 'en';

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'id',
      setLocale: (locale) => {
        void i18n.changeLanguage(locale);
        set({ locale });
      },
    }),
    {
      name: 'po:locale',
      onRehydrateStorage: () => (state) => {
        if (state?.locale) {
          void i18n.changeLanguage(state.locale);
        }
      },
    },
  ),
);
