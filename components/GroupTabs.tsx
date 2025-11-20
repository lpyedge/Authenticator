import React, { useCallback, useMemo, useEffect, useRef } from 'react';
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
    const scrollRef = useRef<HTMLDivElement | null>(null);

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
