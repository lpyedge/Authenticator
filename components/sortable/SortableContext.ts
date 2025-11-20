import React, { createContext, useContext } from 'react';

export type SortableDropTarget =
    | { type: 'before'; id: string }
    | { type: 'after'; id: string }
    | { type: 'end' }
    | { type: 'delete' }
    | { type: 'group-tab'; groupId: string }
    | { type: 'reorder-group-before'; groupId: string }
    | { type: 'reorder-group-after'; groupId: string };

export interface SortableContextValue {
    reorderMode: boolean;
    draggedId: string | null;
    dragTarget: SortableDropTarget | null;
    startDragSession: (id: string) => void;
    updateDragTarget: (value: string | null) => void;
    completeDragSession: (draggedId: string, targetValue: string | null) => void;
    cancelDragSession: () => void;
    getPlaceholderState: (id: string) => { before: boolean; after: boolean };
    shouldShowEndPlaceholder: boolean;
}

export const SortableContext = createContext<SortableContextValue | null>(null);

export const useSortableContext = (): SortableContextValue => {
    const ctx = useContext(SortableContext);
    if (!ctx) {
        throw new Error('useSortableContext must be used within a SortableProvider');
    }
    return ctx;
};

export const END_SORTABLE_TARGET = '__sortable_end__';
