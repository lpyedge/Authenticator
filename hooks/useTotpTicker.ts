import { useEffect, useState } from 'react';

const listeners = new Set<(timestamp: number) => void>();
let intervalId: number | null = null;

const emit = () => {
    const now = Date.now();
    listeners.forEach(listener => listener(now));
};

const startTicker = () => {
    if (intervalId !== null) {
        return;
    }
    emit();
    intervalId = window.setInterval(emit, 1000);
};

const stopTicker = () => {
    if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
    }
};

export const useTotpTicker = (periodSeconds = 30) => {
    const [timestamp, setTimestamp] = useState(() => Date.now());

    useEffect(() => {
        const listener = (now: number) => setTimestamp(now);
        listeners.add(listener);
        startTicker();

        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) {
                stopTicker();
            }
        };
    }, []);

    const seconds = Math.floor(timestamp / 1000);
    const elapsed = seconds % periodSeconds;
    const timeLeft = periodSeconds - elapsed;
    const slot = Math.floor(seconds / periodSeconds);

    return { timeLeft, slot };
};
