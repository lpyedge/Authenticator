import React, { useEffect } from 'react';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

const OVERLAY_ID = 'global-modal-overlay';

const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children }) => {
    useEffect(() => {
        if (!isOpen) return;

        // track mounted modals globally to ensure only one overlay element exists
        const w: any = window as any;
        w.__modalCount = (w.__modalCount || 0) + 1;

        if (w.__modalCount === 1) {
            let overlay = document.getElementById(OVERLAY_ID);
            const isDark = document.documentElement.classList.contains('dark');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = OVERLAY_ID;
                overlay.style.position = 'fixed';
                overlay.style.inset = '0';
                overlay.style.zIndex = '49';
                overlay.style.transition = 'opacity 0.2s';
                document.body.appendChild(overlay);
            }
            // ensure overlay reflects current theme even if it existed
            overlay.style.backgroundColor = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.35)';
        }

        return () => {
            const ww: any = window as any;
            ww.__modalCount = (ww.__modalCount || 1) - 1;
            if (ww.__modalCount <= 0) {
                const overlay = document.getElementById(OVERLAY_ID);
                if (overlay) overlay.remove();
                ww.__modalCount = 0;
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 flex justify-center items-center z-50 transition-opacity"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                className="rounded-xl shadow-lg w-full max-w-md m-4 p-6 transform transition-all"
                style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 id="modal-title" className="text-xl font-bold" style={{ color: 'rgb(var(--text-primary))' }}>{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="text-3xl leading-none hover:opacity-80 transition-opacity" 
                        style={{ color: 'rgb(var(--text-secondary))' }}
                        aria-label="Close modal"
                    >
                        &times;
                    </button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

export default BaseModal;