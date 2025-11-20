import React, { Suspense, lazy } from 'react';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAccountManager } from './hooks/useAccountManager';

const LoginScreen = lazy(() => import('./components/LoginScreen'));
const MainScreen = lazy(() => import('./components/MainScreen'));

const App: React.FC = () => {
    const {
        isLocked,
        masterPassword,
        accounts,
        groups,
        hasData,
        error,
        setError,
        handleUnlock,
        handleSetup,
        handleLock,
        updateAccounts,
        updateGroups,
        handleChangeMasterPassword
    } = useAccountManager();

    return (
        <I18nProvider>
            <Suspense fallback={<div className="app-loading" role="status">Loading…</div>}>
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
            </Suspense>
        </I18nProvider>
    );
};

export default () => (
    <ThemeProvider>
        <App />
    </ThemeProvider>
);