import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { useI18n } from '../../hooks/useI18n';
import { FiTrash2, FiArrowUp, FiArrowDown, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import { Account } from '../../types';

interface ManageGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    groups: string[];
    accounts: Account[];
    updateGroups: (groups: string[], accounts?: Account[]) => Promise<void> | void;
}

const ManageGroupsModal: React.FC<ManageGroupsModalProps> = ({
    isOpen,
    onClose,
    groups,
    accounts,
    updateGroups
}) => {
    const { t } = useI18n();
    const [localGroups, setLocalGroups] = useState<string[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocalGroups([...groups]);
            setEditingIndex(null);
            setEditValue('');
        }
    }, [isOpen, groups]);

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const newGroups = [...localGroups];
        if (direction === 'up' && index > 0) {
            [newGroups[index], newGroups[index - 1]] = [newGroups[index - 1], newGroups[index]];
        } else if (direction === 'down' && index < newGroups.length - 1) {
            [newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
        }
        setLocalGroups(newGroups);
    };

    const startEdit = (index: number) => {
        setEditingIndex(index);
        setEditValue(localGroups[index]);
    };

    const cancelEdit = () => {
        setEditingIndex(null);
        setEditValue('');
    };

    const saveEdit = (index: number) => {
        if (!editValue.trim()) return;
        const oldName = localGroups[index];
        const newName = editValue.trim();
        
        if (oldName === newName) {
            cancelEdit();
            return;
        }

        if (localGroups.includes(newName)) {
            alert(t('errors.group_exists') || 'Group already exists');
            return;
        }

        const newGroups = [...localGroups];
        newGroups[index] = newName;
        setLocalGroups(newGroups);
        
        const updatedAccounts = accounts.map(acc => {
            if (acc.group === oldName) {
                return { ...acc, group: newName };
            }
            return acc;
        });
        
        updateGroups(newGroups, updatedAccounts);
        cancelEdit();
    };

    const handleDelete = (index: number) => {
        const groupName = localGroups[index];
        if (!window.confirm(t('alerts.delete_group_confirm') || `Delete group "${groupName}"? Accounts will be moved to "All".`)) {
            return;
        }

        const newGroups = localGroups.filter((_, i) => i !== index);
        setLocalGroups(newGroups);

        const updatedAccounts = accounts.map(acc => {
            if (acc.group === groupName) {
                const { group, ...rest } = acc;
                return rest; // Remove group property
            }
            return acc;
        });

        updateGroups(newGroups, updatedAccounts);
    };

    const handleSaveOrder = () => {
         updateGroups(localGroups);
         onClose();
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={t('modals.manage_groups_title') || 'Manage Groups'}>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {localGroups.map((group, index) => (
                    <div key={group} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                        {editingIndex === index ? (
                            <div className="flex items-center flex-1 gap-2">
                                <input 
                                    className="flex-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={() => saveEdit(index)} className="p-1 text-green-600 hover:bg-green-100 rounded"><FiCheck /></button>
                                <button onClick={cancelEdit} className="p-1 text-red-600 hover:bg-red-100 rounded"><FiX /></button>
                            </div>
                        ) : (
                            <>
                                <span className="flex-1 font-medium truncate">{group}</span>
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => handleMove(index, 'up')} 
                                        disabled={index === 0}
                                        className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                                    >
                                        <FiArrowUp />
                                    </button>
                                    <button 
                                        onClick={() => handleMove(index, 'down')} 
                                        disabled={index === localGroups.length - 1}
                                        className="p-1 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                                    >
                                        <FiArrowDown />
                                    </button>
                                    <button onClick={() => startEdit(index)} className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded">
                                        <FiEdit2 />
                                    </button>
                                    <button onClick={() => handleDelete(index)} className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded">
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {localGroups.length === 0 && (
                    <p className="text-center text-gray-500 py-4">{t('common.no_groups') || 'No groups'}</p>
                )}
            </div>
            <div className="mt-4 flex justify-end">
                <button onClick={handleSaveOrder} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    {t('common.done') || 'Done'}
                </button>
            </div>
        </BaseModal>
    );
};

export default ManageGroupsModal;
