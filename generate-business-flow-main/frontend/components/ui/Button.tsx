import { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type CommonProps = {
    variant?: 'primary' | 'secondary' | 'ghost';
    className?: string;
};

type ButtonAsButton = CommonProps &
    ButtonHTMLAttributes<HTMLButtonElement> & {
        as?: 'button';
    };

type ButtonAsLink = CommonProps &
    AnchorHTMLAttributes<HTMLAnchorElement> & {
        as: 'a';
    };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button({ variant = 'primary', className = '', as = 'button', ...props }: ButtonProps) {
    const base = 'ui-button';
    const styles: Record<Required<ButtonProps>['variant'], string> = {
        primary: 'ui-button--primary',
        secondary: 'ui-button--secondary',
        ghost: 'ui-button--ghost',
    };

    const mergedClass = [base, styles[variant], className].filter(Boolean).join(' ').trim();

    if (as === 'a') {
        return <a className={mergedClass} {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
    }

    return <button className={mergedClass} {...(props as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
