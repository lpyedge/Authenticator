export const SUPPORTED_LOCALES: { [key: string]: string } = {
    'en': 'English',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'de': 'Deutsch',
    'ja': '日本語',
    'ko': '한국어',
    'es': 'Español',
    'fr': 'Français',
    'pt': 'Português',
};

export const DEFAULT_LOCALE = 'en';

export const getInitialLocale = (): string => {
    const savedLocale = localStorage.getItem('locale');
    if (savedLocale && SUPPORTED_LOCALES[savedLocale]) {
        return savedLocale;
    }

    const browserLang = navigator.language;
    if (SUPPORTED_LOCALES[browserLang]) {
        return browserLang;
    }
    if (SUPPORTED_LOCALES[browserLang.split('-')[0]]) {
        return browserLang.split('-')[0];
    }
    
    return DEFAULT_LOCALE;
};
