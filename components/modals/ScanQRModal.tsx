import React, { useRef, useEffect, useState } from 'react';
import BaseModal from './BaseModal';
import { useI18n } from '../../hooks/useI18n';
import QRCode from '../../libs/qrcode';
import { parseMigrationUri, ParsedOtpParameters } from '../../libs/migration';

interface ScanQRModalProps {
    isOpen: boolean;
    onClose: (result: string | null | ParsedOtpParameters[]) => void;
}

const ScanQRModal: React.FC<ScanQRModalProps> = ({ isOpen, onClose }) => {
    const { t } = useI18n();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const animationFrameId = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const isScanning = useRef(false); // Flag to prevent concurrent scans

    const stopAll = () => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
            animationFrameId.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };
    
    const handleClose = async (result: string | null = null) => {
        if (result && result.startsWith('otpauth-migration://offline?data=')) {
            try {
                const accounts = await parseMigrationUri(result);
                stopAll();
                onClose(accounts);
                return;
            } catch (error) {
                console.error('Migration parse error:', error);
                setError(t('errors.invalid_migration_data'));
                return;
            }
        }
        stopAll();
        onClose(result);
    };

    useEffect(() => {
        if (!isOpen) {
            stopAll();
            return;
        }

        const videoElement = videoRef.current;
        const canvasElement = canvasRef.current;
        if (!videoElement || !canvasElement) return;
        const ctx = canvasElement.getContext('2d');
        if (!ctx) return;

        let mounted = true;

        const tick = async () => {
            if (!mounted || !streamRef.current || isScanning.current) {
                if(mounted) animationFrameId.current = requestAnimationFrame(tick);
                return;
            };

            if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                canvasElement.height = videoElement.videoHeight;
                canvasElement.width = videoElement.videoWidth;
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                
                if (QRCode && QRCode.Decode) {
                    isScanning.current = true;
                    try {
                        const result = await QRCode.Decode(canvasElement);
                        if (result && mounted) {
                            handleClose(result);
                            return; // Stop the loop
                        }
                    } catch (err) {
                        // No QR code found, continue scanning
                    } finally {
                        isScanning.current = false;
                    }
                }
            }
            if(mounted) animationFrameId.current = requestAnimationFrame(tick);
        };

        const startCamera = async () => {
            setError(null);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (!mounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                streamRef.current = stream;
                videoElement.srcObject = stream;
                videoElement.setAttribute('playsinline', 'true'); // Required for iOS
                await videoElement.play();
                animationFrameId.current = requestAnimationFrame(tick);
            } catch (err) {
                 console.error('Camera access error:', err);
                 setError(t('errors.camera_permission_denied'));
            }
        };

        startCamera();

        return () => {
            mounted = false;
            stopAll();
        };
    }, [isOpen, onClose, t]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !QRCode || !QRCode.Decode) return;

        setError(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const result = await QRCode.Decode(img);
                    handleClose(result);
                } catch (err) {
                    setError(t('errors.qr_not_found'));
                }
            };
            img.onerror = () => {
                setError(t('errors.qr_not_found'));
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
    };

    return (
        <BaseModal isOpen={isOpen} onClose={() => handleClose(null)} title={t('modals.scan_qr_title')}>
            <div className="space-y-4">
                <div className="relative w-full aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}>
                    <video ref={videoRef} className="w-full h-full object-cover" muted />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3/4 h-3/4 border-4 border-dashed rounded-lg" style={{ borderColor: 'rgba(255,255,255,0.25)' }}></div>
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-center py-2 px-4 rounded-lg themed-btn themed-btn-secondary text-sm"
                >
                    {t('modals.scan_qr_upload_label')}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                />
            </div>
        </BaseModal>
    );
};

export default ScanQRModal;