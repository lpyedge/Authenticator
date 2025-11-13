import React, { useState, useEffect, useCallback } from 'react';
import { Account } from './types';
import LoginScreen from './components/LoginScreen';
import MainScreen from './components/MainScreen';
import { storageService } from './services/storageService';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
    const [isLocked, setIsLocked] = useState<boolean>(true);
    const [masterPassword, setMasterPassword] = useState<string>('');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [hasData, setHasData] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setHasData(storageService.hasData());
    }, []);

    const handleUnlock = useCallback(async (password: string): Promise<boolean> => {
        try {
            const decryptedAccounts = await storageService.loadAndDecrypt(password);
            setAccounts(decryptedAccounts);
            setMasterPassword(password);
            setIsLocked(false);
            setError(null);
            return true;
        } catch (e) {
            console.error(e);
            setError('Incorrect password or corrupted data.');
            return false;
        }
    }, []);
    
    const handleSetup = useCallback(async (password: string) => {
        await storageService.encryptAndSave([], password);
        setMasterPassword(password);
        setAccounts([]);
        setIsLocked(false);
        setHasData(true);
        setError(null);
    }, []);
    
    const handleLock = useCallback(() => {
        setIsLocked(true);
        setMasterPassword('');
        setAccounts([]);
    }, []);

    const updateAccounts = useCallback(async (updatedAccounts: Account[]) => {
        if (!masterPassword) {
            console.error("Master password not set. Cannot save accounts.");
            setError("Session expired. Please lock and unlock again.");
            return;
        }
        setAccounts(updatedAccounts);
        await storageService.encryptAndSave(updatedAccounts, masterPassword);
    }, [masterPassword]);

    const handleChangeMasterPassword = useCallback(async (newPassword: string) => {
        setMasterPassword(newPassword); // Update state immediately for responsiveness
        await storageService.encryptAndSave(accounts, newPassword);
    }, [accounts]);


    return (
        <I18nProvider>
            {isLocked ? (
                <LoginScreen 
                    onUnlock={handleUnlock}
                    onSetup={handleSetup}
                    hasData={hasData}
                    error={error}
                    setError={setError}
                />
            ) : (
                <MainScreen 
                    accounts={accounts} 
                    updateAccounts={updateAccounts} 
                    onLock={handleLock}
                    masterPassword={masterPassword}
                    onChangeMasterPassword={handleChangeMasterPassword}
                />
            )}
        </I18nProvider>
    );
};

export default () => (
    <ThemeProvider>
        <App />
    </ThemeProvider>
);