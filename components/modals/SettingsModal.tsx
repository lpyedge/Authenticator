import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Account } from '../../types';
import BaseModal from './BaseModal';
import { cryptoService } from '../../services/cryptoService';
import { useI18n } from '../../hooks/useI18n';
import ImportConfirmModal from './ImportConfirmModal';
import { useToast } from '../Toast';
import { FiKey, FiRefreshCw } from 'react-icons/fi';
import { parseMigrationUri } from '../../libs/migration';

const GoogleAuthenticatorExportModal = lazy(() => import('./GoogleAuthenticatorExportModal'));

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: Account[];
    updateAccounts: (accounts: Account[]) => void;
    currentMasterPassword?: string;
    onChangeMasterPassword: (newPassword: string) => Promise<void>;
}

type ActiveTab = 'password' | 'import_export';
type ExportStage = 'idle' | 'confirm_plain' | 'prompt_encrypted';
type ImportStage = 'select_file' | 'password' | 'confirm_action';

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    accounts,
    updateAccounts,
    currentMasterPassword,
    onChangeMasterPassword
}) => {
    const { t } = useI18n();
    const addToast = useToast();
    const [activeTab, setActiveTab] = useState<ActiveTab>('password');

    // --- Change Password State ---
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // --- Import/Export State ---
    const [exportStage, setExportStage] = useState<ExportStage>('idle');
    const [isGoogleAuthExportOpen, setGoogleAuthExportOpen] = useState(false);
    const [encryptionPassword, setEncryptionPassword] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [importStage, setImportStage] = useState<ImportStage>('select_file');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPassword, setImportPassword] = useState('');
    const [importData, setImportData] = useState<Account[] | null>(null);
    // imports proceed in 'merge' mode by default
    const [importIsLoading, setImportIsLoading] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [showImportConfirmModal, setShowImportConfirmModal] = useState(false);

    const resetImportFlow = useCallback(() => {
        setImportStage('select_file');
        setImportFile(null);
        setImportPassword('');
        setImportData(null);
        setImportIsLoading(false);
        setImportError(null);
        setShowImportConfirmModal(false);
        const fileInput = document.getElementById('file-import-settings') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    }, []);

    const resetImportExportState = useCallback(() => {
        setExportStage('idle');
        setEncryptionPassword('');
        setIsGenerating(false);
        resetImportFlow();
        setGoogleAuthExportOpen(false);
    }, [resetImportFlow]);

    const resetPasswordChangeState = useCallback(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setPasswordError('');
        setPasswordSuccess('');
    }, []);

    useEffect(() => {
        if (isOpen) {
            resetPasswordChangeState();
            resetImportExportState();
        }
    }, [isOpen, resetPasswordChangeState, resetImportExportState]);

    useEffect(() => {
        if (importStage === 'confirm_action') {
            setShowImportConfirmModal(true);
        }
    }, [importStage]);

    const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (currentPassword !== currentMasterPassword) {
            setPasswordError('errors.current_password_incorrect');
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError('errors.password_too_short');
            return;
        }
        if (newPassword !== confirmNewPassword) {
            setPasswordError('errors.passwords_do_not_match');
            return;
        }
        
        try {
            await onChangeMasterPassword(newPassword);
            setPasswordSuccess('alerts.password_changed_success');
            resetPasswordChangeState();
        } catch (error) {
            console.error("Failed to change master password", error);
            setPasswordError('An unexpected error occurred.');
        }
    };
    
    // --- IMPORT/EXPORT LOGIC ---
    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleConfirmPlainText = () => {
        const data = JSON.stringify(accounts, null, 2);
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, 'authenticator_backup.txt');
        setExportStage('idle');
    };

    const handleConfirmEncrypted = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!encryptionPassword) return;
        
        setIsGenerating(true);
        try {
            const data = JSON.stringify(accounts);
            const encryptedData = cryptoService.encrypt(data, encryptionPassword);
            const blob = new Blob([encryptedData], { type: 'text/plain;charset=utf-8' });
            downloadBlob(blob, 'authenticator_backup_encrypted.enc');
        } catch (err) {
            console.error("Failed to create encrypted export", err);
            alert(t('alerts.export_failed'));
        } finally {
            setIsGenerating(false);
            setExportStage('idle');
            setEncryptionPassword('');
        }
    };
    
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        setImportError(null);
        
        if (file.name.endsWith('.zip')) {
            resetImportFlow();
            setImportError('errors.import_invalid_json');
            return;
        } else if (file.name.endsWith('.enc')) {
            setImportStage('password');
            return;
        } else if (file.name.startsWith('otpauth-migration')) {
            // Handle Google Authenticator migration file
            setImportStage('password');
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    // Check if the content is a Google Auth migration URI
                    if (content.startsWith('otpauth-migration://offline?data=')) {
                        setImportFile(new File([content], 'otpauth-migration', { type: 'text/plain' }));
                        setImportStage('password');
                        return;
                    }
                    
                    const parsedAccounts = JSON.parse(content) as Account[];
                    // set import data and move to confirm stage to show shared ImportConfirmModal
                    setImportData(parsedAccounts);
                    setImportStage('confirm_action');
                } catch (err) {
                    console.error('Failed to parse import file:', err);
                    setImportError('errors.import_invalid_json');
                    resetImportExportState();
                }
            };
            reader.readAsText(file);
        }
    };

    const handleImportPasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!importFile) return;

        setImportIsLoading(true);
        setImportError(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const rawResult = event.target?.result;
                const textContent = typeof rawResult === 'string'
                    ? rawResult
                    : new TextDecoder().decode(rawResult as ArrayBuffer);

                if (importFile.name.startsWith('otpauth-migration')) {
                    if (textContent.startsWith('otpauth-migration://offline?data=')) {
                        const accounts = await parseMigrationUri(textContent);
                        if (accounts.length > 0) {
                            const mapAlgo = (a: number) => {
                                switch(a) {
                                    case 2: return 'SHA256';
                                    case 3: return 'SHA512';
                                    case 4: return 'MD5';
                                    default: return 'SHA1';
                                }
                            };
                            const accountsWithIds = accounts.map(acc => ({
                                ...acc,
                                id: Math.random().toString(36).substr(2, 9),
                                accountName: acc.name || '',
                                algorithm: mapAlgo(acc.algorithm),
                            }));
                            setImportData(accountsWithIds);
                            setImportStage('confirm_action');
                            return;
                        }
                        throw new Error('No accounts found in migration data');
                    }
                    throw new Error('Invalid migration data');
                }

                const trimmedContent = textContent.trim();
                if (!trimmedContent) {
                    throw new Error('Empty encrypted content');
                }

                const accountsJson = cryptoService.decrypt(trimmedContent, importPassword);
                const parsedAccounts = JSON.parse(accountsJson) as Account[];
                // set import data and move to confirm stage to show shared ImportConfirmModal
                setImportData(parsedAccounts);
                setImportStage('confirm_action');
            } catch (err) {
                console.error('Import/decryption failed:', err);
                setImportError('errors.import_decryption_failed');
                setImportPassword('');
            } finally {
                setImportIsLoading(false);
            }
        };
        reader.readAsText(importFile);
    };

    const executeImport = (mode: 'merge' | 'overwrite', accountsParam?: Account[]) => {
        const data = accountsParam ?? importData;
        if (!data) {
            setImportError('errors.import_invalid_json');
            return;
        }

        let finalAccounts = [...accounts];

        // compute summary for toast/callback: added & skipped
        const getAccountKey = (acc: Account) => {
            const base = `${(acc.issuer || '').trim().toLowerCase()}|${(acc.accountName || '').trim().toLowerCase()}|${(acc.secret || '').trim()}`;
            const advanced = `|${acc.period || 30}|${acc.algorithm || 'SHA1'}|${acc.digits || 6}`;
            return base + advanced;
        };
        if (mode === 'overwrite') {
            // deduplicate incoming
            const seen = new Map<string, Account>();
            const deduped: Account[] = [];
            data.forEach(acc => {
                const k = getAccountKey(acc);
                if (!seen.has(k)) {
                    seen.set(k, acc);
                    deduped.push(acc);
                }
            });
            finalAccounts = deduped;
            const added = deduped.length;
            const skipped = data.length - deduped.length;
            updateAccounts(finalAccounts);
            onClose();
            return { added, skipped };
        } else { // Merge
            const existingKeys = new Set(accounts.map(getAccountKey));
            const newAccounts = data.filter(acc => !existingKeys.has(getAccountKey(acc)));
            finalAccounts.push(...newAccounts);
            const added = newAccounts.length;
            const skipped = data.length - newAccounts.length;
            updateAccounts(finalAccounts);
            onClose();
            return { added, skipped };
        }
    };

    // use shared showToast from components/Toast

    const renderChangePasswordTab = () => (
        <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 pt-4">
             <div>
                <label htmlFor="current-password"
                       className="block text-sm font-medium text-muted">{t('modals.current_password_label')}</label>
                <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="mt-1 w-full themed-input px-4 py-2"
                    required
                    autoFocus
                />
            </div>
            <div>
                <label htmlFor="new-password"
                       className="block text-sm font-medium text-muted">{t('modals.new_password_label')}</label>
                <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 w-full themed-input px-4 py-2"
                    required
                />
            </div>
            <div>
                <label htmlFor="confirm-new-password"
                       className="block text-sm font-medium text-muted">{t('modals.confirm_new_password_label')}</label>
                <input
                    id="confirm-new-password"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="mt-1 w-full themed-input px-4 py-2"
                    required
                />
            </div>

            {passwordError && <p className="text-red-400 text-sm">{t(passwordError)}</p>}
            {passwordSuccess && <p className="text-green-400 text-sm">{t(passwordSuccess)}</p>}

            <div className="flex justify-end pt-2">
                 <button type="submit" className="px-4 py-2 rounded-lg themed-btn themed-btn-primary">
                    {t('modals.change_password_button')}
                </button>
            </div>
        </form>
    );

    const renderImportExportTab = () => (
        <div className="space-y-6 pt-4">
            {/* EXPORT */}
            <div>
                <h3 className="text-lg font-semibold text-primary mb-2">{t('modals.export_title')}</h3>
                <p className="text-sm text-muted mb-4">{t('modals.export_subtitle')}</p>
                 {exportStage === 'idle' && (
                    <div className="space-y-2">
                        <div className="flex space-x-4">
                            <button onClick={() => setExportStage('confirm_plain')} className="flex-1 w-full px-4 py-2 rounded-lg themed-btn themed-btn-warning text-sm">{t('modals.export_plain_button')}</button>
                            <button onClick={() => setExportStage('prompt_encrypted')} className="flex-1 w-full px-4 py-2 rounded-lg themed-btn themed-btn-primary text-sm">{t('modals.export_encrypted_button')}</button>
                        </div>
                        <button onClick={() => setGoogleAuthExportOpen(true)} className="w-full px-4 py-2 rounded-lg themed-btn themed-btn-secondary text-sm">{t('modals.export_google_auth_button')}</button>
                    </div>
                )}
                {exportStage === 'confirm_plain' && (
                    <div className="themed-card themed-card-warning">
                        <p className="text-sm font-medium text-warning-strong">{t('modals.export_plain_warning')}</p>
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setExportStage('idle')} className="px-4 py-2 rounded-lg themed-btn themed-btn-secondary text-sm">{t('modals.cancel_button')}</button>
                            <button onClick={handleConfirmPlainText} className="px-4 py-2 rounded-lg themed-btn themed-btn-warning text-sm">{t('modals.confirm_export_button')}</button>
                        </div>
                    </div>
                )}
                 {exportStage === 'prompt_encrypted' && (
                    <form onSubmit={handleConfirmEncrypted} className="themed-card space-y-4">
                        <div>
                            <label htmlFor="encryption-password" className="block text-sm font-medium text-muted mb-2">{t('modals.encryption_password_label')}</label>
                            <input id="encryption-password" type="password" value={encryptionPassword} onChange={(e) => setEncryptionPassword(e.target.value)} className="w-full themed-input px-4 py-2" placeholder={t('modals.encryption_password_placeholder')} autoFocus/>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button type="button" onClick={() => setExportStage('idle')} className="px-4 py-2 rounded-lg themed-btn themed-btn-secondary text-sm">{t('modals.cancel_button')}</button>
                            <button type="submit" disabled={isGenerating || !encryptionPassword} className="px-4 py-2 rounded-lg themed-btn themed-btn-primary text-sm">{isGenerating ? t('modals.generating_button') : t('modals.generate_and_download_button')}</button>
                        </div>
                    </form>
                )}
            </div>

            <div className="border-t border-gray-700"></div>

            {/* IMPORT */}
            <div>
                <h3 className="text-lg font-semibold text-primary mb-2">{t('modals.import_title')}</h3>
                  {importStage === 'select_file' && (
                    <>
                        <p className="text-sm text-muted mb-4">{t('modals.import_subtitle_new')}</p>
                        <label htmlFor="file-import-settings" className="w-full text-center block py-2 px-4 rounded-lg themed-btn themed-btn-secondary text-sm cursor-pointer">{t('modals.import_select_file_button')}</label>
                        <input id="file-import-settings" type="file" className="hidden" onChange={handleFileSelected} accept=".txt,.enc"/>
                    </>
                )}
                {importStage === 'password' && (
                    <form onSubmit={handleImportPasswordSubmit} className="themed-card space-y-4">
                        <p className="text-sm text-muted">{t('modals.import_file_selected', { fileName: importFile?.name })}</p>
                        <div>
                            <label htmlFor="import-password" className="block text-sm font-medium text-muted mb-2">{t('prompts.import_password')}</label>
                            <input id="import-password" type="password" value={importPassword} onChange={(e) => setImportPassword(e.target.value)} className="w-full themed-input px-4 py-2" autoFocus />
                        </div>
                        {importError && <p className="text-red-400 text-sm">{t(importError)}</p>}
                        <div className="flex justify-end space-x-3">
                            <button type="button" onClick={resetImportFlow} className="px-4 py-2 rounded-lg themed-btn themed-btn-secondary text-sm">{t('modals.cancel_button')}</button>
                            <button type="submit" disabled={importIsLoading || !importPassword} className="px-4 py-2 rounded-lg themed-btn themed-btn-primary text-sm">{importIsLoading ? t('modals.generating_button') : t('modals.import_unlock_button')}</button>
                        </div>
                    </form>
                )}
                {/* confirm_action stage removed: imports are executed immediately (merge) without extra prompt */}
            </div>
        </div>
    );

    return (
      <>
        <BaseModal isOpen={isOpen} onClose={onClose} title={t('modals.settings_title')}>
            <div className="border-b border-muted">
                <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('password')}
                        className={`whitespace-nowrap flex items-center space-x-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'password' ? 'border-blue-500 text-blue-400' : 'border-transparent text-muted'}`}
                    >
                        <FiKey className="w-5 h-5" />
                        <span>{t('modals.change_password_tab')}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('import_export')}
                        className={`whitespace-nowrap flex items-center space-x-2 py-3 px-3 border-b-2 font-medium text-sm transition-colors ${activeTab === 'import_export' ? 'border-blue-500 text-blue-400' : 'border-transparent text-muted'}`}
                    >
                        <FiRefreshCw className="w-5 h-5" />
                        <span>{t('modals.import_export_tab')}</span>
                    </button>
                </nav>
            </div>
            {activeTab === 'password' ? renderChangePasswordTab() : renderImportExportTab()}
        </BaseModal>
        {isGoogleAuthExportOpen && (
            <Suspense fallback={null}>
                <GoogleAuthenticatorExportModal 
                    isOpen={isGoogleAuthExportOpen} 
                    onClose={() => setGoogleAuthExportOpen(false)} 
                    accounts={accounts} 
                />
            </Suspense>
        )}
                <ImportConfirmModal
                    isOpen={showImportConfirmModal}
                    onClose={() => resetImportFlow()}
                    count={importData ? importData.length : 0}
                    initialMode={'merge'}
                    onConfirm={(mode) => {
                        const dataSnapshot = importData ? [...importData] : undefined;
                        resetImportFlow();
                        const summary = executeImport(mode, dataSnapshot);
                        if (mode === 'merge' && summary) {
                            addToast(`Imported: ${summary.added} added, ${summary.skipped} skipped`);
                        }
                    }}
                />
      </>
    );
};

export default SettingsModal;