import React, { useCallback, useState } from 'react';
import { Account } from '../types';
import AccountList from './AccountList';
import { ToastProvider } from './Toast';
import AddEditAccountModal from './modals/AddEditAccountModal';
import SettingsModal from './modals/SettingsModal';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import { FiPlus, FiLock, FiSettings, FiCheck, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SortableProvider, SortableDropTarget, useSortableContext } from './sortable/SortableProvider';

interface MainScreenProps {
    accounts: Account[];
    updateAccounts: (accounts: Account[]) => void;
    onLock: () => void;
    masterPassword?: string;
    onChangeMasterPassword: (newPassword: string) => Promise<void>;
}

const DeleteDropZone: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
    const { dragTarget, draggedId } = useSortableContext();
    const isActive = dragTarget?.type === 'delete';
    const isEnabled = Boolean(draggedId);

    return (
        <div
            className={`reorder-delete-zone ${isActive ? 'active' : ''} ${isEnabled ? 'enabled' : ''}`}
            data-sortable-target="delete"
            role="button"
            aria-label={`${title}. ${subtitle}`}
        >
            <div className="reorder-delete-icon">
                <FiTrash2 className="w-6 h-6" />
            </div>
            <div className="reorder-delete-text">
                <span className="reorder-delete-subtitle">{subtitle}</span>
            </div>
        </div>
    );
};

