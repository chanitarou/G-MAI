'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

export function useTheme(): [Theme, (theme: Theme) => void] {
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        const stored = window.localStorage.getItem('bitflow-theme') as Theme | null;
        if (stored) {
            setTheme(stored);
            document.documentElement.dataset.theme = stored;
        }
    }, []);

    const updateTheme = (next: Theme) => {
        setTheme(next);
        document.documentElement.dataset.theme = next;
        window.localStorage.setItem('bitflow-theme', next);
    };

    return [theme, updateTheme];
}
