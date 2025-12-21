import Link from 'next/link';

import { ROUTES } from '../../constants/routes';

export default function Navigation() {
    return (
        <nav className="site-nav">
            {ROUTES.map((route) => (
                <Link key={route.path} href={route.path} className="site-nav__link">
                    {route.label}
                </Link>
            ))}
        </nav>
    );
}
