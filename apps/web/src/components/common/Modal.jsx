import React, { useEffect } from 'react';
import { X } from 'lucide-react';

let openModalsCount = 0;

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      openModalsCount++;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-modal-open');
      document.body.setAttribute('data-modal-open', 'true');
      window.dispatchEvent(
        new CustomEvent('pos-modal-state', { detail: { isOpen: true, count: openModalsCount } })
      );
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (isOpen) {
        openModalsCount = Math.max(0, openModalsCount - 1);
        if (openModalsCount === 0) {
          document.body.style.overflow = 'unset';
          document.body.classList.remove('has-modal-open');
          document.body.removeAttribute('data-modal-open');
          window.dispatchEvent(
            new CustomEvent('pos-modal-state', { detail: { isOpen: false, count: 0 } })
          );
        }
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto safe-area-top safe-area-bottom pos-modal-overlay">
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        ></div>

        <div
          className={`relative transform overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white text-left shadow-2xl transition-all w-full ${maxWidth} my-0 sm:my-6 max-h-[92vh] sm:max-h-[88vh] flex flex-col pos-modal-container ${className}`}
        >
          {/* Mobile Drag Indicator Bar */}
          <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-2.5 mb-1 shrink-0"></div>

          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4 shrink-0">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-800">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-4 sm:px-6 sm:py-5 overflow-y-auto flex-1 pos-modal-body">
            {children}
          </div>

          {footer && (
            <div className="pos-modal-footer shrink-0 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4 safe-area-bottom">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
