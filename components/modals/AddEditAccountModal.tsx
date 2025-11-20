import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Account } from '../../types';
import BaseModal from './BaseModal';
import ImportConfirmModal from './ImportConfirmModal';
import { ParsedOtpParameters } from '../../libs/migration';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../Toast';
import { URI } from '../../libs/otpauth';

const ScanQRModal = lazy(() => import('./ScanQRModal'));

interface AddEditAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (account: Account | Omit<Account, 'id'>) => void;
    account: Account | null;
    // Optional handler for importing multiple accounts at once.
    // If provided, may accept an optional callback to receive a summary { added, skipped }.
    onImportAccounts?: (accounts: Omit<Account, 'id'>[], mode: 'merge' | 'overwrite', cb?: (summary: { added: number; skipped: number }) => void) => void;
}

const preprocessOtpAuthUri = (uri: string): string => {
    try {
        const url = new URL(uri);
        const issuerParam = url.searchParams.get('issuer');
        let labelFromPath = decodeURIComponent(url.pathname);
        if (labelFromPath.startsWith('/')) {
            labelFromPath = labelFromPath.substring(1);
        }
        if (issuerParam && labelFromPath.startsWith(issuerParam + ':')) {
            const accountName = labelFromPath.substring(issuerParam.length + 1);
            url.pathname = `/${encodeURIComponent(accountName.trim())}`;
            return url.toString();
        }
        return uri;
    } catch (e) {
        return uri;
    }
};


