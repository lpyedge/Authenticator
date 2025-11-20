import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

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
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                className="modal-content transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 id="modal-title" className="text-subtitle">{title}</h2>
                    <button 
                        onClick={onClose} 
                        className="modal-close-btn" 
                        aria-label="Close modal"
                    >
                        <FiX />
                    </button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

export default BaseModal;