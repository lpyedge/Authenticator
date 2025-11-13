import React, { useCallback, useMemo } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useSortableContext } from './sortable/SortableProvider';

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
}

const GroupTabs: React.FC<GroupTabsProps> = ({ groups, activeGroup, onSelectGroup, onRequestAddGroup, reorderMode, labels }) => {
    const { draggedId, dragTarget } = useSortableContext();

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

    const handleSelect = useCallback((groupId: string) => {
        onSelectGroup(groupId);
    }, [onSelectGroup]);

    const renderTab = (groupId: string) => {
        const label = groupId ? groupId : labels.all;
        const key = groupId || '__all__';
        const isActive = activeGroup === groupId;
        const isDragging = Boolean(draggedId);
        const isAllTab = key === '__all__';
        const isDropTarget = !isAllTab && dragTarget?.type === 'group-tab' && dragTarget.groupId === key;
        const dataTarget = !isAllTab ? `group:${key}` : undefined;
        const classNames = [
            'group-tab',
            isActive ? 'group-tab-active' : '',
            isDropTarget ? 'group-tab-drop' : '',
            isAllTab && isDragging ? 'group-tab-all-disabled' : '',
        ].filter(Boolean).join(' ');

        return (
            <button
                key={key}
                className={classNames}
                onClick={(event) => {
                    handleSelect(groupId);
                }}
                data-sortable-target={draggedId && dataTarget ? dataTarget : undefined}
                data-group-tab={key}
                data-state={isActive ? 'active' : 'inactive'}
                data-drop={isDropTarget ? 'true' : 'false'}
                data-dragging={isDragging ? 'true' : 'false'}
                data-all={isAllTab ? 'true' : 'false'}
                aria-current={isActive ? 'page' : undefined}
                type="button"
            >
                <span className="truncate">{label}</span>
            </button>
        );
    };

    return (
    <div className="group-tabs-wrapper" data-reorder-mode={reorderMode ? 'true' : 'false'}>
            <div className="group-tabs-scroll">
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
