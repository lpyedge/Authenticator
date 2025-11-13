import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ToastItem = { id: string; message: string };

interface ToastContextValue {
    addToast: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const portalElRef = useRef<HTMLDivElement | null>(null);

    const addToast = useCallback((message: string, duration = 3000) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 8);
        setToasts((t) => [...t, { id, message }]);
        setTimeout(() => {
            setToasts((t) => t.filter(x => x.id !== id));
        }, duration);
    }, []);

    useEffect(() => {
        // create a portal container and append it to the account-list anchor if present,
        // otherwise append to document.body
        const el = document.createElement('div');
        el.setAttribute('data-toast-portal', '1');
        portalElRef.current = el;

        const anchor = document.getElementById('account-list-toast-anchor');
        if (anchor) {
            anchor.appendChild(el);
        } else {
            document.body.appendChild(el);
        }

        return () => {
            const node = portalElRef.current;
            if (node && node.parentNode) node.parentNode.removeChild(node);
            portalElRef.current = null;
        };
    }, []);

    const toastMarkup = (
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', width: '100%', maxWidth: 640 }}>
            {toasts.map(t => (
                <div key={t.id} style={{ pointerEvents: 'auto', background: 'linear-gradient(90deg, #34D399 0%, #06B6D4 100%)', color: '#ffffff', padding: '10px 18px', borderRadius: 10, boxShadow: '0 6px 18px rgba(6,182,212,0.18)', marginTop: 8, maxWidth: 560, wordBreak: 'break-word', fontSize: 14 }}>
                    {t.message}
                </div>
            ))}
        </div>
    );

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {portalElRef.current ? createPortal(toastMarkup, portalElRef.current) : null}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx.addToast;
};
