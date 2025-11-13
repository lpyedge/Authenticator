import React, { useState } from 'react';
import { FiLock } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

interface LoginScreenProps {
    onUnlock: (password: string) => Promise<boolean>;
    onSetup: (password: string) => void;
    hasData: boolean;
    error: string | null;
    setError: (error: string | null) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, onSetup, hasData, error, setError }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useI18n();

    const getErrorMessage = (errKey: string) => {
        if (!errKey) return null;
        if(errKey.startsWith('errors.')) return t(errKey);
        return errKey;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (hasData) {
            const success = await onUnlock(password);
            if (!success) {
                setError('errors.incorrect_password');
            }
        } else {
            if (password !== confirmPassword) {
                setError("errors.passwords_do_not_match");
                setIsLoading(false);
                return;
            }
            if (password.length < 8) {
                setError("errors.password_too_short");
                setIsLoading(false);
                return;
            }
            onSetup(password);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col p-4 transition-colors duration-200" style={{ backgroundColor: 'rgb(var(--bg-primary))', color: 'rgb(var(--text-primary))' }}>
            <div className="w-full max-w-md mx-auto flex-grow flex items-center justify-center">
                <div className="w-full">
                    <div className="rounded-2xl shadow-lg p-8 space-y-6 transition-colors duration-200" style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}>
                        <div className="flex flex-col items-center space-y-2">
                            <div className="rounded-full p-3" style={{ backgroundColor: 'rgb(var(--accent))' }}>
                                <FiLock className="h-8 w-8 text-white" />
                            </div>
                            <h1 className="text-2xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{t('login.title')}</h1>
                            <p style={{ color: 'rgb(var(--text-secondary))' }}>{hasData ? t('login.unlock_vault') : t('login.create_password')}</p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('login.master_password_placeholder')}
                                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 transition"
                                style={{ 
                                    backgroundColor: 'rgb(var(--bg-primary))', 
                                    color: 'rgb(var(--text-primary))',
                                    borderColor: 'rgb(var(--border))'
                                }}
                                autoFocus
                            />
                            {!hasData && (
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={t('login.confirm_password_placeholder')}
                                    className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 transition"
                                    style={{ 
                                        backgroundColor: 'rgb(var(--bg-primary))', 
                                        color: 'rgb(var(--text-primary))',
                                        borderColor: 'rgb(var(--border))'
                                    }}
                                />
                            )}

                            {error && <p className="text-sm text-center" style={{ color: 'rgb(var(--error))' }}>{getErrorMessage(error)}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: 'rgb(var(--accent))' }}
                            >
                                {isLoading ? '...' : hasData ? t('login.unlock_button') : t('login.create_vault_button')}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <footer className="w-full flex-shrink-0 py-4 flex justify-center gap-4">
                <LanguageSwitcher />
                <ThemeSwitcher />
            </footer>
        </div>
    );
};

export default LoginScreen;
