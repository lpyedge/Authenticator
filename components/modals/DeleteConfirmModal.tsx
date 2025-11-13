import React from 'react';
import BaseModal from './BaseModal';
import { useI18n } from '../../hooks/useI18n';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    accountName: string;
    issuer?: string;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, onConfirm, onCancel, accountName, issuer }) => {
    const { t } = useI18n();
    const displayName = accountName || issuer || t('main.unnamed_account');

    return (
        <BaseModal isOpen={isOpen} onClose={onCancel} title={t('main.delete_confirm_title')}>
            <div className="space-y-6">
                <p className="text-primary-color text-sm leading-relaxed">
                    {t('main.delete_confirm_message', { name: displayName })}
                </p>
                <div className="flex justify-end gap-2">
                    <button type="button" className="themed-btn themed-btn-secondary" onClick={onCancel}>
                        {t('main.delete_confirm_cancel')}
                    </button>
                    <button type="button" className="themed-btn themed-btn-danger" onClick={onConfirm}>
                        {t('main.delete_confirm_confirm')}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default DeleteConfirmModal;
