import React from 'react';
import { useI18n } from '../hooks/useI18n';

const LanguageSwitcher: React.FC = () => {
    const { locale, setLocale } = useI18n();

    return (
        <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="themed-select"
            aria-label="Language selector"
        >
            <option value="en">English</option>
            <option value="zh-TW">繁體中文</option>
            <option value="zh-CN">简体中文</option>
            <option value="de">Deutsch</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="pt">Português</option>
        </select>
    );
};

export default LanguageSwitcher;