const MainScreen: React.FC<MainScreenProps> = ({ accounts, updateAccounts, onLock, masterPassword, onChangeMasterPassword }) => {
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const { t } = useI18n();
    const [reorderMode, setReorderMode] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<Account | null>(null);

    const handleAddAccount = useCallback((account: Omit<Account, 'id'>) => {
        const newAccount = { ...account, id: Date.now().toString(), order: accounts.length } as Account;
        updateAccounts([...accounts, newAccount]);
    }, [accounts, updateAccounts]);

    const handleDeleteAccount = useCallback((id: string) => {
        updateAccounts(accounts.filter(acc => acc.id !== id));
    }, [accounts, updateAccounts]);

    const handleRequestDelete = useCallback((account: Account) => {
        setPendingDelete(account);
    }, []);

    const handleImportAccounts = useCallback((incoming: Omit<Account, 'id'>[], mode: 'merge' | 'overwrite', cb?: (summary: { added: number; skipped: number }) => void) => {
        const idsBase = Date.now().toString();
        // attach temporary ids to incoming so we can store them as full Account objects
        const mappedIncoming: Account[] = incoming.map((acc, i) => ({ ...acc, id: `${idsBase}-${i}` } as Account));

        // key by normalized issuer + accountName + secret
        const makeKey = (a: { issuer?: string; accountName?: string; secret?: string }) => {
            const issuer = (a.issuer || '').trim().toLowerCase();
            const name = (a.accountName || '').trim().toLowerCase();
            const secret = (a.secret || '').trim();
            return `${issuer}||${name}||${secret}`;
        };

        if (mode === 'merge') {
            // keep existing accounts first, then append incoming only when key not seen
            const seen = new Map<string, Account>();
            const result: Account[] = [];

            // add existing (preserve order)
            accounts.forEach(acc => {
                const k = makeKey(acc);
                if (!seen.has(k)) {
                    seen.set(k, acc);
                    result.push(acc);
                }
            });

            // add incoming only if key not already present
            mappedIncoming.forEach(acc => {
                const k = makeKey(acc);
                if (!seen.has(k)) {
                    seen.set(k, acc);
                    result.push(acc);
                }
            });

            // set order indexes
            const ordered = result.map((a, idx) => ({ ...a, order: idx }));
            updateAccounts(ordered);
            // compute summary
            const added = mappedIncoming.filter(acc => !accounts.some(a => ((a.issuer || '').trim().toLowerCase() === (acc.issuer || '').trim().toLowerCase()) && ((a.accountName || '').trim().toLowerCase() === (acc.accountName || '').trim().toLowerCase()) && ((a.secret || '').trim() === (acc.secret || '').trim()))).length;
            const uniqueCount = result.length - accounts.length;
            const skipped = mappedIncoming.length - uniqueCount;
            if (cb) cb({ added: uniqueCount, skipped });
        } else {
            // overwrite: replace all with incoming, but deduplicate incoming itself (keep first occurrence)
            const seen = new Map<string, Account>();
            const deduped: Account[] = [];
            mappedIncoming.forEach(acc => {
                const k = makeKey(acc);
                if (!seen.has(k)) {
                    seen.set(k, acc);
                    deduped.push(acc);
                }
            });
            const ordered = deduped.map((a, idx) => ({ ...a, order: idx }));
            updateAccounts(ordered);
            // overwrite: added = deduped length, skipped = incoming.length - deduped.length
            const added = deduped.length;
            const skipped = mappedIncoming.length - deduped.length;
            if (cb) cb({ added, skipped });
        }
    }, [accounts, updateAccounts]);

    const handleEditAccount = useCallback((updatedAccount: Account) => {
        updateAccounts(accounts.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
        setEditingAccount(null);
    }, [accounts, updateAccounts]);

    const handleRequestReorderMode = useCallback(() => {
        setReorderMode(true);
    }, []);

    const handleReorderCommit = useCallback((draggedId: string, target: SortableDropTarget) => {
        if (!draggedId) return;

        const currentIndex = accounts.findIndex(acc => acc.id === draggedId);
        if (currentIndex === -1) return;

        if ((target.type === 'before' || target.type === 'after') && target.id === draggedId) {
            return;
        }

        if (target.type === 'delete') {
            const account = accounts[currentIndex];
            if (!account) return;
            setPendingDelete(account);
            return;
        }

        const updated = [...accounts];
        const [moved] = updated.splice(currentIndex, 1);

        if (target.type === 'end') {
            updated.push(moved);
            updateAccounts(updated);
            return;
        }

        const targetId = target.id;
        if (!targetId) {
            return;
        }

        const targetIndex = updated.findIndex(acc => acc.id === targetId);
        if (targetIndex === -1) {
            return;
        }

        const insertionIndex = target.type === 'after' ? targetIndex + 1 : targetIndex;
        updated.splice(insertionIndex, 0, moved);
        updateAccounts(updated);
    }, [accounts, updateAccounts]);
    
    const openEditModal = (account: Account) => {
        setEditingAccount(account);
        setAddEditModalOpen(true);
    };
    
    const openAddModal = () => {
        setEditingAccount(null);
        setAddEditModalOpen(true);
    };

    const closeAddEditModal = () => {
        setAddEditModalOpen(false);
        setEditingAccount(null);
    };

    const confirmDropDelete = useCallback(() => {
        if (!pendingDelete) return;
        handleDeleteAccount(pendingDelete.id);
        setPendingDelete(null);
    }, [handleDeleteAccount, pendingDelete]);

    const cancelDropDelete = useCallback(() => {
        setPendingDelete(null);
    }, []);
    
    return (
        <div className="min-h-screen app-shell font-sans flex flex-col transition-colors duration-200">
            <ToastProvider>
                <SortableProvider
                    reorderMode={reorderMode}
                    onRequestReorderMode={handleRequestReorderMode}
                    onCommit={handleReorderCommit}
                >
                    <div className="container mx-auto max-w-2xl p-4 flex-grow relative">
                        <header className="flex justify-between items-center py-4">
                            <h1 className="text-2xl font-bold">{t('main.header')}</h1>
                            <div className="flex items-center gap-3">
                                {!reorderMode ? (
                                    <>
                                        <button
                                            onClick={openAddModal}
                                            className="icon-button p-2 rounded-full"
                                            title={t('main.add_account_tooltip')}
                                        >
                                            <FiPlus className="w-6 h-6" />
                                        </button>
                                        <button
                                            onClick={() => setSettingsModalOpen(true)}
                                            className="icon-button p-2 rounded-full"
                                            title={t('main.settings_tooltip')}
                                        >
                                            <FiSettings className="w-6 h-6" />
                                        </button>
                                        <button
                                            onClick={onLock}
                                            className="icon-button p-2 rounded-full"
                                            title={t('main.lock_tooltip')}
                                        >
                                            <FiLock className="w-6 h-6" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <DeleteDropZone
                                            title={t('main.delete_drop_title')}
                                            subtitle={t('main.delete_drop_subtitle')}
                                        />
                                        <button
                                            onClick={() => setReorderMode(false)}
                                            className="icon-button icon-button-accent p-2 rounded-full"
                                            title={t('main.done_button')}
                                        >
                                            <FiCheck className="w-6 h-6" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </header>

                        <main>
                            <div id="account-list-toast-anchor" className="relative">
                                <AccountList
                                    accounts={accounts}
                                    onEdit={openEditModal}
                                    onRequestDelete={handleRequestDelete}
                                    reorderMode={reorderMode}
                                />
                            </div>
                        </main>
                    </div>

                    <footer className="w-full flex-shrink-0 py-4 flex justify-center items-center gap-4">
                        <LanguageSwitcher />
                        <ThemeSwitcher />
                    </footer>

                    {isAddEditModalOpen && (
                        <AddEditAccountModal
                            isOpen={isAddEditModalOpen}
                            onClose={closeAddEditModal}
                            onSave={editingAccount ? handleEditAccount : handleAddAccount}
                            onImportAccounts={handleImportAccounts}
                            account={editingAccount}
                        />
                    )}

                    {isSettingsModalOpen && (
                        <SettingsModal
                            isOpen={isSettingsModalOpen}
                            onClose={() => setSettingsModalOpen(false)}
                            accounts={accounts}
                            updateAccounts={updateAccounts}
                            currentMasterPassword={masterPassword}
                            onChangeMasterPassword={onChangeMasterPassword}
                        />
                    )}

                    <DeleteConfirmModal
                        isOpen={Boolean(pendingDelete)}
                        onCancel={cancelDropDelete}
                        onConfirm={confirmDropDelete}
                        accountName={pendingDelete?.accountName || ''}
                        issuer={pendingDelete?.issuer}
                    />
                </SortableProvider>
            </ToastProvider>
        </div>
    );
};

export default MainScreen;
