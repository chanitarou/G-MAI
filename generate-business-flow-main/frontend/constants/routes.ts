export const ROUTES = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
];

export type RouteConfig = (typeof ROUTES)[number];
