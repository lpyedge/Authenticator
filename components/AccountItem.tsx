import React, { useState, useRef, useEffect } from 'react';
import { Account } from '../types';
import { useTOTP } from '../hooks/useTOTP';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ACTIONS_WIDTH = 144; // 2 buttons * 72px width
const SWIPE_THRESHOLD = 60; // minimum swipe distance to trigger action

interface AccountItemProps {
    account: Account;
    onEdit: (account: Account) => void;
    onRequestDelete: (account: Account) => void;
    reorderMode?: boolean;
    isOverlay?: boolean;
    onRequestReorderMode?: () => void;
}

const formatToken = (token: string) => {
    if (token.length === 6) {
        return `${token.slice(0, 3)} ${token.slice(3, 6)}`;
    }
    if (token.length === 8) {
        return `${token.slice(0, 4)} ${token.slice(4, 8)}`;
    }
    return token;
};

const AccountItem: React.FC<AccountItemProps> = ({ account, onEdit, onRequestDelete, reorderMode = false, isOverlay = false, onRequestReorderMode }) => {
    const { t } = useI18n();
    const { token, remainingTime, progress, isTokenValid } = useTOTP(account.secret, account.period, account.algorithm, account.digits);
    const [copied, setCopied] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // DnD Kit
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: account.id, 
        disabled: isOverlay,
        data: { type: 'Account', account }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        zIndex: isDragging ? 100 : 'auto',
    };

    const progressPercentage = progress;
    const circumference = 2 * Math.PI * 8;
    const dashOffset = circumference * (1 - progressPercentage / 100);
    const progressCircleClass = remainingTime === (account.period || 30) ? 'otp-progress-circle no-transition' : 'otp-progress-circle';
    const tokenColorClass = isTokenValid ? 'text-accent-color' : 'text-error-color';
    const timerToneClass = !isTokenValid
        ? ''
        : remainingTime <= 5
            ? 'otp-timer-critical'
            : remainingTime <= 10
                ? 'otp-timer-warning'
                : 'otp-timer-normal';

    const handleCopy = () => {
        if (!isTokenValid || reorderMode) return;
        const value = token.replace(/\s/g, '');
        void navigator.clipboard.writeText(value)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
    };

    // Swipe Handlers
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (reorderMode) return; 
        if (e.button !== 0) return;
        
        longPressTimer.current = setTimeout(() => {
            onRequestReorderMode?.();
        }, 500);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (reorderMode) return;
        if (longPressTimer.current) {
            // If moved significantly, cancel long press
            // We don't track startX/Y here for swipe anymore, just for cancelling long press
        }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (reorderMode) return;
        
        const isCopyTarget = (e.target as HTMLElement).closest('[data-copy-token]');
        if (isCopyTarget) handleCopy();
    };
    
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...(reorderMode ? listeners : {})}
            className={`relative account-card overflow-hidden w-full select-none group-drop-source border-0 ${reorderMode ? 'jiggle' : ''} ${isDragging ? 'account-item-placeholder' : ''}`}
            onPointerDown={reorderMode ? listeners?.onPointerDown : handlePointerDown}
            onPointerMove={reorderMode ? listeners?.onPointerMove : handlePointerMove}
            onPointerUp={reorderMode ? listeners?.onPointerUp : handlePointerUp}
            onPointerCancel={reorderMode ? listeners?.onPointerCancel : handlePointerUp}
        >
            <div
                className="relative w-full p-0 z-10 bg-[rgb(var(--bg-secondary))]"
            >
                <div className="account-card-content p-2">
                    <div className="flex items-start gap-3">
                        <p className="text-subtitle truncate flex-1 min-w-0">{account.issuer}</p>
                        <p className="text-caption truncate text-right opacity-80 ml-auto max-w-[60%] min-w-0">{account.accountName}</p>
                    </div>
                    <div className="relative mt-2">
                        <div
                            className={`token-copy flex items-center ${isTokenValid && !reorderMode ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                            title={isTokenValid ? t('account_item.click_to_copy') : ''}
                            data-copy-token
                        >
                            <p className={`text-3xl font-mono tracking-wider ${tokenColorClass}`}>
                                {isTokenValid ? formatToken(token) : token}
                            </p>
                            {copied && (
                                <span className="token-copy-badge badge-success" role="alert" aria-live="polite">
                                    {t('account_item.copied')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {isTokenValid && (
                    <div className={`otp-timer ${timerToneClass}`} aria-hidden="true">
                        <svg className="otp-timer-ring" viewBox="0 0 20 20">
                            <circle className="otp-progress-bg" strokeWidth="2.25" r="8" cx="10" cy="10" fill="transparent" />
                            <circle
                                className={`${progressCircleClass} otp-progress-ring`}
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                strokeWidth="2.25"
                                r="8"
                                cx="10"
                                cy="10"
                                fill="transparent"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="otp-timer-value">{remainingTime}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountItem;
