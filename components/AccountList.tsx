import React from 'react';
import { Account } from '../types';
import AccountItem from './AccountItem';
import { useI18n } from '../hooks/useI18n';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface AccountListProps {
    accounts: Account[];
    onEdit: (account: Account) => void;
    onRequestDelete: (account: Account) => void;
    reorderMode?: boolean;
    onRequestReorderMode?: () => void;
}

const AccountList: React.FC<AccountListProps> = ({ accounts, onEdit, onRequestDelete, reorderMode = false, onRequestReorderMode }) => {
    const { t } = useI18n();

    if (accounts.length === 0) {
        return (
            <div className="text-center py-20 px-6 rounded-lg transition-colors duration-200 empty-state-card">
                <h2 className="text-xl font-semibold text-primary-color">{t('main.no_accounts_title')}</h2>
                <p className="mt-2 text-secondary-color">{t('main.no_accounts_subtitle')}</p>
            </div>
        );
    }

    return (
        <SortableContext items={accounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
                {accounts.map(account => (
                    <AccountItem
                        key={account.id}
                        account={account}
                        onEdit={onEdit}
                        onRequestDelete={onRequestDelete}
                        reorderMode={reorderMode}
                        onRequestReorderMode={onRequestReorderMode}
                    />
                ))}
            </div>
        </SortableContext>
    );
};

export default AccountList;