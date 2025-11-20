import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Account } from '../types';
import AccountList from './AccountList';
import { ToastProvider } from './Toast';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import { FiPlus, FiLock, FiSettings, FiCheck, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SortableProvider, SortableDropTarget, useSortableContext } from './sortable/SortableProvider';
import GroupTabs from './GroupTabs';
import AddGroupModal from './modals/AddGroupModal';

const AddEditAccountModal = lazy(() => import('./modals/AddEditAccountModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));

interface MainScreenProps {
    accounts: Account[];
    groups: string[];
    updateAccounts: (accounts: Account[]) => void;
    updateGroups: (groups: string[], accounts?: Account[]) => Promise<void> | void;
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
                <FiTrash2 size={24} aria-hidden="true" />
            </div>
            <div className="reorder-delete-text">
                <span className="reorder-delete-subtitle">{subtitle}</span>
            </div>
        </div>
    );
};

const MainScreen: React.FC<MainScreenProps> = ({ accounts, groups, updateAccounts, updateGroups, onLock, masterPassword, onChangeMasterPassword }) => {
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const { t } = useI18n();
    const [reorderMode, setReorderMode] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
    const [activeGroup, setActiveGroup] = useState<string>('');
    const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);

    const allGroups = useMemo(() => {
        const set = new Set<string>(groups);
        accounts.forEach(acc => {
            if (acc.group) {
                set.add(acc.group);
            }
        });
        return Array.from(set);
    }, [groups, accounts]);

    useEffect(() => {
        if (activeGroup && !allGroups.includes(activeGroup)) {
            setActiveGroup('');
        }
    }, [activeGroup, allGroups]);

    const handleAddAccount = useCallback((account: Omit<Account, 'id'>) => {
        const newAccount: Account = {
            ...account,
            id: Date.now().toString(),
            order: accounts.length,
            groupOrder: account.group ? (accounts.filter(a => a.group === account.group).length) : undefined,
        };
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

        // Handle Group Reordering
        if (draggedId.startsWith('group-tab:')) {
            const draggedGroup = draggedId.slice('group-tab:'.length);
            
            const newGroups = [...allGroups];
            // Remove 'All' tab placeholder if present (usually empty string)
            // But wait, 'allGroups' might contain empty string if it's in 'groups' or accounts have empty group.
            // We only want to reorder named groups.
            // If draggedGroup is empty string (All tab), we shouldn't be able to drag it (disabled in GroupTabs).
            
            const fromIndex = newGroups.indexOf(draggedGroup);
            if (fromIndex === -1) return;
            
            newGroups.splice(fromIndex, 1);
            
            let targetGroup = '';
            if (target.type === 'reorder-group-before' || target.type === 'reorder-group-after') {
                targetGroup = target.groupId;
            } else {
                return;
            }
            
            let toIndex = newGroups.indexOf(targetGroup);
            if (toIndex === -1) return;
            
            if (target.type === 'reorder-group-after') {
                toIndex += 1;
            }
            
            newGroups.splice(toIndex, 0, draggedGroup);
            
            updateGroups(newGroups.filter(g => g));
            return;
        }

        const originalAccount = accounts.find(acc => acc.id === draggedId);
        if (!originalAccount) return;

        if (target.type === 'delete') {
            setPendingDelete(originalAccount);
            return;
        }

        const updated = accounts.map(acc => ({ ...acc }));
        const byId = new Map<string, Account>(
            updated.map((acc): [string, Account] => [acc.id, acc])
        );
        const dragged = byId.get(draggedId);
        if (!dragged) return;

        const normalizeGroup = (groupId: string | undefined) => {
            const key = groupId ?? '';
            const members = updated
                .filter(acc => (acc.group ?? '') === key)
                .sort((a, b) => {
                    const aOrder = a.groupOrder ?? a.order ?? 0;
                    const bOrder = b.groupOrder ?? b.order ?? 0;
                    return aOrder - bOrder;
                });
            members.forEach((acc, idx) => {
                acc.groupOrder = idx;
            });
        };

        if (target.type === 'group-tab') {
            if (target.groupId === '__create__') {
                setIsAddGroupOpen(true);
                return;
            }
            const newGroupKey = target.groupId === '__all__' ? '' : target.groupId;
            const originalGroupKey = dragged.group ?? '';
            if (newGroupKey !== originalGroupKey) {
                const sourceRect = document.querySelector<HTMLElement>(`[data-sortable-id="${draggedId}"]`);
                const targetTab = document.querySelector<HTMLElement>(`[data-group-tab="${target.groupId}"]`);
                if (sourceRect && targetTab) {
                    const clone = sourceRect.cloneNode(true) as HTMLElement;
                    clone.classList.add('group-drop-clone');
                    const card = sourceRect.querySelector<HTMLElement>('.group-drop-source');
                    card?.classList.add('group-drop-source-hidden');
                    const sourceBounds = sourceRect.getBoundingClientRect();
                    const targetBounds = targetTab.getBoundingClientRect();
                    clone.style.position = 'fixed';
                    clone.style.top = `${sourceBounds.top}px`;
                    clone.style.left = `${sourceBounds.left}px`;
                    clone.style.width = `${sourceBounds.width}px`;
                    clone.style.height = `${sourceBounds.height}px`;
                    clone.style.pointerEvents = 'none';
                    clone.style.transform = 'translate(0px, 0px) scale(1)';
                    clone.style.transition = 'transform 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.35s ease-out';
                    document.body.appendChild(clone);

                    requestAnimationFrame(() => {
                        const translateX = targetBounds.left + targetBounds.width / 2 - (sourceBounds.left + sourceBounds.width / 2);
                        const translateY = targetBounds.top + targetBounds.height / 2 - (sourceBounds.top + sourceBounds.height / 2);
                        clone.style.transform = `translate(${translateX}px, ${translateY - 8}px) scale(0.45)`;
                        clone.style.opacity = '0';
                    });

                    clone.addEventListener('transitionend', () => {
                        clone.remove();
                        card?.classList.remove('group-drop-source-hidden');
                        targetTab.classList.add('group-tab-pulse');
                        setTimeout(() => {
                            targetTab.classList.remove('group-tab-pulse');
                        }, 420);
                    }, { once: true });
                }

                const existingCount = updated.filter(acc => (acc.group ?? '') === newGroupKey && acc.id !== draggedId).length;
                dragged.group = newGroupKey || undefined;
                dragged.groupOrder = existingCount;
                normalizeGroup(originalGroupKey);
                normalizeGroup(dragged.group);
                updateAccounts(updated);
            }
            return;
        }

        // Global reorder when viewing "All"
        if (!activeGroup) {
            const orderIds = updated.map(acc => acc.id);
            const fromIndex = orderIds.indexOf(draggedId);
            if (fromIndex === -1) return;
            orderIds.splice(fromIndex, 1);

            if (target.type === 'end') {
                orderIds.push(draggedId);
            } else {
                const targetIndex = orderIds.indexOf(target.id);
                if (targetIndex === -1) return;
                const insertIndex = target.type === 'after' ? targetIndex + 1 : targetIndex;
                orderIds.splice(insertIndex, 0, draggedId);
            }

            orderIds.forEach((id, idx) => {
                const account = byId.get(id);
                if (account) {
                    account.order = idx;
                }
            });
            normalizeGroup(dragged.group);
            updateAccounts(updated);
            return;
        }

        // Group-specific reorder
        const groupKey = activeGroup;
        if ((dragged.group ?? '') !== groupKey) {
            dragged.group = groupKey || undefined;
        }
        const groupMembers = accounts
            .filter(acc => (acc.group ?? '') === groupKey)
            .map(acc => byId.get(acc.id)!)
            .filter(Boolean)
            .sort((a, b) => {
                const aOrder = a.groupOrder ?? a.order ?? 0;
                const bOrder = b.groupOrder ?? b.order ?? 0;
                return aOrder - bOrder;
            });

        const fromIndex = groupMembers.findIndex(acc => acc.id === draggedId);
        if (fromIndex === -1) return;
        const [extracted] = groupMembers.splice(fromIndex, 1);

        let insertIndex: number;
        if (target.type === 'end') {
            insertIndex = groupMembers.length;
        } else {
            const targetIndex = groupMembers.findIndex(acc => acc.id === target.id);
            if (targetIndex === -1) return;
            insertIndex = target.type === 'after' ? targetIndex + 1 : targetIndex;
        }

        groupMembers.splice(insertIndex, 0, extracted);
        groupMembers.forEach((acc, idx) => {
            acc.groupOrder = idx;
        });
        normalizeGroup(groupKey);
        updateAccounts(updated);
    }, [accounts, activeGroup, updateAccounts]);
    
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

    const filteredAccounts = useMemo(() => {
        if (!activeGroup) {
            return [...accounts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }
        return accounts
            .filter(acc => (acc.group ?? '') === activeGroup)
            .sort((a, b) => {
                const aOrder = a.groupOrder ?? a.order ?? 0;
                const bOrder = b.groupOrder ?? b.order ?? 0;
                return aOrder - bOrder;
            });
    }, [accounts, activeGroup]);
    
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
                                            <FiPlus size={24} aria-hidden="true" />
                                        </button>
                                        <button
                                            onClick={() => setSettingsModalOpen(true)}
                                            className="icon-button p-2 rounded-full"
                                            title={t('main.settings_tooltip')}
                                        >
                                            <FiSettings size={24} aria-hidden="true" />
                                        </button>
                                        <button
                                            onClick={onLock}
                                            className="icon-button p-2 rounded-full"
                                            title={t('main.lock_tooltip')}
                                        >
                                            <FiLock size={24} aria-hidden="true" />
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
                                            <FiCheck size={24} aria-hidden="true" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </header>

                        <main>
                            <GroupTabs
                                groups={allGroups}
                                activeGroup={activeGroup}
                                onSelectGroup={setActiveGroup}
                                onRequestAddGroup={() => setIsAddGroupOpen(true)}
                                reorderMode={reorderMode}
                                labels={{
                                    all: t('groups.all'),
                                    add: t('groups.add_tab'),
                                }}
                                accounts={accounts}
                            />
                            <div id="account-list-toast-anchor" className="relative">
                                <AccountList
                                    accounts={filteredAccounts}
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
                        <Suspense fallback={null}>
                            <AddEditAccountModal
                                isOpen={isAddEditModalOpen}
                                onClose={closeAddEditModal}
                                onSave={editingAccount ? handleEditAccount : handleAddAccount}
                                onImportAccounts={handleImportAccounts}
                                account={editingAccount}
                            />
                        </Suspense>
                    )}

                    {isSettingsModalOpen && (
                        <Suspense fallback={null}>
                            <SettingsModal
                                isOpen={isSettingsModalOpen}
                                onClose={() => setSettingsModalOpen(false)}
                                accounts={accounts}
                                updateAccounts={updateAccounts}
                                currentMasterPassword={masterPassword}
                                onChangeMasterPassword={onChangeMasterPassword}
                            />
                        </Suspense>
                    )}

                    <DeleteConfirmModal
                        isOpen={Boolean(pendingDelete)}
                        onCancel={cancelDropDelete}
                        onConfirm={confirmDropDelete}
                        accountName={pendingDelete?.accountName || ''}
                        issuer={pendingDelete?.issuer}
                    />
                    <AddGroupModal
                        isOpen={isAddGroupOpen}
                        existingGroups={allGroups}
                        onCancel={() => setIsAddGroupOpen(false)}
                        onSave={async (name) => {
                            const normalized = name.trim();
                            if (!groups.includes(normalized)) {
                                await updateGroups([...groups, normalized]);
                            }
                            setActiveGroup(normalized);
                            setIsAddGroupOpen(false);
                        }}
                    />
                </SortableProvider>
            </ToastProvider>
        </div>
    );
};

export default MainScreen;
