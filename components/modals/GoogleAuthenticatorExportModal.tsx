import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Account } from '../../types';
import BaseModal from './BaseModal';
import { useI18n } from '../../hooks/useI18n';
import protobuf from '../../libs/protobufjs';
import QRCode from '../../libs/qrcode';

interface GoogleAuthenticatorExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    accounts: Account[];
}

const base32Decode = (base32: string): Uint8Array => {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanBase32 = base32.toUpperCase().replace(/=/g, '');
    
    let bits = '';
    for (let i = 0; i < cleanBase32.length; i++) {
        const charIndex = base32Chars.indexOf(cleanBase32[i]);
        if (charIndex === -1) {
            throw new Error('Invalid base32 character');
        }
        bits += charIndex.toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        const chunk = bits.slice(i, i + 8);
        if (chunk.length === 8) {
            bytes.push(parseInt(chunk, 2));
        }
    }
    return new Uint8Array(bytes);
};
const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};


const GoogleAuthenticatorExportModal: React.FC<GoogleAuthenticatorExportModalProps> = ({ isOpen, onClose, accounts }) => {
    const { t } = useI18n();
    const qrCodeContainerRef = useRef<HTMLDivElement>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const generateQrCode = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        // reset previous QR data url (React will update DOM)
        setQrDataUrl(null);

        try {
            const proto = `
            message OtpParameters {
              optional bytes secret = 1;
              optional string name = 2;
              optional string issuer = 3;
              optional int32 algorithm = 4;
              optional int32 digits = 5;
              optional int32 type = 6;
              optional int64 counter = 7;
            }
            message MigrationPayload {
              repeated OtpParameters otp_parameters = 1;
              optional int32 version = 2;
              optional int32 batch_size = 3;
              optional int32 batch_index = 4;
              optional int32 batch_id = 5;
            }`;
            
            const root = protobuf.parse(proto).root;
            const MigrationPayload = root.lookupType("MigrationPayload");
            
            const otpParameters = accounts.map(account => ({
                secret: base32Decode(account.secret),
                name: account.accountName,
                issuer: account.issuer,
                algorithm: 1, // SHA1
                digits: 1, // 6 digits
                type: 2, // TOTP
            }));
            
            const payload = {
                otpParameters,
                version: 1,
                batchSize: 1,
                batchIndex: 0,
                batchId: Math.floor(Math.random() * 2147483647),
            };

            const errMsg = MigrationPayload.verify(payload);
            if (errMsg) throw Error(errMsg);

            const message = MigrationPayload.create(payload);
            const buffer = MigrationPayload.encode(message).finish();
            const base64Payload = uint8ArrayToBase64(buffer);
            const uri = `otpauth-migration://offline?data=${encodeURIComponent(base64Payload)}`;
            
                if (!QRCode || !QRCode.Encode) {
                    setError('errors.qr_library_load_failed');
                    setIsLoading(false);
                    return;
                }
                const dataUrl = await QRCode.Encode({
                    text: uri,
                    width: 320,
                    height: 320,
                    correctLevel: 'M',
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                // set data URL into React state so React owns the DOM
                setQrDataUrl(dataUrl);
        } catch(e: any) {
            console.error("Failed to generate Google Authenticator payload:", e);
            setError('errors.export_data_error');
        } finally {
            setIsLoading(false);
        }
    }, [accounts, t]);

    useEffect(() => {
        if (isOpen) {
            generateQrCode();
        }
    }, [isOpen, generateQrCode]);

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={t('modals.export_google_auth_title')}>
            <div className="space-y-4 text-center">
                <div ref={qrCodeContainerRef} className="w-full aspect-square themed-card flex items-center justify-center mx-auto max-w-[320px]">
                    {isLoading && <p className="text-muted">{t('modals.generating_button')}</p>}
                    {error && !isLoading && (
                         <div className="text-center">
                            <p className="text-danger font-medium p-4 text-sm">{t(error)}</p>
                        </div>
                    )}
                    {!isLoading && !error && qrDataUrl && (
                        // Render the generated QR image via React (avoid direct DOM manipulations)
                        <img src={qrDataUrl} alt="qr" style={{ maxWidth: '100%', height: 'auto' }} />
                    )}
                </div>
             <div className="alert-primary">
                 <p className="text-sm">{t('modals.export_google_auth_instructions')}</p>
             </div>
              <div className="alert-critical">
                 <p className="text-sm font-semibold tracking-wide">{t('modals.export_google_auth_warning')}</p>
             </div>
            </div>
        </BaseModal>
    );
};
;

export default GoogleAuthenticatorExportModal;
