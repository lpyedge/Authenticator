import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_LOCALE, getInitialLocale } from '../i18n/config';

type I18nContextType = {
    locale: string;
    setLocale: (locale: string) => void;
    t: (key: string, options?: { [key: string]: string | number | undefined | null }) => string;
};

export const I18nContext = createContext<I18nContextType | undefined>(undefined);
type TranslationTree = Record<string, unknown>;

const localeModules = import.meta.glob('../i18n/locales/*.json', {
    eager: true,
    import: 'default',
}) as Record<string, TranslationTree>;

const loadTranslations = (locale: string): TranslationTree => {
    const moduleKey = `../i18n/locales/${locale}.json`;
    const fallbackKey = `../i18n/locales/${DEFAULT_LOCALE}.json`;
    return localeModules[moduleKey] ?? localeModules[fallbackKey] ?? {};
};

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initialLocale = getInitialLocale();
    const [locale, setLocaleState] = useState(initialLocale);
    const [translations, setTranslations] = useState<TranslationTree>(() => loadTranslations(initialLocale));

    useEffect(() => {
        setTranslations(loadTranslations(locale));
        document.documentElement.lang = locale;
        localStorage.setItem('locale', locale);
    }, [locale]);

    const setLocale = (newLocale: string) => {
        setLocaleState(newLocale);
    };

    const t = useCallback((key: string, options?: { [key: string]: string | number | undefined | null }): string => {
        let value = getNestedValue(translations, key) as string | undefined;

        if (value === undefined) {
            return key;
        }

        if (options) {
            Object.keys(options).forEach(optionKey => {
                const replacement = options[optionKey];
                const regex = new RegExp(`{{${optionKey}}}`, 'g');
                // Use an empty string for null or undefined replacements.
                value = value!.replace(regex, replacement != null ? String(replacement) : '');
            });
        }

        return value || key;
    }, [translations]);

    const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};
