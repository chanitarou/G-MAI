'use client';

import { useEffect, useState } from 'react';

type Options<T> = {
    url: string;
    parser?: (value: unknown) => T;
};

export function useFetch<T>({ url, parser }: Options<T>) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        fetch(url)
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Request failed with status ${response.status}`);
                }
                const json = await response.json();
                return parser ? parser(json) : (json as T);
            })
            .then((payload) => {
                if (mounted) {
                    setData(payload);
                }
            })
            .catch((err) => {
                if (mounted) {
                    setError(err instanceof Error ? err : new Error('Unknown error'));
                }
            })
            .finally(() => {
                if (mounted) {
                    setLoading(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, [url, parser]);

    return { data, loading, error };
}
