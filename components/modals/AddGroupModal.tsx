import React, { useCallback, useEffect, useMemo, useState } from 'react';
import BaseModal from './BaseModal';
import { useI18n } from '../../hooks/useI18n';

interface AddGroupModalProps {
    isOpen: boolean;
    existingGroups: string[];
    onCancel: () => void;
    onSave: (name: string) => Promise<void> | void;
}

const normalize = (value: string) => value.trim().toLowerCase();

const AddGroupModal: React.FC<AddGroupModalProps> = ({ isOpen, existingGroups, onCancel, onSave }) => {
    const { t } = useI18n();
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    const normalizedExisting = useMemo(() => {
        return existingGroups
            .map(normalize)
            .filter(Boolean);
    }, [existingGroups]);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setError(null);
        }
    }, [isOpen]);

    const handleSubmit = useCallback(() => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError(t('groups.name_required'));
            return;
        }

        if (normalizedExisting.includes(normalize(trimmed))) {
            setError(t('groups.name_duplicate'));
            return;
        }

        const result = onSave(trimmed);
        if (result instanceof Promise) {
            result.catch(() => {
                // no-op: parent should surface errors if needed
            });
        }
    }, [name, normalizedExisting, onSave, t]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);

    return (
        <BaseModal isOpen={isOpen} onClose={onCancel} title={t('groups.add_modal_title')}>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label htmlFor="group-name" className="block text-sm font-medium add-group-label">
                        {t('groups.add_modal_label')}
                    </label>
                    <input
                        id="group-name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (error) setError(null);
                        }}
                        onKeyDown={handleKeyDown}
                        className={`add-group-input${error ? ' add-group-input-error' : ''}`}
                        autoFocus
                    />
                    {error && (
                        <p className="text-sm add-group-error">
                            {error}
                        </p>
                    )}
                </div>
                <div className="add-group-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onCancel}
                    >
                        {t('modals.cancel_button')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSubmit}
                    >
                        {t('modals.save_button')}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default AddGroupModal;
