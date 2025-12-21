export function formatDate(date: Date | string) {
    const value = typeof date === 'string' ? new Date(date) : date;
    return value.toLocaleString('ja-JP', { hour12: false });
}

export function isBrowser() {
    return typeof window !== 'undefined';
}
