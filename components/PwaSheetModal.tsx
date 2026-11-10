import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface PwaSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: string;
  tone?: 'maldives' | 'terracotta' | 'sage';
  maxWidthClass?: string;
  children: React.ReactNode;
}

const TONE_ICON_STYLES = {
  maldives:
    'bg-maldives-50 text-maldives-600 border-maldives-200 dark:border-maldives-300/25',
  terracotta:
    'bg-terracotta-50 text-terracotta-600 border-terracotta-200 dark:border-terracotta-300/25',
  sage: 'bg-sage-50 text-sage-600 border-sage-200 dark:border-sage-300/25',
};

/**
 * Bottom sheet nativo no mobile e modal centralizado no desktop,
 * evitando rolagem vertical longa nos fluxos principais do PWA.
 */
export const PwaSheetModal: React.FC<PwaSheetModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  tone = 'maldives',
  maxWidthClass = 'max-w-lg',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`w-full ${maxWidthClass} max-h-[90dvh] bg-surface-elevated border-t sm:border border-oat-300 dark:border-white/[0.10] rounded-t-3xl sm:rounded-3xl shadow-cozy-lg flex flex-col overflow-hidden pb-safe`}
          >
            {/* Alça visual de bottom-sheet no mobile */}
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
              <span className="w-10 h-1 rounded-full bg-oat-300 dark:bg-white/20" />
            </div>

            {/* Cabeçalho fixo do modal */}
            <div className="px-4 sm:px-6 pt-2 sm:pt-5 pb-3.5 border-b border-oat-200 dark:border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_STYLES[tone]}`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {icon}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-display font-bold text-espresso-900 truncate">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-[11px] sm:text-xs text-espresso-500 truncate">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="w-8 h-8 rounded-full bg-oat-100 dark:bg-oat-200/70 hover:bg-oat-200 text-espresso-600 hover:text-espresso-900 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Conteúdo rolável */}
            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
