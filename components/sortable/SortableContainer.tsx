import React from 'react';
import { useSortableContext, END_SORTABLE_TARGET } from './SortableContext';

interface SortableContainerProps {
    id?: string;
    className?: string;
    children: React.ReactNode;
}

export const SortableContainer: React.FC<SortableContainerProps> = ({ id, className, children }) => {
    const { draggedId, shouldShowEndPlaceholder } = useSortableContext();

    return (
        <div
            id={id}
            className={className}
            data-sortable-root
            data-sortable-active={draggedId ? 'true' : 'false'}
        >
            {children}
            {shouldShowEndPlaceholder && (
                <div
                    key="sortable-end-placeholder"
                    className="drop-placeholder"
                    data-sortable-target="end"
                />
            )}
            <div
                className="sortable-virtual-zone"
                data-sortable-target={END_SORTABLE_TARGET}
                aria-hidden="true"
            />
        </div>
    );
};
