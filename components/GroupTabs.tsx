import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Account } from '../types';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
    onRequestReorderMode?: () => void;
}

export const GroupTabItem: React.FC<{
    groupId: string;
    label: string;
    isActive: boolean;
    count: number;
    onClick?: () => void;
    isAllTab: boolean;
    reorderMode: boolean;
    isOverlay?: boolean;
    onRequestReorderMode?: () => void;
}> = ({ groupId, label, isActive, count, onClick, isAllTab, reorderMode, isOverlay, onRequestReorderMode }) => {
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // For dropping accounts INTO groups
    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: `group-tab:${groupId || '__all__'}`,
        data: { type: 'group-tab', groupId: groupId || '__all__' },
        disabled: isOverlay // Enable even in reorderMode to detect invalid drops
    });

    // For sorting groups themselves
    const {
        attributes,
        listeners,
        setNodeRef: setSortRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: `group-sort:${groupId}`,
        disabled: !reorderMode || isAllTab || isOverlay, // "All" tab is not sortable
        data: { type: 'group-sort', groupId }
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? undefined : 1, // Let CSS handle opacity/visibility via placeholder class
    };

    const classNames = [
        'group-tab',
        isActive ? 'group-tab-active' : '',
        isOver && !isAllTab ? 'group-tab-drop' : '',
        reorderMode && !isAllTab && !isOverlay ? 'cursor-move jiggle' : '',
        isDragging ? 'group-tab-placeholder' : '',
        isOverlay ? 'shadow-lg ring-2 ring-accent-color ring-opacity-50 z-50 bg-bg-secondary' : ''
    ].filter(Boolean).join(' ');

    // Combine refs
    const setRef = (node: HTMLElement | null) => {
        if (isOverlay) return;
        setDropRef(node);
        setSortRef(node);
    };

    // Long Press Handlers
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (reorderMode || isOverlay) return;
        if (e.button !== 0) return;

        longPressTimer.current = setTimeout(() => {
            onRequestReorderMode?.();
        }, 500);
    };

    const handlePointerMove = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    return (
        <div className="group-tab-wrapper" ref={setRef} style={!isOverlay ? style : undefined} {...(!isOverlay ? attributes : {})} {...(!isOverlay ? listeners : {})}>
            <button
                className={classNames}
                onClick={onClick}
                type="button"
                // disabled={reorderMode} // Allow clicking to switch tabs even in reorder mode
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <span className="truncate">{label}</span>
                {count > 0 && <span className="group-tab-badge">{count > 99 ? '99' : count}</span>}
            </button>
        </div>
    );
};

const GroupTabs: React.FC<GroupTabsProps> = ({ groups, activeGroup, onSelectGroup, onRequestAddGroup, reorderMode, labels, accounts, onRequestReorderMode }) => {
    const scrollRef = useRef<HTMLDivElement | null>(null);

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
        groups.forEach(g => counts[g] = 0);
        counts[''] = 0;

        accounts.forEach(acc => {
            counts[''] = (counts[''] || 0) + 1;
            if (acc.group) {
                counts[acc.group] = (counts[acc.group] || 0) + 1;
            }
        });
        return counts;
    }, [groups, accounts]);

    // Simple horizontal scroll with mouse drag
    useEffect(() => {
        const container = scrollRef.current;
        if (!container || reorderMode) return;

        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        const onMouseDown = (e: MouseEvent) => {
            isDown = true;
            container.classList.add('is-dragging');
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        };
        const onMouseLeave = () => {
            isDown = false;
            container.classList.remove('is-dragging');
        };
        const onMouseUp = () => {
            isDown = false;
            container.classList.remove('is-dragging');
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2; // scroll-fast
            container.scrollLeft = scrollLeft - walk;
        };

        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('mousemove', onMouseMove);

        return () => {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mouseleave', onMouseLeave);
            container.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('mousemove', onMouseMove);
        };
    }, [reorderMode]);

    const sortableItems = useMemo(() => {
        return groupEntries.filter(g => g !== '').map(g => `group-sort:${g}`);
    }, [groupEntries]);

    return (
        <div className="group-tabs-wrapper" data-reorder-mode={reorderMode ? 'true' : 'false'}>
            <div className="group-tabs-scroll" ref={scrollRef}>
                {/* Render "All" tab first (not sortable) */}
                <GroupTabItem
                    key="__all__"
                    groupId=""
                    label={labels.all}
                    isActive={activeGroup === ''}
                    count={groupCounts[''] || 0}
                    onClick={() => onSelectGroup('')}
                    isAllTab={true}
                    reorderMode={reorderMode}
                    onRequestReorderMode={onRequestReorderMode}
                />

                <SortableContext items={sortableItems} strategy={horizontalListSortingStrategy}>
                    {groupEntries.filter(g => g !== '').map(groupId => (
                        <GroupTabItem
                            key={groupId}
                            groupId={groupId}
                            label={groupId}
                            isActive={activeGroup === groupId}
                            count={groupCounts[groupId] || 0}
                            onClick={() => onSelectGroup(groupId)}
                            isAllTab={false}
                            reorderMode={reorderMode}
                            onRequestReorderMode={onRequestReorderMode}
                        />
                    ))}
                </SortableContext>

                {!reorderMode && (
                    <button
                        className="group-tab group-tab-add"
                        onClick={onRequestAddGroup}
                        type="button"
                        aria-label={labels.add}
                    >
                        <FiPlus size={16} aria-hidden="true" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default GroupTabs;
