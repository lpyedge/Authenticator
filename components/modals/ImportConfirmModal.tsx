import React, { useState } from 'react';
import BaseModal from './BaseModal';
import { useI18n } from '../../hooks/useI18n';
import enLocale from '../../i18n/locales/en.json';

const getNested = (obj: any, path: string) => path.split('.').reduce((acc: any, p: string) => acc && acc[p], obj);

interface ImportConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    count: number;
    initialMode?: 'merge' | 'overwrite';
    onConfirm: (mode: 'merge' | 'overwrite') => void;
}

const ImportConfirmModal: React.FC<ImportConfirmModalProps> = ({ isOpen, onClose, count, initialMode = 'merge', onConfirm }) => {
    const { t } = useI18n();
    const [mode, setMode] = useState<'merge' | 'overwrite'>(initialMode);
    const [overwriteChecked, setOverwriteChecked] = useState(false);
    const translate = (key: string, options?: any) => {
        let val = t(key, options);
        if (val === key) {
            let fromEn: any = getNested(enLocale, key);
            if (typeof fromEn === 'string') {
                if (options) {
                    Object.keys(options).forEach(k => {
                        const regex = new RegExp(`{{${k}}}`, 'g');
                        fromEn = fromEn.replace(regex, String(options[k] ?? ''));
                    });
                }
                return fromEn;
            }
            return key;
        }
        return val;
    };

    const handleConfirm = () => {
        if (mode === 'overwrite' && !overwriteChecked) return;
        onConfirm(mode);
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={translate('modals.import_confirm_title')}>
            <div className="themed-card space-y-3">
                <p className="text-sm text-muted">{translate('modals.import_confirm_message', { count })}</p>
                <p className="text-sm font-medium text-primary">{translate('modals.import_data_ready')}</p>

                <div className="flex rounded-md p-1" style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}>
                    <button onClick={() => setMode('merge')} className={`w-1/2 py-2 text-sm font-medium rounded ${mode === 'merge' ? 'themed-btn themed-btn-primary text-white' : 'text-muted hover:opacity-90'}`}>{translate('modals.import_mode_merge')}</button>
                    <button onClick={() => setMode('overwrite')} className={`w-1/2 py-2 text-sm font-medium rounded ${mode === 'overwrite' ? 'themed-btn themed-btn-danger text-white' : 'text-muted hover:opacity-90'}`}>{translate('modals.import_mode_overwrite')}</button>
                </div>

                {mode === 'merge' && <p className="text-xs text-muted p-2 rounded">{translate('modals.import_merge_explanation')}</p>}

                {mode === 'overwrite' && (
                    <div className="space-y-3 p-3 alert-danger" style={{ borderWidth: '1px', borderStyle: 'solid' }}>
                        <p className="text-sm font-medium" style={{ color: 'rgb(var(--error))' }}>{translate('modals.import_overwrite_warning')}</p>
                        <label className="flex items-center space-x-2 text-sm text-muted">
                            <input type="checkbox" checked={overwriteChecked} onChange={(e) => setOverwriteChecked(e.target.checked)} className="form-checkbox" style={{ backgroundColor: 'rgb(var(--bg-secondary))', borderColor: 'rgb(var(--border))' }} />
                                    <span>{translate('modals.import_overwrite_checkbox_label')}</span>
                        </label>
                    </div>
                )}

                <div className="flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg themed-btn themed-btn-secondary text-sm">{translate('modals.cancel_button')}</button>
                    <button onClick={handleConfirm} disabled={mode === 'overwrite' && !overwriteChecked} className="px-4 py-2 rounded-lg themed-btn themed-btn-primary text-sm" style={{ opacity: (mode === 'overwrite' && !overwriteChecked) ? 0.5 : 1 }}>{translate('modals.confirm_import_button')}</button>
                </div>
            </div>
        </BaseModal>
    );
};

export default ImportConfirmModal;
