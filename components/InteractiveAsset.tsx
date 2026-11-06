import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface InteractiveAssetProps {
  src: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
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
    sm: 'w-11 h-11 rounded-2xl',
    md: 'w-14 h-14 rounded-2xl',
    lg: 'w-20 h-20 rounded-3xl',
    xl: 'w-24 h-24 rounded-3xl',
  }[size];

  const toneRingClasses = {
    maldives:
      'bg-maldives-50 border-maldives-300/80 shadow-maldives-500/15 hover:border-maldives-500',
    sage: 'bg-sage-100 border-sage-300/80 shadow-sage-500/15 hover:border-sage-500',
    terracotta:
      'bg-terracotta-50 border-terracotta-200/90 shadow-terracotta-500/15 hover:border-terracotta-400',
    neutral: 'bg-oat-100 border-oat-300 shadow-espresso-900/5 hover:border-maldives-400',
  }[tone];

  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: 2.5, y: -3 }}
      whileTap={{ scale: 0.94, rotate: -2 }}
      animate={
        floatAnimation
          ? {
              y: [0, -4, 0],
            }
          : undefined
      }
      transition={{
        y: {
          duration: 3.6,
          repeat: Infinity,
          ease: 'easeInOut',
        },
        scale: { type: 'spring', stiffness: 360, damping: 18 },
      }}
      className={`relative shrink-0 border-2 shadow-md overflow-hidden flex items-center justify-center cursor-pointer select-none transition-colors ${sizeClasses} ${toneRingClasses} ${className}`}
      title={alt}
    >
      {!imgError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="material-symbols-outlined text-maldives-600 text-2xl">
          {badgeIcon || 'spa'}
        </span>
      )}

      {badgeIcon && !imgError && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-tl-lg bg-oat-50/90 backdrop-blur-sm border-t border-l border-oat-300 flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[12px] text-maldives-700">
            {badgeIcon}
          </span>
        </span>
      )}
    </motion.div>
  );
};

