import React, { useMemo } from 'react';
import { useSortableContext } from './SortableContext';

interface SortableItemProps {
    id: string;
    className?: string;
    children: React.ReactNode;
}

export const SortableItem: React.FC<SortableItemProps> = ({ id, className = 'w-full px-0 py-2', children }) => {
    const { getPlaceholderState, draggedId } = useSortableContext();
    const { before, after } = useMemo(() => getPlaceholderState(id), [getPlaceholderState, id]);
    const isActiveItem = draggedId === id;

    return (
        <>
            {before && (
                <div
                    className="drop-placeholder"
                    data-sortable-target={`before:${id}`}
                />
            )}
            <div
                data-sortable-item
                data-sortable-id={id}
                className={className}
                data-sortable-active-item={isActiveItem ? 'true' : 'false'}
            >
                {children}
            </div>
            {after && (
                <div
                    className="drop-placeholder"
                    data-sortable-target={`after:${id}`}
                />
            )}
        </>
    );
};
