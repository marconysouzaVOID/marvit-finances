import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface InteractiveAssetProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'banner';
  tone?: 'maldives' | 'sage' | 'terracotta' | 'neutral';
  badgeIcon?: string;
  floatAnimation?: boolean;
  className?: string;
}

export const InteractiveAsset: React.FC<InteractiveAssetProps> = ({
  src,
  alt,
  size = 'md',
  tone = 'maldives',
  badgeIcon,
  floatAnimation = true,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: 'w-12 h-12 rounded-2xl p-1',
    md: 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-1.5',
    lg: 'w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-2',
    xl: 'w-32 h-32 sm:w-36 sm:h-36 rounded-3xl p-2',
    banner: 'w-full h-36 sm:h-40 rounded-2xl p-2',
  }[size];

  const toneRingClasses = {
    maldives:
      'bg-gradient-to-b from-maldives-50 to-oat-50 dark:from-maldives-50/70 dark:to-oat-200/70 border-maldives-300/80 dark:border-white/[0.08] shadow-maldives-500/10 dark:shadow-none hover:border-maldives-500/60',
    sage: 'bg-gradient-to-b from-sage-50 to-oat-50 dark:from-sage-50/70 dark:to-oat-200/70 border-sage-300/80 dark:border-white/[0.08] shadow-sage-500/10 dark:shadow-none hover:border-sage-500/60',
    terracotta:
      'bg-gradient-to-b from-terracotta-50 to-oat-50 dark:from-terracotta-50/70 dark:to-oat-200/70 border-terracotta-200/90 dark:border-white/[0.08] shadow-terracotta-500/10 dark:shadow-none hover:border-terracotta-400/60',
    neutral:
      'bg-gradient-to-b from-oat-100 to-oat-50 dark:from-oat-200/80 dark:to-oat-100 border-oat-300 dark:border-white/[0.08] shadow-espresso-900/5 dark:shadow-none hover:border-maldives-400/60',
  }[tone];

  return (
    <motion.div
      whileHover={{ scale: 1.06, rotate: 1.5, y: -3 }}
      whileTap={{ scale: 0.95 }}
      animate={
        floatAnimation
          ? {
              y: [0, -4, 0],
            }
          : undefined
      }
      transition={{
        y: {
          duration: 3.8,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        scale: { type: 'spring', stiffness: 340, damping: 20 },
      }}
      className={`relative shrink-0 border shadow-sm overflow-hidden flex items-center justify-center cursor-pointer select-none transition-colors ${sizeClasses} ${toneRingClasses} ${className}`}
      title={alt}
    >
      {/* Halo suave para destacar os personagens 3D tanto no modo claro quanto no escuro */}
      <div className="absolute inset-1 rounded-2xl bg-radial from-white/55 dark:from-white/15 to-transparent pointer-events-none" />

      {!imgError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain relative z-10 drop-shadow-sm"
          loading="lazy"
        />
      ) : (
        <span className="material-symbols-outlined text-maldives-600 text-2xl relative z-10">
          {badgeIcon || 'spa'}
        </span>
      )}
    </motion.div>
  );
};
