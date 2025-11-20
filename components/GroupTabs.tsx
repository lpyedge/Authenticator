import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Account } from '../types';
import { useDroppable } from '@dnd-kit/core';

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

const GroupTabItem: React.FC<{
    groupId: string;
    label: string;
    isActive: boolean;
    count: number;
    onClick: () => void;
    isAllTab: boolean;
    reorderMode: boolean;
}> = ({ groupId, label, isActive, count, onClick, isAllTab, reorderMode }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `group-tab:${groupId || '__all__'}`,
        data: { type: 'group-tab', groupId: groupId || '__all__' }
    });

    const classNames = [
        'group-tab',
        isActive ? 'group-tab-active' : '',
        isOver && !isAllTab ? 'group-tab-drop' : '', // Visual feedback for drop
    ].filter(Boolean).join(' ');

    return (
        <div className="group-tab-wrapper">
            <button
                ref={setNodeRef}
                className={classNames}
                onClick={onClick}
                type="button"
            >
                <span className="truncate">{label}</span>
                {count > 0 && <span className="group-tab-badge">{count > 99 ? '99' : count}</span>}
            </button>
        </div>
    );
};

const GroupTabs: React.FC<GroupTabsProps> = ({ groups, activeGroup, onSelectGroup, onRequestAddGroup, reorderMode, labels, accounts, onMoveGroup }) => {
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

    return (
        <div className="group-tabs-wrapper" data-reorder-mode={reorderMode ? 'true' : 'false'}>
            <div className="group-tabs-scroll" ref={scrollRef}>
                {groupEntries.map(groupId => (
                    <GroupTabItem
                        key={groupId || '__all__'}
                        groupId={groupId}
                        label={groupId || labels.all}
                        isActive={activeGroup === groupId}
                        count={groupCounts[groupId] || 0}
                        onClick={() => onSelectGroup(groupId)}
                        isAllTab={!groupId}
                        reorderMode={reorderMode}
                    />
                ))}
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
