import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SortableContext, SortableContextValue, SortableDropTarget, END_SORTABLE_TARGET } from './SortableContext';

export { useSortableContext, END_SORTABLE_TARGET } from './SortableContext';
export type { SortableDropTarget } from './SortableContext';

interface SortableProviderProps {
    reorderMode: boolean;
    onRequestReorderMode?: (triggerId: string) => void;
    onCommit: (draggedId: string, target: SortableDropTarget) => void;
    children: React.ReactNode;
}

const parseDropTarget = (value: string | null): SortableDropTarget | null => {
    if (!value) return null;
    if (value === '__top__') return { type: 'before', id: '' };
    if (value === '__bottom__' || value === 'end' || value === END_SORTABLE_TARGET) {
        return { type: 'end' };
    }
    if (value === 'delete') {
        return { type: 'delete' };
    }
    if (value.startsWith('group:')) {
        return { type: 'group-tab', groupId: value.slice('group:'.length) };
    }
    if (value.startsWith('reorder-group-before:')) {
        return { type: 'reorder-group-before', groupId: value.slice('reorder-group-before:'.length) };
    }
    if (value.startsWith('reorder-group-after:')) {
        return { type: 'reorder-group-after', groupId: value.slice('reorder-group-after:'.length) };
    }
    if (value.startsWith('before:')) {
        return { type: 'before', id: value.slice('before:'.length) };
    }
    if (value.startsWith('after:')) {
        return { type: 'after', id: value.slice('after:'.length) };
    }
    if (value === 'end:') {
        return { type: 'end' };
    }
    return { type: 'before', id: value };
};

export const SortableProvider: React.FC<SortableProviderProps> = ({ reorderMode, onRequestReorderMode, onCommit, children }) => {
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dragTarget, setDragTarget] = useState<SortableDropTarget | null>(null);

    useEffect(() => {
        if (!reorderMode) {
            setDraggedId(null);
            setDragTarget(null);
        }
    }, [reorderMode]);

    const startDragSession = useCallback((id: string) => {
        if (!reorderMode) {
            onRequestReorderMode?.(id);
        }
        setDraggedId(id);
        setDragTarget(null);
    }, [reorderMode, onRequestReorderMode]);

    const updateDragTarget = useCallback((value: string | null) => {
        setDragTarget(parseDropTarget(value));
    }, []);

    const completeDragSession = useCallback((sourceId: string, targetValue: string | null) => {
        const target = parseDropTarget(targetValue);
        if (sourceId && target) {
            onCommit(sourceId, target);
        }
        setDraggedId(null);
        setDragTarget(null);
    }, [onCommit]);

    const cancelDragSession = useCallback(() => {
        setDraggedId(null);
        setDragTarget(null);
    }, []);

    const getPlaceholderState = useCallback((id: string) => {
        return {
            before: dragTarget?.type === 'before' && dragTarget.id === id && draggedId !== id,
            after: dragTarget?.type === 'after' && dragTarget.id === id && draggedId !== id,
        };
    }, [dragTarget, draggedId]);

    const shouldShowEndPlaceholder = dragTarget?.type === 'end' && draggedId !== null;

    const contextValue = useMemo<SortableContextValue>(() => ({
        reorderMode,
        draggedId,
        dragTarget,
        startDragSession,
        updateDragTarget,
        completeDragSession,
        cancelDragSession,
        getPlaceholderState,
        shouldShowEndPlaceholder,
    }), [reorderMode, draggedId, dragTarget, startDragSession, updateDragTarget, completeDragSession, cancelDragSession, getPlaceholderState, shouldShowEndPlaceholder]);

    return (
        <SortableContext.Provider value={contextValue}>
            {children}
        </SortableContext.Provider>
    );
};
