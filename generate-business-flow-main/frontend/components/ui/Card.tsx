import type { ReactNode } from 'react';

type CardProps = {
    title?: string;
    description?: string;
    children?: ReactNode;
    className?: string;
};

export function Card({ title, description, children, className = '' }: CardProps) {
    const classes = ['card', className].filter(Boolean).join(' ').trim();
    return (
        <div className={classes}>
            {title ? <h2 className="card__title">{title}</h2> : null}
            {description ? <p className="card__description">{description}</p> : null}
            {children ? <div className="card__body">{children}</div> : null}
        </div>
    );
}
