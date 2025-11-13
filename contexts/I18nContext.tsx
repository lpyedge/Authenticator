import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getInitialLocale } from '../i18n/config';

type I18nContextType = {
    locale: string;
    setLocale: (locale: string) => void;
    t: (key: string, options?: { [key: string]: string | number | undefined | null }) => string;
};

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

const fetchTranslations = async (locale: string) => {
    try {
        const response = await fetch(`/i18n/locales/${locale}.json`);
        if (!response.ok) {
            console.error(`Could not load ${locale} translations, falling back to English.`);
            const fallbackResponse = await fetch('/i18n/locales/en.json');
            return fallbackResponse.json();
        }
        return response.json();
    } catch (error) {
        console.error('Error fetching translations:', error);
        const fallbackResponse = await fetch('/i18n/locales/en.json');
        return fallbackResponse.json();
    }
};

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [locale, setLocaleState] = useState(getInitialLocale());
    const [translations, setTranslations] = useState({});

    useEffect(() => {
        fetchTranslations(locale).then(setTranslations);
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
