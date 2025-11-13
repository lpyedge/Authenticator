import React, { useState, useRef, useEffect } from 'react';
import { Account } from '../types';
import { useTOTP } from '../hooks/useTOTP';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useI18n } from '../hooks/useI18n';
import { useSortableContext } from './sortable/SortableProvider';

const ACTIONS_WIDTH = 144; // 2 buttons * 72px width
const SWIPE_THRESHOLD = 60; // minimum swipe distance to trigger action
const LONG_PRESS_DELAY = 280;

interface AccountItemProps {
    account: Account;
    onEdit: (account: Account) => void;
    onRequestDelete: (account: Account) => void;
    reorderMode?: boolean;
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

const AccountItem: React.FC<AccountItemProps> = ({ account, onEdit, onRequestDelete, reorderMode = false }) => {
    const { token, timeLeft } = useTOTP(account.secret);
    const [copied, setCopied] = useState(false);
    const { t } = useI18n();
    const { startDragSession, updateDragTarget, completeDragSession, cancelDragSession } = useSortableContext();

    const [translateX, setTranslateX] = useState(0);
    const itemRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef({
        isSwipeActive: false,
        startX: 0,
        startY: 0,
        initialTranslateX: 0,
        velocity: 0,
        lastClientX: 0,
        lastClientY: 0,
    });
    const longPressTimer = useRef<number | null>(null);
    const pointerIdRef = useRef<number | null>(null);
    const globalPointerMoveRef = useRef<((event: PointerEvent) => void) | null>(null);
    const globalPointerUpRef = useRef<((event: PointerEvent) => void) | null>(null);
    const downTimeRef = useRef<number>(0);
    const pointerDownTargetRef = useRef<'copy' | null>(null);
    
    // Drag state machine: 'idle' | 'pending' | 'dragging' | 'dropping'
    const dragStateEnum = useRef<'idle' | 'pending' | 'dragging' | 'dropping'>('idle');
    const currentDropTargetRef = useRef<string | null>(null);
    const lastValidTargetRef = useRef<string | null>(null); // Preserve last valid target for drop
    const dragStartPosRef = useRef({ x: 0, y: 0 });
    
    const [isDragging, setIsDragging] = useState(false);
    const [isSwiping, setIsSwiping] = useState(false);

    const detachGlobalPointerListeners = () => {
        if (globalPointerMoveRef.current) {
            window.removeEventListener('pointermove', globalPointerMoveRef.current);
            globalPointerMoveRef.current = null;
        }
        if (globalPointerUpRef.current) {
            window.removeEventListener('pointerup', globalPointerUpRef.current);
            globalPointerUpRef.current = null;
        }
    };

    useEffect(() => () => {
        detachGlobalPointerListeners();
    }, []);

    useEffect(() => {
        const contentNode = contentRef.current;
        if (contentNode) {
            contentNode.style.transform = `translateX(${translateX}px)`;
            contentNode.style.transition = isSwiping ? 'none' : 'transform 0.2s ease-out';
        }

        const actionsNode = actionsRef.current;
        if (actionsNode) {
            const offset = ACTIONS_WIDTH + translateX;
            actionsNode.style.transform = `translateX(${Math.max(offset, 0)}px)`;
            actionsNode.style.transition = isSwiping ? 'none' : 'transform 0.2s ease-out';
        }
    }, [translateX, isSwiping]);

    useEffect(() => {
        if (reorderMode) {
            setTranslateX(0);
            setIsSwiping(false);
            dragStateRef.current.isSwipeActive = false;
            setCopied(false);
        }
    }, [reorderMode]);

    const progressPercentage = (timeLeft / 30) * 100;
    const isTokenValid = token && token.length > 0 && token !== t('account_item.invalid_secret');
    const circumference = 2 * Math.PI * 8;
    const dashOffset = circumference * (1 - progressPercentage / 100);
    const progressCircleClass = timeLeft === 30 ? 'otp-progress-circle no-transition' : 'otp-progress-circle';
    const tokenColorClass = isTokenValid ? 'text-accent-color' : 'text-error-color';
    const timerToneClass = !isTokenValid
        ? ''
        : timeLeft <= 5
            ? 'otp-timer-critical'
            : timeLeft <= 10
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

    const clampTranslateX = (value: number) => Math.min(0, Math.max(value, -ACTIONS_WIDTH));

    const updateSwipePosition = (clientX: number, clientY: number) => {
        const state = dragStateRef.current;
        const deltaX = clientX - state.startX;
        const next = clampTranslateX(state.initialTranslateX + deltaX);
        setTranslateX(next);
        state.velocity = clientX - state.lastClientX;
        state.lastClientX = clientX;
        state.lastClientY = clientY;
    };

    const finalizeSwipe = () => {
        const state = dragStateRef.current;
        const shouldOpen = Math.abs(translateX) > SWIPE_THRESHOLD || state.velocity < -10;
        const target = shouldOpen ? -ACTIONS_WIDTH : 0;
        setTranslateX(target);
        setIsSwiping(false);
        updateDragTarget(null);
        state.isSwipeActive = false;
        state.initialTranslateX = target;
        state.velocity = 0;
        state.startX = 0;
        state.startY = 0;
        state.lastClientX = 0;
        state.lastClientY = 0;
    };

    const processPointerMove = (clientX: number, clientY: number, pointerId: number) => {
        if (pointerIdRef.current !== pointerId) {
            return;
        }

        // 在待命状态下(150ms内),检查是否移动距离足够大
        if (dragStateEnum.current === 'pending') {
            const deltaX = Math.abs(clientX - dragStartPosRef.current.x);
            const deltaY = Math.abs(clientY - dragStartPosRef.current.y);
            if (deltaX > 75 || deltaY > 75) {
                // 距离足够大时立即进入dragging
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
                dragStateEnum.current = 'dragging';
                setIsDragging(true);
                startDragSession(account.id);
                updateDragTarget(null);
                pointerDownTargetRef.current = null;
            }
            
            // 如果仍在pending,直接返回
            if (dragStateEnum.current === 'pending') {
                return;
            }
        }

        // 仅在主动拖动时处理移动
        if (dragStateEnum.current !== 'dragging') {
            return;
        }

        try {
            let nextTarget: string | null = null;
            const elements = document.elementsFromPoint(clientX, clientY);
            
            // 3层检测策略
            for (const el of elements) {
                const element = el as HTMLElement;

                const dropTargetElement = element.closest('[data-sortable-target]') as HTMLElement | null;
                if (dropTargetElement) {
                    const dropTargetValue = dropTargetElement.getAttribute('data-sortable-target');
                    if (dropTargetValue) {
                        nextTarget = dropTargetValue;
                        break;
                    }
                }
                
                // 检查是否就是wrapper本身
                if (element.hasAttribute('data-sortable-item')) {
                    const overId = element.getAttribute('data-sortable-id');
                    if (overId && overId !== account.id) {
                        const rect = element.getBoundingClientRect();
                        const placement = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        nextTarget = `${placement}:${overId}`;
                        break;
                    }
                }
                
                // 使用closest查找wrapper
                const wrapper = element.closest('[data-sortable-item]') as HTMLElement | null;
                if (wrapper) {
                    const overId = wrapper.getAttribute('data-sortable-id');
                    if (overId && overId !== account.id) {
                        const rect = wrapper.getBoundingClientRect();
                        const placement = clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        nextTarget = `${placement}:${overId}`;
                        break;
                    }
                }
            }

            // Fallback: 全DOM扫描找最近的wrapper
            if (!nextTarget) {
                const allWrappers = document.querySelectorAll('[data-sortable-item]');
                let closest: { id: string; distance: number; placement: 'before' | 'after' } | null = null;
                
                for (const wrapper of allWrappers) {
                    const itemId = wrapper.getAttribute('data-sortable-id');
                    if (itemId && itemId !== account.id) {
                        const rect = wrapper.getBoundingClientRect();
                        const center = rect.top + rect.height / 2;
                        const distance = Math.abs(clientY - center);
                        
                        // 150px范围内
                        if (distance < 150) {
                            const placement = clientY < center ? 'before' : 'after';
                            if (!closest || distance < closest.distance) {
                                closest = { id: itemId, distance, placement };
                            }
                        }
                    }
                }
                
                if (closest) {
                    nextTarget = `${closest.placement}:${closest.id}`;
                }
            }

            // 更新target
            if (nextTarget && nextTarget !== currentDropTargetRef.current) {
                currentDropTargetRef.current = nextTarget;
                lastValidTargetRef.current = nextTarget;
                updateDragTarget(nextTarget);
            } else if (!nextTarget && currentDropTargetRef.current) {
                currentDropTargetRef.current = null;
                updateDragTarget(null);
            }
        } catch (err) {
            console.error('[Drag] MOVE ERROR', err);
        }
    };

    const processPointerUp = (event?: PointerEvent | React.PointerEvent<HTMLDivElement>) => {
        const pointerId = event?.pointerId;
        if (pointerIdRef.current !== null && pointerId !== undefined && pointerIdRef.current !== pointerId) {
            return;
        }

        detachGlobalPointerListeners();
        setIsDragging(false);

        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        if (itemRef.current && pointerIdRef.current !== null && itemRef.current.hasPointerCapture(pointerIdRef.current)) {
            try {
                itemRef.current.releasePointerCapture(pointerIdRef.current);
            } catch (err) {
                console.warn('[Drag] UP: releasePointerCapture failed', err);
            }
        }

        if (dragStateRef.current.isSwipeActive) {
            finalizeSwipe();
            pointerIdRef.current = null;
            dragStateEnum.current = 'idle';
            pointerDownTargetRef.current = null;
            return;
        }

        // Handle drag drop
        if (dragStateEnum.current === 'dragging') {
            dragStateEnum.current = 'dropping';
            const draggedId = account.id;
            const overId = currentDropTargetRef.current || lastValidTargetRef.current;
            
            // 执行drop,然后清除UI状态
            if (overId && (overId !== draggedId || overId.includes(':'))) {
                completeDragSession(draggedId, overId);
            }

            updateDragTarget(null);
            
            // 重置drag状态
            dragStateEnum.current = 'idle';
            currentDropTargetRef.current = null;
            lastValidTargetRef.current = null;
            pointerIdRef.current = null;
            pointerDownTargetRef.current = null;
            return;
        }

        // Treat as tap when still pending and pointer started on copy target
        if (
            dragStateEnum.current === 'pending' &&
            pointerDownTargetRef.current === 'copy' &&
            !reorderMode &&
            isTokenValid &&
            event && 'clientX' in event
        ) {
            const deltaX = Math.abs(event.clientX - dragStartPosRef.current.x);
            const deltaY = Math.abs(event.clientY - dragStartPosRef.current.y);
            const elapsed = Date.now() - downTimeRef.current;
            if (deltaX <= 8 && deltaY <= 8 && elapsed < LONG_PRESS_DELAY) {
                handleCopy();
            }
        }

        // 恢复idle
        dragStateEnum.current = 'idle';
        currentDropTargetRef.current = null;
        lastValidTargetRef.current = null;
        pointerIdRef.current = null;
        pointerDownTargetRef.current = null;
        cancelDragSession();
        updateDragTarget(null);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;

        downTimeRef.current = Date.now();

        detachGlobalPointerListeners();
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }

        const targetElement = e.target as HTMLElement;
        pointerDownTargetRef.current = targetElement.closest('[data-copy-token]') ? 'copy' : null;

        if (targetElement.closest('[data-action-button]')) {
            pointerIdRef.current = null;
            dragStateEnum.current = 'idle';
            pointerDownTargetRef.current = null;
            return;
        }

        pointerIdRef.current = e.pointerId;
        dragStateEnum.current = 'pending';
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
        currentDropTargetRef.current = null;
        if (!reorderMode) {
            setIsSwiping(false);
        }

        // Swipe-to-delete always start dragging for animations
        dragStateRef.current = {
            isSwipeActive: !reorderMode && translateX !== 0,
            startX: e.clientX,
            startY: e.clientY,
            initialTranslateX: reorderMode ? 0 : translateX,
            velocity: 0,
            lastClientX: e.clientX,
            lastClientY: e.clientY,
        };

        if (dragStateRef.current.isSwipeActive) {
            setIsSwiping(true);
        }

        if (itemRef.current) {
            itemRef.current.setPointerCapture(e.pointerId);
            itemRef.current.style.transition = 'none';
        }

        // 准备long-press计时器
        longPressTimer.current = window.setTimeout(() => {
            if (pointerIdRef.current !== e.pointerId) return;
            if (dragStateRef.current.isSwipeActive) return;
            const stateSnapshot = dragStateRef.current;
            const moveDeltaX = Math.abs(stateSnapshot.lastClientX - stateSnapshot.startX);
            const moveDeltaY = Math.abs(stateSnapshot.lastClientY - stateSnapshot.startY);
            if (moveDeltaX > 12 || moveDeltaY > 12) {
                return;
            }
            
            longPressTimer.current = null;
            dragStateEnum.current = 'dragging';
            setIsDragging(true);
            currentDropTargetRef.current = null;
            startDragSession(account.id);
            updateDragTarget(null);
            dragStateRef.current.isSwipeActive = false;
                pointerDownTargetRef.current = null;
            
            // 附加全局事件监听
            const moveHandler = (moveEvent: PointerEvent) => {
                processPointerMove(moveEvent.clientX, moveEvent.clientY, moveEvent.pointerId);
            };
            const upHandler = (upEvent: PointerEvent) => {
                processPointerUp(upEvent.pointerId);
            };
            
            globalPointerMoveRef.current = moveHandler;
            globalPointerUpRef.current = upHandler;
            
            window.addEventListener('pointermove', moveHandler, { capture: true });
            window.addEventListener('pointerup', upHandler, { capture: true });
    }, LONG_PRESS_DELAY);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== e.pointerId) {
            return;
        }
        const state = dragStateRef.current;

