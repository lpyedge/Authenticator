import React from 'react';
import { Account } from '../types';
import AccountItem from './AccountItem';
import { useI18n } from '../hooks/useI18n';
import { SortableContainer } from './sortable/SortableContainer';
import { SortableItem } from './sortable/SortableItem';

interface AccountListProps {
    accounts: Account[];
    onEdit: (account: Account) => void;
    onRequestDelete: (account: Account) => void;
    reorderMode?: boolean;
}

const AccountList: React.FC<AccountListProps> = ({ accounts, onEdit, onRequestDelete, reorderMode = false }) => {
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
        <SortableContainer id="account-list-container" className="space-y-0">
            {accounts.map(account => (
                <SortableItem key={account.id} id={account.id}>
                    <AccountItem
                        account={account}
                        onEdit={onEdit}
                        onRequestDelete={onRequestDelete}
                        reorderMode={reorderMode}
                    />
                </SortableItem>
            ))}
        </SortableContainer>
    );
};

export default AccountList;