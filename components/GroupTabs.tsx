import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useSortableContext } from './sortable/SortableContext';
import { Account } from '../types';

interface GroupTabsProps {
    groups: string[];
    activeGroup: string;
    onSelectGroup: (group: string) => void;
    onRequestAddGroup: () => void;
    reorderMode: boolean;
    labels: {
        all: string;
        add: string;
    };
    accounts: Account[];
    onMoveGroup?: (draggedGroup: string, targetGroup: string, position: 'before' | 'after') => void;
}

const GroupTabs: React.FC<GroupTabsProps> = ({ groups, activeGroup, onSelectGroup, onRequestAddGroup, reorderMode, labels, accounts, onMoveGroup }) => {
    const { draggedId, dragTarget, startDragSession, updateDragTarget } = useSortableContext();
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const autoScrollRef = useRef<number | null>(null);

    // Auto-scroll logic
    useEffect(() => {
        if (!draggedId) {
            if (autoScrollRef.current) {
                cancelAnimationFrame(autoScrollRef.current);
                autoScrollRef.current = null;
            }
            return;
        }

        const container = scrollRef.current;
        if (!container) return;

        let scrollSpeed = 0;

        const handlePointerMove = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX;
            const zoneSize = 80; // Activation zone size
            const maxSpeed = 12; // Max scroll speed

            // Check if pointer is within the vertical bounds of the container (plus some margin)
            if (e.clientY < rect.top - 50 || e.clientY > rect.bottom + 50) {
                scrollSpeed = 0;
                return;
            }

            if (x < rect.left + zoneSize) {
                const distance = Math.max(0, x - rect.left);
                const intensity = 1 - (distance / zoneSize);
                scrollSpeed = -maxSpeed * intensity;
            } else if (x > rect.right - zoneSize) {
                const distance = Math.max(0, rect.right - x);
                const intensity = 1 - (distance / zoneSize);
                scrollSpeed = maxSpeed * intensity;
            } else {
                scrollSpeed = 0;
            }
        };

        const scrollLoop = () => {
            if (scrollSpeed !== 0 && container) {
                container.scrollLeft += scrollSpeed;
            }
            autoScrollRef.current = requestAnimationFrame(scrollLoop);
        };

        window.addEventListener('pointermove', handlePointerMove);
        autoScrollRef.current = requestAnimationFrame(scrollLoop);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            if (autoScrollRef.current) {
                cancelAnimationFrame(autoScrollRef.current);
            }
        };
    }, [draggedId]);

    useEffect(() => {
        console.log('GroupTabs Debug Info:', {
            activeGroup,
            reorderMode,
            labels,
            groups,
        });

        const tabElements = document.querySelectorAll('[data-group-tab]');
        tabElements.forEach((tabElement) => {
            const computedStyles = window.getComputedStyle(tabElement);
            console.log('Tab Style Debug Info:', {
                groupId: tabElement.getAttribute('data-group-tab'),
                backgroundColor: computedStyles.backgroundColor,
                borderColor: computedStyles.borderColor,
            });
        });
    }, [activeGroup, reorderMode, labels, groups]);

    const groupEntries = useMemo(() => {
        const seen = new Set<string>();
        const ordered: string[] = [''];
        groups.forEach(group => {
            if (!group || seen.has(group)) {
                return;
            }
            seen.add(group);
            ordered.push(group);
        });
        return ordered;
    }, [groups]);

    const groupCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        // Initialize counts for all groups to 0
        groups.forEach(g => counts[g] = 0);
        counts[''] = 0; // For 'All' tab

        accounts.forEach(acc => {
            // Count for 'All'
            counts[''] = (counts[''] || 0) + 1;
            
            // Count for specific group
            if (acc.group) {
                counts[acc.group] = (counts[acc.group] || 0) + 1;
            }
        });
        return counts;
    }, [groups, accounts]);

    const handleSelect = useCallback((groupId: string) => {
        onSelectGroup(groupId);
    }, [onSelectGroup]);

    const renderTab = (groupId: string) => {
        const label = groupId ? groupId : labels.all;
        const key = groupId || '__all__';
        const isActive = activeGroup === groupId;
        const isDragging = Boolean(draggedId);
        const isAllTab = key === '__all__';
        
        // Check if this tab is a drop target for an account
        const isAccountDropTarget = !isAllTab && dragTarget?.type === 'group-tab' && dragTarget.groupId === key;
        
        // Check if this tab is a drop target for another group
        const isGroupReorderTargetBefore = dragTarget?.type === 'reorder-group-before' && dragTarget.groupId === groupId;
        const isGroupReorderTargetAfter = dragTarget?.type === 'reorder-group-after' && dragTarget.groupId === groupId;
        
        const isDropTarget = isAccountDropTarget;

        const dataTarget = !isAllTab ? `group:${key}` : undefined;
        
        const count = groupCounts[groupId] || 0;

        const classNames = [
            'group-tab',
            isActive ? 'group-tab-active' : '',
            isAccountDropTarget ? 'group-tab-drop' : '',
            isAllTab && isDragging && !draggedId?.startsWith('group-tab:') ? 'group-tab-all-disabled' : '',
            draggedId === `group-tab:${groupId}` ? 'group-tab-dragging' : '',
        ].filter(Boolean).join(' ');

        const handlePointerDown = (e: React.PointerEvent) => {
            if (reorderMode && !isAllTab) {
                // We need to prevent the scroll logic if it was active, but it's disabled in reorderMode.
                // We should start dragging.
                startDragSession(`group-tab:${groupId}`);
                e.stopPropagation();
            }
        };

        const handlePointerEnter = () => {
            if (draggedId && draggedId.startsWith('group-tab:') && draggedId !== `group-tab:${groupId}` && !isAllTab) {
                 const draggedGroup = draggedId.slice('group-tab:'.length);
                 const draggedIndex = groupEntries.indexOf(draggedGroup);
                 const targetIndex = groupEntries.indexOf(groupId);
                 
                 if (draggedIndex < targetIndex) {
                     updateDragTarget(`reorder-group-after:${groupId}`);
                 } else {
                     updateDragTarget(`reorder-group-before:${groupId}`);
                 }
            }
        };

        return (
            <div key={key} className="group-tab-wrapper">
                {isGroupReorderTargetBefore && <div className="group-reorder-indicator-before" />}
                <button
                    className={classNames}
                    onClick={(event) => {
                        handleSelect(groupId);
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerEnter={handlePointerEnter}
                    data-sortable-target={draggedId && !draggedId.startsWith('group-tab:') && dataTarget ? dataTarget : undefined}
                    data-group-tab={key}
                    data-state={isActive ? 'active' : 'inactive'}
                    data-drop={isDropTarget ? 'true' : 'false'}
                    data-dragging={isDragging ? 'true' : 'false'}
                    data-all={isAllTab ? 'true' : 'false'}
                    aria-current={isActive ? 'page' : undefined}
                    type="button"
                >
                    <span className="truncate">{label}</span>
                    {count > 0 && <span className="group-tab-badge">{count > 99 ? '99' : count}</span>}
                </button>
                {isGroupReorderTargetAfter && <div className="group-reorder-indicator-after" />}
            </div>
        );
    };

    useEffect(() => {
        const container = scrollRef.current;
        if (!container || reorderMode) {
            return;
        }

        let pointerActive = false;
        let startX = 0;
        let startScrollLeft = 0;
        let hasDragged = false;
        let suppressClick = false;

        const endDrag = () => {
            if (!pointerActive) {
                return;
            }
            pointerActive = false;
            container.classList.remove('is-dragging');
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
            if (hasDragged) {
                suppressClick = true;
                window.setTimeout(() => {
                    suppressClick = false;
                }, 0);
            }
            hasDragged = false;
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (!pointerActive) {
                return;
            }
            const deltaX = event.clientX - startX;
            if (!hasDragged && Math.abs(deltaX) > 4) {
                hasDragged = true;
            }
            if (hasDragged) {
                event.preventDefault();
                container.scrollLeft = startScrollLeft - deltaX;
            }
        };

        const handlePointerUp = () => {
            endDrag();
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType === 'mouse' && event.button !== 0) {
                return;
            }
            pointerActive = true;
            hasDragged = false;
            startX = event.clientX;
            startScrollLeft = container.scrollLeft;
            container.classList.add('is-dragging');
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            window.addEventListener('pointercancel', handlePointerUp);
        };

        const handleClickCapture = (event: MouseEvent) => {
            if (suppressClick) {
                event.stopPropagation();
                event.preventDefault();
            }
        };

        container.addEventListener('pointerdown', handlePointerDown);
        container.addEventListener('click', handleClickCapture, true);

        return () => {
            endDrag();
            container.removeEventListener('pointerdown', handlePointerDown);
            container.removeEventListener('click', handleClickCapture, true);
        };
    }, [reorderMode]);

    return (
        <div className="group-tabs-wrapper" data-reorder-mode={reorderMode ? 'true' : 'false'}>
            <div className="group-tabs-scroll" ref={scrollRef}>
                {groupEntries.map(renderTab)}
                {!reorderMode && (
                    <button
                        className="group-tab group-tab-add"
                        onClick={onRequestAddGroup}
                        data-sortable-target={draggedId ? 'group:__create__' : undefined}
                        type="button"
                        aria-label={labels.add}
                        data-group-tab="__create__"
                        data-drop={dragTarget?.type === 'group-tab' && dragTarget.groupId === '__create__' ? 'true' : 'false'}
                        data-dragging={draggedId ? 'true' : 'false'}
                    >
                        <FiPlus size={16} aria-hidden="true" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default GroupTabs;
