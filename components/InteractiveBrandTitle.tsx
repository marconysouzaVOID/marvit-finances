import React, { useCallback, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface InteractiveBrandTitleProps {
  text?: string;
  isDark?: boolean;
  className?: string;
}

/**
 * Título interativo "Marvit & Finances" com onda elástica letra a letra,
 * brilho atmosférico que segue o cursor e realce editorial no "&".
 */
export const InteractiveBrandTitle: React.FC<InteractiveBrandTitleProps> = ({
  text = 'Marvit & Finances',
  isDark = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLHeadingElement | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isContainerHovered, setIsContainerHovered] = useState(false);

  const rawCursorX = useMotionValue(0);
  const smoothCursorX = useSpring(rawCursorX, {
    stiffness: 320,
    damping: 28,
    mass: 0.4,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLHeadingElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      rawCursorX.set(e.clientX - rect.left);
    },
    [rawCursorX],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLHeadingElement>) => {
      setIsContainerHovered(true);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        rawCursorX.set(e.clientX - rect.left);
      }
    },
    [rawCursorX],
  );

  const handleMouseLeave = useCallback(() => {
    setIsContainerHovered(false);
    setHoveredIndex(null);
  }, []);

  const ampersandIndex = text.indexOf('&');
  const characters = Array.from(text);

  return (
    <div className={`relative inline-flex flex-col items-center select-none ${className}`}>
      <h1
        ref={containerRef}
        aria-label={text}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative inline-flex items-baseline justify-center font-display font-bold text-[1.7rem] sm:text-[2rem] leading-tight tracking-tight text-espresso-900 cursor-default py-1.5 px-2 whitespace-nowrap"
      >
        {/* Brilho ambiente sutil seguindo o ponteiro atrás da tipografia */}
        <motion.span
          aria-hidden="true"
          style={{ x: smoothCursorX }}
          animate={{
            opacity: isContainerHovered ? (isDark ? 0.55 : 0.42) : 0,
            scale: isContainerHovered ? 1 : 0.75,
          }}
          transition={{ duration: 0.22 }}
          className="pointer-events-none absolute top-1/2 -left-12 -mt-6 w-24 h-12 rounded-full blur-xl bg-gradient-to-r from-maldives-400/70 via-[#E9BE6A]/80 to-terracotta-400/60"
        />

        {characters.map((char, idx) => {
          const isSpace = char === ' ';
          const isAmpersand = char === '&';
          const isSecondWord = ampersandIndex !== -1 && idx > ampersandIndex;
          const distance = hoveredIndex === null ? Infinity : Math.abs(idx - hoveredIndex);

          let targetY = 0;
          let targetScale = 1;
          let targetRotate = 0;

          if (distance === 0) {
            targetY = -6;
            targetScale = isAmpersand ? 1.24 : 1.16;
            targetRotate = isAmpersand ? -10 : idx % 2 === 0 ? -3.5 : 3.5;
          } else if (distance === 1) {
            targetY = -2.8;
            targetScale = 1.07;
            targetRotate = idx < (hoveredIndex ?? 0) ? -1.5 : 1.5;
          } else if (distance === 2) {
            targetY = -1;
            targetScale = 1.025;
          }

          const baseLetterColor = isDark ? '#F3F5F8' : '#2C221E';
          let targetColor = baseLetterColor;
          let targetShadow = '0 0 0px rgba(0,0,0,0)';

          if (isAmpersand) {
            if (distance === 0) {
              targetColor = isDark ? '#F8CE70' : '#C27413';
              targetShadow = isDark
                ? '0 4px 18px rgba(248, 206, 112, 0.55)'
                : '0 4px 14px rgba(194, 116, 19, 0.30)';
            } else {
              targetColor = isDark ? '#E8BE68' : '#1F7E91';
            }
          } else if (distance === 0) {
            if (isSecondWord) {
              targetColor = isDark ? '#F5C469' : '#B85A3F';
              targetShadow = isDark
                ? '0 4px 16px rgba(245, 196, 105, 0.45)'
                : '0 3px 12px rgba(184, 90, 63, 0.25)';
            } else {
              targetColor = isDark ? '#5DD3E3' : '#187B8F';
              targetShadow = isDark
                ? '0 4px 16px rgba(93, 211, 227, 0.45)'
                : '0 3px 12px rgba(24, 123, 143, 0.25)';
            }
          } else if (distance === 1) {
            targetColor = isDark
              ? isSecondWord
                ? '#F7DDA4'
                : '#9CE3ED'
              : isSecondWord
                ? '#9F4D36'
                : '#1F6C7A';
          }

          if (isSpace) {
            return (
              <span
                key={`space-${idx}`}
                aria-hidden="true"
                onMouseEnter={() => setHoveredIndex(idx)}
                className="inline-block w-1.5 sm:w-2 py-1"
              >
                &nbsp;
              </span>
            );
          }

          return (
            <motion.span
              key={`${char}-${idx}`}
              aria-hidden="true"
              onMouseEnter={() => setHoveredIndex(idx)}
              onClick={() => {
                setHoveredIndex(idx);
                window.setTimeout(() => setHoveredIndex((prev) => (prev === idx ? null : prev)), 420);
              }}
              animate={{
                y: targetY,
                scale: targetScale,
                rotate: targetRotate,
                color: targetColor,
                textShadow: targetShadow,
              }}
              transition={{
                type: 'spring',
                stiffness: 480,
                damping: 22,
                mass: 0.45,
              }}
              className={`relative inline-block origin-bottom will-change-transform ${
                isAmpersand ? 'italic px-0.5 font-extrabold' : ''
              }`}
            >
              {char}
            </motion.span>
          );
        })}

        {/* Filete luminoso sob a palavra que acompanha o mouse */}
        <motion.span
          aria-hidden="true"
          style={{ x: smoothCursorX }}
          animate={{
            opacity: isContainerHovered ? 0.95 : 0,
            scaleX: isContainerHovered ? 1 : 0.3,
          }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none absolute bottom-0.5 -left-10 w-20 h-[2px] rounded-full bg-gradient-to-r from-transparent via-maldives-500 to-transparent dark:via-[#E9BE6A]"
        />
      </h1>

      {/* Linha decorativa sutil quando em repouso, expande suavemente no hover */}
      <motion.div
        aria-hidden="true"
        animate={{
          width: isContainerHovered ? '72%' : '36%',
          opacity: isContainerHovered ? 0.85 : 0.35,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-maldives-500/60 dark:via-[#E9BE6A]/65 to-transparent -mt-0.5"
      />
    </div>
  );
};
