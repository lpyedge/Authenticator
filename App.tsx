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
    const [groups, setGroups] = useState<string[]>([]);
    const [hasData, setHasData] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setHasData(storageService.hasData());
    }, []);

    const normalizeAccounts = useCallback((list: Account[]): Account[] => {
        const cloned = list.map(acc => ({ ...acc }));

        const fallbackOrder = new Map<string, number>();
        cloned.forEach((acc, index) => {
            fallbackOrder.set(acc.id, acc.order ?? index);
        });

        cloned
            .sort((a, b) => ( (a.order ?? fallbackOrder.get(a.id) ?? 0) - (b.order ?? fallbackOrder.get(b.id) ?? 0)))
            .forEach((acc, index) => {
                acc.order = index;
            });

        const groupBuckets = new Map<string, Account[]>();
        cloned.forEach(acc => {
            const key = acc.group ?? '';
            if (!groupBuckets.has(key)) {
                groupBuckets.set(key, []);
            }
            groupBuckets.get(key)!.push(acc);
        });

        groupBuckets.forEach(bucket => {
            bucket
                .sort((a, b) => {
                    const aOrder = a.groupOrder ?? a.order ?? 0;
                    const bOrder = b.groupOrder ?? b.order ?? 0;
                    return aOrder - bOrder;
                })
                .forEach((acc, index) => {
                    acc.groupOrder = index;
                });
        });

        return cloned;
    }, []);

    const handleUnlock = useCallback(async (password: string): Promise<boolean> => {
        try {
            const { accounts: decryptedAccounts, groups: storedGroups } = await storageService.loadAndDecrypt(password);
            const normalizedAccounts = normalizeAccounts(decryptedAccounts);
            const combinedGroupsSet = new Set(storedGroups);
            normalizedAccounts.forEach(acc => {
                if (acc.group) {
                    combinedGroupsSet.add(acc.group);
                }
            });
            const combinedGroups = Array.from(combinedGroupsSet.values());
            setAccounts(normalizedAccounts);
            setGroups(combinedGroups);
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
    await storageService.encryptAndSave([], [], password);
        setMasterPassword(password);
        setAccounts([]);
        setGroups([]);
        setIsLocked(false);
        setHasData(true);
        setError(null);
    }, []);
    
    const handleLock = useCallback(() => {
        setIsLocked(true);
        setMasterPassword('');
        setAccounts([]);
        setGroups([]);
    }, []);

    const updateAccounts = useCallback(async (updatedAccounts: Account[]) => {
        if (!masterPassword) {
            console.error("Master password not set. Cannot save accounts.");
            setError("Session expired. Please lock and unlock again.");
            return;
        }
        const normalized = normalizeAccounts(updatedAccounts);
        const combinedGroupsSet = new Set(groups);
        normalized.forEach(acc => {
            if (acc.group) {
                combinedGroupsSet.add(acc.group);
            }
        });
    const combinedGroups = Array.from(combinedGroupsSet.values());
        setAccounts(normalized);
        setGroups(combinedGroups);
        await storageService.encryptAndSave(normalized, combinedGroups, masterPassword);
    }, [masterPassword, groups, normalizeAccounts]);

    const updateGroups = useCallback(async (nextGroups: string[], nextAccounts?: Account[]) => {
        const accountsToPersist = nextAccounts ? normalizeAccounts(nextAccounts) : accounts;
        setGroups(nextGroups);
        if (!masterPassword) {
            return;
        }
        await storageService.encryptAndSave(accountsToPersist, nextGroups, masterPassword);
        if (nextAccounts) {
            setAccounts(accountsToPersist);
        }
    }, [accounts, masterPassword, normalizeAccounts]);

    const handleChangeMasterPassword = useCallback(async (newPassword: string) => {
        setMasterPassword(newPassword); // Update state immediately for responsiveness
        const normalized = normalizeAccounts(accounts);
        await storageService.encryptAndSave(normalized, groups, newPassword);
        setAccounts(normalized);
    }, [accounts, groups, normalizeAccounts]);


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
                    groups={groups}
                    updateGroups={updateGroups}
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