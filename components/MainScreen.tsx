import React, { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Account } from '../types';
import AccountList from './AccountList';
import { ToastProvider } from './Toast';
import DeleteConfirmModal from './modals/DeleteConfirmModal';
import { FiPlus, FiLock, FiSettings, FiCheck, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';
import LanguageSwitcher from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import GroupTabs, { GroupTabItem } from './GroupTabs';
import AddGroupModal from './modals/AddGroupModal';
import { 
    DndContext, 
    DragOverlay, 
    useSensor, 
    useSensors, 
    PointerSensor, 
    KeyboardSensor, 
    closestCenter, 
    pointerWithin,
    DragEndEvent,
    DragStartEvent,
    useDroppable,
    DragOverEvent
} from '@dnd-kit/core';
import { 
    arrayMove, 
    sortableKeyboardCoordinates 
} from '@dnd-kit/sortable';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import AccountItem from './AccountItem';

const AddEditAccountModal = lazy(() => import('./modals/AddEditAccountModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));
// ManageGroupsModal removed as requested

interface MainScreenProps {
    accounts: Account[];
    groups: string[];
    updateAccounts: (accounts: Account[]) => void;
    updateGroups: (groups: string[], accounts?: Account[]) => Promise<void> | void;
    onLock: () => void;
    masterPassword?: string;
    onChangeMasterPassword: (newPassword: string) => Promise<void>;
}

const EditDropZone: React.FC<{ title: string; subtitle: string; active: boolean }> = ({ title, subtitle, active }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'edit-zone',
    });

    return (
        <div
            ref={setNodeRef}
            className={`reorder-edit-zone ${isOver ? 'active' : ''} ${active ? 'enabled' : ''}`}
            role="button"
            aria-label={`${title}. ${subtitle}`}
        >
            <div className="reorder-delete-icon">
                <FiEdit2 size={18} aria-hidden="true" />
            </div>
            <span className="reorder-delete-subtitle">{subtitle}</span>
        </div>
    );
};

const DeleteDropZone: React.FC<{ title: string; subtitle: string; active: boolean }> = ({ title, subtitle, active }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'delete-zone',
    });

    return (
        <div
            ref={setNodeRef}
            className={`reorder-delete-zone ${isOver ? 'active' : ''} ${active ? 'enabled' : ''}`}
            role="button"
            aria-label={`${title}. ${subtitle}`}
        >
            <div className="reorder-delete-icon">
                <FiTrash2 size={18} aria-hidden="true" />
            </div>
            <span className="reorder-delete-subtitle">{subtitle}</span>
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
    const [editingGroup, setEditingGroup] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);

    const openAddModal = () => {
        setEditingAccount(null);
        setAddEditModalOpen(true);
    };

    const openEditModal = (account: Account) => {
        setEditingAccount(account);
        setAddEditModalOpen(true);
    };

    const closeAddEditModal = () => {
        setAddEditModalOpen(false);
        setEditingAccount(null);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const allGroups = useMemo(() => {
        const set = new Set<string>(groups);
        accounts.forEach(acc => {
            if (acc.group) {
                set.add(acc.group);
            }
        });
        return Array.from(set);
    }, [groups, accounts]);

    const filteredAccounts = useMemo(() => {
        let result = accounts;
        if (activeGroup) {
            result = result.filter(acc => acc.group === activeGroup);
            return result.sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
        }
        return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }, [accounts, activeGroup]);

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

    const cancelDropDelete = () => {
        setPendingDelete(null);
    };

    const confirmDropDelete = () => {
        if (pendingDelete) {
            handleDeleteAccount(pendingDelete.id);
            setPendingDelete(null);
        }
    };

    const handleImportAccounts = useCallback((incoming: Omit<Account, 'id'>[], mode: 'merge' | 'overwrite', cb?: (summary: { added: number; skipped: number }) => void) => {
        const idsBase = Date.now().toString();
        // attach temporary ids to incoming so we can store them as full Account objects
        const mappedIncoming: Account[] = incoming.map((acc, i) => ({ ...acc, id: `${idsBase}-${i}` } as Account));

        // key by normalized issuer + accountName + secret + period + algorithm + digits
        const makeKey = (a: { issuer?: string; accountName?: string; secret?: string; period?: number; algorithm?: string; digits?: number }) => {
            const issuer = (a.issuer || '').trim().toLowerCase();
            const name = (a.accountName || '').trim().toLowerCase();
            const secret = (a.secret || '').trim();
            const period = a.period || 30;
            const algorithm = (a.algorithm || 'SHA1').toUpperCase();
            const digits = a.digits || 6;
            return `${issuer}||${name}||${secret}||${period}||${algorithm}||${digits}`;
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
            const added = mappedIncoming.filter(acc => !accounts.some(a => makeKey(a) === makeKey(acc))).length;
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
            // overwrite: added = deduped length, skipped = incoming.length - deduped length
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

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        document.body.classList.add('is-dragging-global');
        document.body.classList.remove('is-dragging-invalid');
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) {
            document.body.classList.remove('is-dragging-invalid');
            return;
        }

        // Check validity
        const isAccount = active.data.current?.type === 'Account' || !active.id.toString().startsWith('group-sort:');
        const isGroupSort = active.data.current?.type === 'group-sort' || active.id.toString().startsWith('group-sort:');
        
        const isOverGroupTab = over.id.toString().startsWith('group-tab:') || over.id.toString().startsWith('group-sort:');
        // Account items don't have a specific prefix, but they are not group-sort, group-tab, or zones
        const isOverAccount = !over.id.toString().startsWith('group-sort:') && !over.id.toString().startsWith('group-tab:') && over.id !== 'delete-zone' && over.id !== 'edit-zone';
        
        let isInvalid = false;
        // if (isAccount && isOverGroupTab) isInvalid = true; // Allow account -> group tab
        if (isGroupSort && isOverAccount) isInvalid = true;
        
        if (isInvalid) {
            document.body.classList.add('is-dragging-invalid');
        } else {
            document.body.classList.remove('is-dragging-invalid');
        }

        // Handle Group Sorting
        if (active.id.toString().startsWith('group-sort:') && (over.id.toString().startsWith('group-sort:') || over.id.toString().startsWith('group-tab:'))) {
            const activeGroupId = active.id.toString().replace('group-sort:', '');
            const overGroupId = over.id.toString().replace('group-sort:', '').replace('group-tab:', '');
            
            if (activeGroupId !== overGroupId) {
                const oldIndex = groups.indexOf(activeGroupId);
                const newIndex = groups.indexOf(overGroupId);
                
                if (oldIndex !== -1 && newIndex !== -1) {
                    const newGroups = arrayMove(groups, oldIndex, newIndex);
                    updateGroups(newGroups);
                }
            }
            return;
        }

        // If dragging an account over another account, reorder visually
        if (!active.id.toString().startsWith('group-sort:') && !over.id.toString().startsWith('group-sort:') && over.id !== 'delete-zone' && over.id !== 'edit-zone' && !over.id.toString().startsWith('group-tab:')) {
            const activeId = active.id;
            const overId = over.id;

            if (activeId !== overId) {
                const oldIndex = filteredAccounts.findIndex(a => a.id === activeId);
                const newIndex = filteredAccounts.findIndex(a => a.id === overId);

                if (oldIndex !== -1 && newIndex !== -1) {
                    // We need to update the source accounts array to reflect this change
                    // But filteredAccounts is derived. We need to find the actual accounts in the main list.
                    // However, for visual feedback, we might need to update the main list immediately.
                    // But wait, if we update main list, it triggers re-render.
                    
                    // dnd-kit recommends updating state onDragOver for sortable lists between containers,
                    // but for single container, it's also fine if we want the "placeholder" to move.
                    
                    const newFiltered = arrayMove(filteredAccounts, oldIndex, newIndex);
                    
                    // We need to map this back to the full accounts list
                    // This is complex because filteredAccounts is a subset.
                    // But if we are just reordering within the group, we can do it.
                    
                    const updatedAccounts = [...accounts];
                    // Remove the moved item
                    const item = updatedAccounts.find(a => a.id === activeId);
                    if (!item) return;
                    
                    // This logic is tricky for "live" sorting with filtered lists.
                    // Simpler approach: Let dnd-kit handle the transform (which it does),
                    // but ensure the placeholder is rendered at the new position.
                    // If dnd-kit's SortableContext is working, the items should swap.
                    // If they are not swapping, it's because we are not updating the items passed to SortableContext?
                    // No, SortableContext gets `filteredAccounts`.
                    
                    // If we want the "gap" to move, we MUST update the order of items passed to SortableContext.
                    // So we MUST update `accounts` state here.
                    // Find indices in the main `accounts` array?
                    // No, we should only swap their order properties or position in the array.
                    
                    // Actually, if we just update the `accounts` array order, it should work.
                    // Find indices in the main `accounts` array?
                    // No, we should only swap their order properties or position in the array.
                    
                    // Actually, if we just update the `accounts` array order, it should work.
                    const oldMainIndex = accounts.findIndex(a => a.id === activeId);
                    // We can't easily find the new main index because `overId` might be far away in the main list if filtered.
                    // But if we are in a filtered view (Group), we are only seeing a subset.
                    // Swapping in the subset is what matters visually.
                    
                    // Let's construct the new order for the subset
                    const newSubset = arrayMove(filteredAccounts, oldIndex, newIndex);
                    
                    // Now reconstruct the full list
                    const newAccounts = [...accounts];
                    
                    // We need to re-arrange the items that are in the subset, keeping others in place?
                    // Or just update the `order` / `groupOrder` property?
                    // Updating properties is safer but might not trigger re-order in the array if we don't sort.
                    // But `filteredAccounts` sorts by `order`/`groupOrder`.
                    
                    // So:
                    newSubset.forEach((acc: Account, index: number) => {
                        const original = newAccounts.find(a => a.id === acc.id);
                        if (original) {
                            if (activeGroup) {
                                original.groupOrder = index;
                            } else {
                                original.order = index;
                            }
                        }
                    });
                    
                    // We also need to sort `newAccounts` so that `filteredAccounts` (which is derived) comes out in the new order?
                    // `filteredAccounts` sorts by `order`. So if we update `order`, it should re-sort.
                    updateAccounts(newAccounts);
                }
            }
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        document.body.classList.remove('is-dragging-global');
        document.body.classList.remove('is-dragging-invalid');

        if (!over) return;

        // Check validity to prevent invalid drops
        const isAccount = active.data.current?.type === 'Account' || !active.id.toString().startsWith('group-sort:');
        const isGroupSort = active.data.current?.type === 'group-sort' || active.id.toString().startsWith('group-sort:');
        const isOverGroupTab = over.id.toString().startsWith('group-tab:');
        const isOverAccount = !over.id.toString().startsWith('group-sort:') && !over.id.toString().startsWith('group-tab:') && over.id !== 'delete-zone' && over.id !== 'edit-zone';

        // if (isAccount && isOverGroupTab) return; // Allow account -> group tab
        if (isGroupSort && isOverAccount) return;

        if (over.id === 'delete-zone') {
            if (active.id.toString().startsWith('group-sort:')) {
                const groupId = active.id.toString().replace('group-sort:', '');
                if (window.confirm(t('alerts.delete_group_confirm', { groupName: groupId }) || `Delete group "${groupId}"?`)) {
                    const newGroups = groups.filter(g => g !== groupId);
                    const updatedAccounts = accounts.map(acc => {
                        if (acc.group === groupId) {
                            const { group, ...rest } = acc;
                            return rest;
                        }
                        return acc;
                    });
                    updateGroups(newGroups, updatedAccounts);
                    if (activeGroup === groupId) setActiveGroup('');
                }
                return;
            }

            const account = accounts.find(a => a.id === active.id);
            if (account) setPendingDelete(account);
            return;
        }

        if (over.id === 'edit-zone') {
            if (active.id.toString().startsWith('group-sort:')) {
                const groupId = active.id.toString().replace('group-sort:', '');
                setEditingGroup(groupId);
                setIsAddGroupOpen(true); // Reuse AddGroupModal for editing
                return;
            }

            const account = accounts.find(a => a.id === active.id);
            if (account) {
                openEditModal(account);
            }
            return;
        }

        if (over.id.toString().startsWith('group-sort:') || (active.id.toString().startsWith('group-sort:') && over.id.toString().startsWith('group-tab:'))) {
            // Reordering groups
            const activeGroupId = active.id.toString().replace('group-sort:', '');
            const overGroupId = over.id.toString().replace('group-sort:', '').replace('group-tab:', '');
            
            if (activeGroupId !== overGroupId) {
                const oldIndex = groups.indexOf(activeGroupId);
                const newIndex = groups.indexOf(overGroupId);
                
                if (oldIndex !== -1 && newIndex !== -1) {
                    const newGroups = arrayMove(groups, oldIndex, newIndex);
                    updateGroups(newGroups);
                }
            }
            return;
        }

        if (over.id.toString().startsWith('group-tab:')) {
            // Only handle account drops here
            if (active.id.toString().startsWith('group-sort:')) return;

            const targetGroup = over.id.toString().replace('group-tab:', '');
            const accountId = active.id as string;
            const account = accounts.find(a => a.id === accountId);
            
            if (account) {
                const newGroup = targetGroup === '__all__' ? '' : targetGroup;
                
                if (newGroup === '__create__') {
                    setIsAddGroupOpen(true);
                    return;
                }

                if ((account.group || '') !== newGroup) {
                    const updatedAccounts = accounts.map(acc => {
                        if (acc.id === accountId) {
                            // When moving to a new group, append to the end of that group's order
                            const targetGroupAccounts = accounts.filter(a => (a.group || '') === newGroup);
                            const maxGroupOrder = targetGroupAccounts.length > 0 
                                ? Math.max(...targetGroupAccounts.map(a => a.groupOrder || 0)) 
                                : -1;
                            
                            return { 
                                ...acc, 
                                group: newGroup || undefined,
                                groupOrder: maxGroupOrder + 1
                            };
                        }
                        return acc;
                    });
                    updateAccounts(updatedAccounts);
                }
            }
            return;
        }

        if (active.id !== over.id) {
            const oldIndex = filteredAccounts.findIndex(a => a.id === active.id);
            const newIndex = filteredAccounts.findIndex(a => a.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newFiltered: Account[] = arrayMove(filteredAccounts, oldIndex, newIndex);
                
                const updatedAccounts = [...accounts];
                
                newFiltered.forEach((acc, index) => {
                    const original = updatedAccounts.find(a => a.id === acc.id);
                    if (original) {
                        if (activeGroup) {
                            original.groupOrder = index;
                        } else {
                            original.order = index;
                        }
                    }
                });
                
                updateAccounts(updatedAccounts);
            }
        }
    };
    
    return (
        <div className="min-h-screen app-shell font-sans flex flex-col transition-colors duration-200">
            <ToastProvider>
                <DndContext
                    sensors={sensors}
                    collisionDetection={pointerWithin}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                >
                    <div className="container mx-auto max-w-2xl p-4 flex-grow relative">
                        <header className="flex justify-between items-center py-4">
                            <h1 className="text-title">{t('main.header')}</h1>
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
                                        <div className="flex gap-2">
                                            <EditDropZone
                                                title={t('main.edit_drop_title') || 'Edit'}
                                                subtitle={t('main.edit_drop_subtitle') || 'Drop to Edit'}
                                                active={!!activeId}
                                            />
                                            <DeleteDropZone
                                                title={t('main.delete_drop_title')}
                                                subtitle={t('main.delete_drop_subtitle')}
                                                active={!!activeId}
                                            />
                                        </div>
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
                                onRequestReorderMode={handleRequestReorderMode}
                            />
                            <div id="account-list-toast-anchor" className="relative">
                                <AccountList
                                    accounts={filteredAccounts}
                                    onEdit={openEditModal}
                                    onRequestDelete={handleRequestDelete}
                                    reorderMode={reorderMode}
                                    onRequestReorderMode={handleRequestReorderMode}
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
                        initialValue={editingGroup || ''}
                        onCancel={() => {
                            setIsAddGroupOpen(false);
                            setEditingGroup(null);
                        }}
                        onSave={async (name) => {
                            const normalized = name.trim();
                            if (editingGroup) {
                                // Rename logic
                                if (normalized !== editingGroup) {
                                    if (groups.includes(normalized)) {
                                        alert(t('groups.name_duplicate'));
                                        return;
                                    }
                                    const index = groups.indexOf(editingGroup);
                                    const newGroups = [...groups];
                                    newGroups[index] = normalized;
                                    
                                    const updatedAccounts = accounts.map(acc => {
                                        if (acc.group === editingGroup) {
                                            return { ...acc, group: normalized };
                                        }
                                        return acc;
                                    });
                                    await updateGroups(newGroups, updatedAccounts);
                                    if (activeGroup === editingGroup) setActiveGroup(normalized);
                                }
                            } else {
                                // Add logic
                                if (!groups.includes(normalized)) {
                                    await updateGroups([...groups, normalized]);
                                    setActiveGroup(normalized);
                                }
                            }
                            setIsAddGroupOpen(false);
                            setEditingGroup(null);
                        }}
                    />
                    <DragOverlay 
                        modifiers={[snapCenterToCursor]}
                        dropAnimation={{
                        duration: 250,
                        easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                    }}>
                        {activeId ? (
                            activeId.toString().startsWith('group-sort:') ? (
                                <div className="transform scale-105 cursor-grabbing">
                                    <GroupTabItem
                                        groupId={activeId.toString().replace('group-sort:', '')}
                                        label={activeId.toString().replace('group-sort:', '')}
                                        isActive={true}
                                        count={accounts.filter(a => a.group === activeId.toString().replace('group-sort:', '')).length}
                                        isAllTab={false}
                                        reorderMode={true}
                                        isOverlay={true}
                                    />
                                </div>
                            ) : (
                                accounts.find(a => a.id === activeId) ? (
                                    <div className="transform scale-50 cursor-grabbing opacity-90 origin-center">
                                        <AccountItem
                                            account={accounts.find(a => a.id === activeId)!}
                                            onEdit={() => {}}
                                            onRequestDelete={() => {}}
                                            reorderMode={true}
                                            isOverlay={true}
                                        />
                                    </div>
                                ) : null
                            )
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </ToastProvider>
        </div>
    );
};

export default MainScreen;