        if (!reorderMode && dragStateEnum.current !== 'dragging') {
            const deltaX = e.clientX - state.startX;
            const deltaY = e.clientY - state.startY;
            const horizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8;

            if (!state.isSwipeActive && horizontalIntent) {
                state.isSwipeActive = true;
                setIsSwiping(true);
                if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                    longPressTimer.current = null;
                }
                dragStateEnum.current = 'idle';
                pointerDownTargetRef.current = null;
            }

            if (state.isSwipeActive) {
                updateSwipePosition(e.clientX, e.clientY);
                return;
            }
        }

        state.lastClientX = e.clientX;
        state.lastClientY = e.clientY;
        processPointerMove(e.clientX, e.clientY, e.pointerId);
    };

    const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
        processPointerUp(e);
    };
    
    const closeActions = () => {
        setIsSwiping(false);
        dragStateRef.current.isSwipeActive = false;
        dragStateRef.current.initialTranslateX = 0;
        setTranslateX(0);
    };
    
    const handleEditClick = () => {
        onEdit(account);
        closeActions();
    }
    
    return (
        <div
            ref={itemRef}
            className={`relative bg-secondary-bg rounded-lg overflow-hidden w-full select-none group-drop-source ${reorderMode ? 'jiggle' : ''} ${isDragging ? 'dragging' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={(event) => {
                processPointerUp(event);
            }}
        >
            <div ref={actionsRef} className="absolute top-0 right-0 h-full flex items-center z-0 swipe-actions">
                <button
                    onClick={handleEditClick}
                    className="h-full w-[72px] flex items-center justify-center transition-colors button-accent"
                    aria-label={t('modals.edit_account_title')}
                    data-action-button
                >
                    <FiEdit2 size={24} aria-hidden="true" />
                </button>
                <button
                    onClick={() => {
                        onRequestDelete(account);
                        closeActions();
                    }}
                    className="h-full w-[72px] flex items-center justify-center transition-colors button-error"
                    aria-label={t('account_item.confirm_delete_tooltip')}
                    data-action-button
                >
                    <FiTrash2 size={24} aria-hidden="true" />
                </button>
            </div>
            <div
                ref={contentRef}
                className="relative w-full px-4 py-4 z-10 bg-secondary-bg"
            >
                <div className="account-card-content">
                    <div className="flex items-start gap-3">
                        <p className="text-base font-semibold truncate flex-1 min-w-0 text-primary-color">{account.issuer}</p>
                        <p className="text-sm font-medium truncate text-right text-secondary-color opacity-80 ml-auto max-w-[60%] min-w-0">{account.accountName}</p>
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
                                <span className="token-copy-badge badge-success">
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
                        <span className="otp-timer-value">{timeLeft}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountItem;