const AddEditAccountModal: React.FC<AddEditAccountModalProps> = ({ isOpen, onClose, onSave, account, onImportAccounts }) => {
    const { t } = useI18n();
    const isEditMode = account !== null;
    const addToast = useToast();
    
    const [manualIssuer, setManualIssuer] = useState('');
    const [manualAccountName, setManualAccountName] = useState('');
    const [manualSecret, setManualSecret] = useState('');
    const [uriInput, setUriInput] = useState('');
    const [parsedUriData, setParsedUriData] = useState<{ issuer: string; accountName: string; secret: string } | null>(null);
    const [uriError, setUriError] = useState('');
    const [formError, setFormError] = useState('');
    const [isScanModalOpen, setScanModalOpen] = useState(false);
    const [pendingImportAccounts, setPendingImportAccounts] = useState<ParsedOtpParameters[] | null>(null);
    const [showImportConfirm, setShowImportConfirm] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        if (account) { // Edit mode
            setManualIssuer(account.issuer);
            setManualAccountName(account.accountName);
            setManualSecret(account.secret);
        } else { // Add mode
            setManualIssuer('');
            setManualAccountName('');
            setManualSecret('');
        }
        setUriInput('');
        setParsedUriData(null);
        setUriError('');
        setFormError('');
    }, [account, isOpen]);

    useEffect(() => {
        if (isEditMode) return; // Don't parse URI in edit mode

        setUriError('');
        setFormError('');
        const trimmedUri = (typeof uriInput === 'string' ? uriInput.trim() : '');

        if (trimmedUri === '') {
            setParsedUriData(null);
            return;
        }

        if (!trimmedUri.toLowerCase().startsWith('otpauth://')) {
            setUriError(t('errors.invalid_uri'));
            setParsedUriData(null);
            return;
        }
        
        const processedUri = preprocessOtpAuthUri(trimmedUri);
        try {
            const parsed = URI.parse(processedUri);
            const secretBase32 = parsed.secret ? parsed.secret.base32 : '';

            if (!parsed.issuer || !parsed.label || !secretBase32) {
                setUriError(t('errors.invalid_uri'));
                setParsedUriData(null);
            } else {
                setParsedUriData({
                    issuer: parsed.issuer,
                    accountName: parsed.label,
                    secret: secretBase32
                });
            }
        } catch (e) {
            console.error("URI parsing error:", e, "URI:", processedUri);
            setUriError(t('errors.invalid_uri'));
            setParsedUriData(null);
        }
    }, [uriInput, t, isEditMode]);

    const isUriActive = (typeof uriInput === 'string' ? uriInput.trim() !== '' : false) && !isEditMode;
    const currentIssuer = isUriActive ? (parsedUriData?.issuer || '') : manualIssuer;
    const currentAccountName = isUriActive ? (parsedUriData?.accountName || '') : manualAccountName;
    const currentSecret = isUriActive ? (parsedUriData?.secret || '') : manualSecret;

    const handleScanSuccess = (result: any) => {
        // ScanQRModal may return either a string (uri) or an array of parsed migration accounts.
        try {
            if (Array.isArray(result)) {
                if (result.length === 1) {
                    // Single parsed account: populate manual fields
                    const first = result[0];
                    setManualIssuer(String(first.issuer || first.name || ''));
                    setManualAccountName(String(first.name || ''));
                    setManualSecret(String(first.secret || '').replace(/\s/g, '').toUpperCase());
                } else if (result.length > 1) {
                    // Multiple accounts: ask user with the shared ImportConfirmModal
                    setPendingImportAccounts(result as ParsedOtpParameters[]);
                    setShowImportConfirm(true);
                }
            } else if (typeof result === 'string' && result) {
                setUriInput(String(result));
            }
        } catch (err) {
            console.error('handleScanSuccess error:', err);
        } finally {
            setScanModalOpen(false);
        }
    };

    const performImport = (mode: 'merge' | 'overwrite') => {
        if (!pendingImportAccounts || pendingImportAccounts.length === 0) return;

        const accountsToImport: Omit<Account, 'id'>[] = pendingImportAccounts.map(p => ({
            issuer: p.issuer || '',
            accountName: p.name || '',
            secret: (p.secret || '')
                .toString()
                .replace(/\s/g, '')
                .toUpperCase(),
        }));

    // use shared showToast
        if (onImportAccounts) {
            // call parent and receive summary via callback
            onImportAccounts(accountsToImport, mode, (summary) => {
                if (mode === 'merge') {
                    addToast(`Imported: ${summary.added} added, ${summary.skipped} skipped`);
                }
            });
        } else {
            // Fallback: call onSave for each account (acts like merge)
            accountsToImport.forEach(acc => onSave(acc));
            if (mode === 'merge') {
                addToast(`Imported: ${accountsToImport.length} added, 0 skipped`);
            }
        }

        // Clear pending and close modal
        setPendingImportAccounts(null);
        setShowImportConfirm(false);
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        if (isEditMode) {
            if (!manualIssuer.trim() || !manualAccountName.trim()) {
                setFormError(t('errors.all_fields_required'));
                return;
            }
            const updatedAccount: Account = {
                ...account,
                issuer: manualIssuer.trim(),
                accountName: manualAccountName.trim(),
            };
            onSave(updatedAccount);
            onClose();
            return;
        }

        // --- Add Account Logic ---
        let dataToSave: Omit<Account, 'id'>;
        let secretToValidate: string;

        if (isUriActive) {
            if (uriError) {
                setFormError(uriError);
                return;
            }
            if (!parsedUriData || !parsedUriData.issuer || !parsedUriData.accountName || !parsedUriData.secret) {
                setFormError(t('errors.invalid_uri'));
                return;
            }
            dataToSave = parsedUriData;
            secretToValidate = parsedUriData.secret;
        } else {
            const sanitizedManualSecret = manualSecret.trim().replace(/\s/g, '').toUpperCase();
            if (!manualIssuer.trim() || !manualAccountName.trim() || !sanitizedManualSecret) {
                setFormError(t('errors.all_fields_required'));
                return;
            }
            dataToSave = {
                issuer: manualIssuer.trim(),
                accountName: manualAccountName.trim(),
                secret: sanitizedManualSecret,
            };
            secretToValidate = sanitizedManualSecret;
        }

        const base32Regex = /^[A-Z2-7=]+$/i;
        if (!base32Regex.test(secretToValidate)) {
            setFormError(t('errors.invalid_secret_chars'));
            return;
        }

        onSave(dataToSave);
        onClose();
    };

    const isSaveDisabled = isEditMode
        ? (!manualIssuer.trim() || !manualAccountName.trim())
        : (isUriActive && (uriError !== '' || !parsedUriData)) ||
          (!isUriActive && (!manualIssuer.trim() || !manualAccountName.trim() || !manualSecret.trim())) ||
          !!formError;

    return (
        <>
            <BaseModal isOpen={isOpen} onClose={onClose} title={isEditMode ? t('modals.edit_account_title') : t('modals.add_account_title')}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="issuer" className="block text-sm font-medium text-muted">{t('modals.issuer_label')}</label>
                        <input
                            id="issuer"
                            type="text"
                            value={currentIssuer}
                            onChange={(e) => setManualIssuer(e.target.value)}
                            className="mt-1 w-full themed-input px-4 py-2"
                            placeholder={t('modals.issuer_placeholder')}
                            disabled={isUriActive}
                        />
                    </div>
                    <div>
                        <label htmlFor="accountName" className="block text-sm font-medium text-muted">{t('modals.account_name_label')}</label>
                        <input
                            id="accountName"
                            type="text"
                            value={currentAccountName}
                            onChange={(e) => setManualAccountName(e.target.value)}
                            className="mt-1 w-full themed-input px-4 py-2"
                            placeholder={t('modals.account_name_placeholder')}
                            disabled={isUriActive}
                        />
                    </div>
                    
                    {!isEditMode && (
                        <div>
                            <label htmlFor="secret" className="block text-sm font-medium text-muted">{t('modals.secret_key_label')}</label>
                            <input
                                id="secret"
                                type="text"
                                value={currentSecret}
                                onChange={(e) => setManualSecret(e.target.value)}
                                className="mt-1 w-full themed-input px-4 py-2"
                                placeholder={t('modals.secret_key_placeholder')}
                                disabled={isUriActive}
                            />
                        </div>
                    )}

                    {!isEditMode && (
                        <>
                            <div className="relative flex items-center">
                                <div className="flex-grow divider-line"></div>
                                <span className="flex-shrink mx-4 text-sm text-muted">{t('modals.or_divider')}</span>
                                <div className="flex-grow divider-line"></div>
                            </div>
                            <div>
                                <textarea
                                    value={uriInput}
                                    onChange={(e) => setUriInput(e.target.value)}
                                    className="mt-1 w-full themed-input px-4 py-2 text-sm"
                                    placeholder={t('modals.uri_placeholder')}
                                    rows={2}
                                />
                            </div>
                            <button type="button" onClick={() => setScanModalOpen(true)} className="w-full px-4 py-2 rounded-lg themed-btn themed-btn-secondary">
                                {t('modals.scan_qr_button')}
                            </button>
                        </>
                    )}

                    {(formError || uriError) && <p className="text-red-400 text-sm">{formError || uriError}</p>}
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg themed-btn themed-btn-secondary">
                            {t('modals.cancel_button')}
                        </button>
                        <button type="submit" disabled={isSaveDisabled} className="px-4 py-2 rounded-lg themed-btn themed-btn-primary">
                            {t('modals.save_button')}
                        </button>
                    </div>
                </form>
            </BaseModal>
            {isScanModalOpen && (
                <Suspense fallback={null}>
                    <ScanQRModal isOpen={isScanModalOpen} onClose={handleScanSuccess} />
                </Suspense>
            )}
            {showImportConfirm && pendingImportAccounts && (
                <ImportConfirmModal isOpen={showImportConfirm} onClose={() => { setShowImportConfirm(false); setPendingImportAccounts(null); }} count={pendingImportAccounts.length} onConfirm={(mode) => performImport(mode)} />
            )}
        </>
    );
};

export default AddEditAccountModal;