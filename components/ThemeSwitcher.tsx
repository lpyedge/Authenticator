import React from 'react';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { FiMoon, FiSun, FiMonitor } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';

export const ThemeSwitcher: React.FC = () => {
    const { theme, setTheme } = useTheme();
    const { t } = useI18n();

    const ThemeIcon = {
        light: FiSun,
        dark: FiMoon,
        system: FiMonitor
    }[theme];

    const nextTheme: { [key in Theme]: Theme } = {
        system: 'light',
        light: 'dark',
        dark: 'system'
    };

    const themeTitle = {
        light: t('theme.switch_to_dark'),
        dark: t('theme.switch_to_system'),
        system: t('theme.switch_to_light')
    }[theme];

    return (
        <button
            onClick={() => setTheme(nextTheme[theme])}
            title={themeTitle}
            aria-label={themeTitle}
            className="theme-switcher-button"
        >
            <ThemeIcon className="theme-switcher-icon w-5 h-5" />
        </button>
    );
};