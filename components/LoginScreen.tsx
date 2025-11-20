import React, { useState, useEffect } from 'react';
import { FiLock } from 'react-icons/fi';
import { MdFingerprint } from 'react-icons/md';
import { useI18n } from '../hooks/useI18n';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { webAuthnService } from '../services/webAuthnService';

interface LoginScreenProps {
    onUnlock: (password: string) => Promise<boolean>;
    onSetup: (password: string) => void;
    onReset?: () => void;
    hasData: boolean;
    error: string | null;
    setError: (error: string | null) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, onSetup, onReset, hasData, error, setError }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState(false);
    const [enableBiometrics, setEnableBiometrics] = useState(false);
    const { t } = useI18n();

    useEffect(() => {
        webAuthnService.isAvailable().then(setIsWebAuthnAvailable);
    }, []);

    useEffect(() => {
        if (hasData && isWebAuthnAvailable) {
            // Check if biometrics was previously enabled (simple check for now)
            const bioSecret = localStorage.getItem('biometric_secret');
            if (bioSecret) {
                handleBiometricUnlock();
            }
        }
    }, [hasData, isWebAuthnAvailable]);

    const handleBiometricUnlock = async () => {
        setIsLoading(true);
        const success = await webAuthnService.authenticate();
        if (success) {
            const bioSecret = localStorage.getItem('biometric_secret');
            if (bioSecret) {
                // In a real app, we would decrypt this secret using a key from WebAuthn PRF
                // Here we just use the stored (obfuscated) password
                try {
                    const decodedPass = atob(bioSecret);
                    const unlockSuccess = await onUnlock(decodedPass);
                    if (!unlockSuccess) {
                        setError('errors.incorrect_password');
                    }
                } catch (e) {
                    setError('errors.incorrect_password');
                }
            }
        }
        setIsLoading(false);
    };

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
            
            if (enableBiometrics && isWebAuthnAvailable) {
                const success = await webAuthnService.register();
                if (success) {
                    // Store obfuscated password
                    localStorage.setItem('biometric_secret', btoa(password));
                } else {
                    // Failed to register biometrics, but we can still proceed with password setup
                    // Maybe warn user?
                }
            }
            
            onSetup(password);
        }
        setIsLoading(false);
    };

    // Removed handleReset as requested

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
                                <>
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
                                    {isWebAuthnAvailable && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="enableBiometrics"
                                                checked={enableBiometrics}
                                                onChange={(e) => setEnableBiometrics(e.target.checked)}
                                                className="rounded border-gray-300 text-accent-color focus:ring-accent-color"
                                            />
                                            <label htmlFor="enableBiometrics" className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                                                {t('login.enable_biometrics') || 'Enable Biometrics / System Auth'}
                                            </label>
                                        </div>
                                    )}
                                </>
                            )}

                            {error && <p className="text-sm text-center" style={{ color: 'rgb(var(--error))' }}>{getErrorMessage(error)}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: 'rgb(var(--accent))' }}
                            >
                                {isLoading ? t('common.loading') : (hasData ? t('login.unlock_button') : t('login.create_vault_button'))}
                            </button>

                            {hasData && isWebAuthnAvailable && (
                                <button
                                    type="button"
                                    onClick={handleBiometricUnlock}
                                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors hover:bg-opacity-10"
                                    style={{ 
                                        borderColor: 'rgb(var(--accent))',
                                        color: 'rgb(var(--accent))'
                                    }}
                                >
                                    <MdFingerprint />
                                    {t('login.use_biometrics') || 'Use System Auth'}
                                </button>
                            )}
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
