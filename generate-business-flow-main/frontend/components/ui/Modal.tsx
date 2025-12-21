'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

type ModalProps = {
    open: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
        return undefined;
    }, [open]);

    if (!open) {
        return null;
    }

    return (
        <div className="modal-backdrop">
            <div className="modal">
                <div className="modal__header">
                    <h3 className="modal__title">{title}</h3>
                    <button type="button" aria-label="閉じる" className="modal__close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
}
