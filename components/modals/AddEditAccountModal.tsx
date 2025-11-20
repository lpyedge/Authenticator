import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Account } from '../../types';
import BaseModal from './BaseModal';
import ImportConfirmModal from './ImportConfirmModal';
import { ParsedOtpParameters } from '../../libs/migration';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../Toast';
import { URI } from '../../libs/otpauth';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';

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
    const showImportSummaryToast = (added: number, skipped: number) => {
        const fallback = `Imported: ${added} added, ${skipped} skipped`;
        addToast(t('alerts.import_summary', { added, skipped }) || fallback);
    };
    
    const [manualIssuer, setManualIssuer] = useState('');
    const [manualAccountName, setManualAccountName] = useState('');
    const [manualSecret, setManualSecret] = useState('');
    const [manualPeriod, setManualPeriod] = useState(30);
    const [manualAlgorithm, setManualAlgorithm] = useState('SHA1');
    const [manualDigits, setManualDigits] = useState(6);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [uriInput, setUriInput] = useState('');
    const [parsedUriData, setParsedUriData] = useState<{ issuer: string; accountName: string; secret: string; period?: number; algorithm?: string; digits?: number } | null>(null);
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
            setManualPeriod(account.period || 30);
            setManualAlgorithm(account.algorithm || 'SHA1');
            setManualDigits(account.digits || 6);
        } else { // Add mode
            setManualIssuer('');
            setManualAccountName('');
            setManualSecret('');
            setManualPeriod(30);
            setManualAlgorithm('SHA1');
            setManualDigits(6);
        }
        setShowAdvanced(false);
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
                // Cast to any to access properties that might not be in the type definition but exist in the object
                const parsedAny = parsed as any;
                setParsedUriData({
                    issuer: parsed.issuer,
                    accountName: parsed.label,
                    secret: secretBase32,
                    period: parsedAny.period,
                    algorithm: parsedAny.algorithm,
                    digits: parsedAny.digits
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
    const currentPeriod = isUriActive ? (parsedUriData?.period || 30) : manualPeriod;
    const currentAlgorithm = isUriActive ? (parsedUriData?.algorithm || 'SHA1') : manualAlgorithm;
    const currentDigits = isUriActive ? (parsedUriData?.digits || 6) : manualDigits;

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
                    setManualPeriod(first.period || 30);
                    setManualAlgorithm(first.algorithm || 'SHA1');
                    setManualDigits(first.digits || 6);
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
            period: p.period,
            algorithm: p.algorithm,
            digits: p.digits
        }));

    // use shared showToast
        if (onImportAccounts) {
            // call parent and receive summary via callback
            onImportAccounts(accountsToImport, mode, (summary) => {
                if (mode === 'merge') {
                    showImportSummaryToast(summary.added, summary.skipped);
                }
            });
        } else {
            // Fallback: call onSave for each account (acts like merge)
            accountsToImport.forEach(acc => onSave(acc));
            if (mode === 'merge') {
                showImportSummaryToast(accountsToImport.length, 0);
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
                period: manualPeriod,
                algorithm: manualAlgorithm,
                digits: manualDigits,
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
                period: manualPeriod,
                algorithm: manualAlgorithm,
                digits: manualDigits,
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
                            className="mt-1 form-input"
                            placeholder={t('modals.issuer_placeholder')}
                            disabled={isUriActive}
                        />
                    </div>
                    <div>
                        <label htmlFor="accountName" className="form-label">{t('modals.account_name_label')}</label>
                        <input
                            id="accountName"
                            type="text"
                            value={currentAccountName}
                            onChange={(e) => setManualAccountName(e.target.value)}
                            className="mt-1 form-input"
                            placeholder={t('modals.account_name_placeholder')}
                            disabled={isUriActive}
                        />
                    </div>
                    
                    {!isEditMode && (
                        <div>
                            <label htmlFor="secret" className="form-label">{t('modals.secret_key_label')}</label>
                            <input
                                id="secret"
                                type="text"
                                value={currentSecret}
                                onChange={(e) => setManualSecret(e.target.value)}
                                className="mt-1 form-input"
                                placeholder={t('modals.secret_key_placeholder')}
                                disabled={isUriActive}
                            />
                        </div>
                    )}

                    {/* Advanced Options Section */}
                    {!isEditMode && (
                        <div className="border rounded-md p-2 bg-gray-50 dark:bg-gray-800">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 focus:outline-none"
                            >
                                <span>{t('modals.advanced_options')}</span>
                                {showAdvanced ? <FiChevronDown /> : <FiChevronRight />}
                            </button>
                            
                            {showAdvanced && (
                                <div className="mt-3 space-y-3 pl-1">
                                    <div>
                                        <label htmlFor="period" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {t('modals.period_label')}
                                        </label>
                                        <input
                                            id="period"
                                            type="number"
                                            value={currentPeriod}
                                            onChange={(e) => setManualPeriod(parseInt(e.target.value) || 30)}
                                            className="mt-1 form-input text-sm py-1"
                                            min="1"
                                            disabled={isUriActive}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">{t('modals.period_help')}</p>
                                    </div>

                                    <div>
                                        <label htmlFor="algorithm" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {t('modals.algorithm_label')}
                                        </label>
                                        <select
                                            id="algorithm"
                                            value={currentAlgorithm}
                                            onChange={(e) => setManualAlgorithm(e.target.value)}
                                            className="mt-1 form-input text-sm py-1"
                                            disabled={isUriActive}
                                        >
                                            <option value="SHA1">SHA1</option>
                                            <option value="SHA256">SHA256</option>
                                            <option value="SHA512">SHA512</option>
                                        </select>
                                        <p className="text-xs text-gray-400 mt-1">{t('modals.algorithm_help')}</p>
                                    </div>

                                    <div>
                                        <label htmlFor="digits" className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                                            {t('modals.digits_label')}
                                        </label>
                                        <input
                                            id="digits"
                                            type="number"
                                            value={currentDigits}
                                            onChange={(e) => setManualDigits(parseInt(e.target.value) || 6)}
                                            className="mt-1 form-input text-sm py-1"
                                            min="6"
                                            max="8"
                                            disabled={isUriActive}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">{t('modals.digits_help')}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}                    {!isEditMode && (
                        <>
                            <div className="relative flex items-center my-4">
                                <div className="flex-grow divider-line"></div>
                                <span className="flex-shrink mx-4 text-caption">{t('modals.or_divider')}</span>
                                <div className="flex-grow divider-line"></div>
                            </div>
                            <div className="mb-4">
                                <textarea
                                    value={uriInput}
                                    onChange={(e) => setUriInput(e.target.value)}
                                    className="mt-1 form-input text-sm"
                                    placeholder={t('modals.uri_placeholder')}
                                    rows={2}
                                />
                            </div>
                            <button type="button" onClick={() => setScanModalOpen(true)} className="w-full btn btn-secondary">
                                {t('modals.scan_qr_button')}
                            </button>
                        </>
                    )}

                    {(formError || uriError) && <p className="text-red-500 text-sm mt-2">{formError || uriError}</p>}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            {t('modals.cancel_button')}
                        </button>
                        <button type="submit" disabled={isSaveDisabled} className="btn btn-primary">
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