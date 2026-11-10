import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AUVP_GOALS } from '../constants';
import { ExpenseCategory } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { InteractiveAsset } from './InteractiveAsset';

interface FinancialOverviewProps {
  totalIncome: number;
  categoryTotals: Record<ExpenseCategory, number>;
  customGoals: Record<ExpenseCategory, number>;
  onUpdateGoalPercent: (category: ExpenseCategory, percent: number) => void;
  onResetGoals: () => void;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({
  totalIncome,
  categoryTotals,
  customGoals,
  onUpdateGoalPercent,
  onResetGoals,
}) => {
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const categories: ExpenseCategory[] = ['essencial', 'estilo', 'investimento'];

  const sumPercent = categories.reduce(
    (acc, cat) => acc + (customGoals[cat] ?? AUVP_GOALS[cat].idealPercent),
    0
  );

  const toneMap: Record<ExpenseCategory, 'sage' | 'terracotta' | 'maldives'> = {
    essencial: 'sage',
    estilo: 'terracotta',
    investimento: 'maldives',
  };

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3.5 sm:pb-4 border-b border-oat-200 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-maldives-600 text-lg sm:text-xl">
                donut_large
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-display font-bold text-espresso-900 truncate">
                Pilares do Mês
              </h2>
              <p className="text-xs text-espresso-600 hidden sm:block">
                Equilíbrio proporcional entre Custos Essenciais, Estilo de Vida e Futuro.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div
            className={`px-2.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-mono font-bold border ${
              sumPercent === 100
                ? 'bg-maldives-50 border-maldives-300/70 dark:border-maldives-300/35 text-maldives-700'
                : 'bg-terracotta-50 border-terracotta-300/70 dark:border-terracotta-300/35 text-terracotta-700'
            }`}
          >
            Meta: {sumPercent}% {sumPercent !== 100 && '(Ideal 100%)'}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsEditingGoals(!isEditingGoals)}
              className={`px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                isEditingGoals
                  ? 'bg-maldives-500 text-white hover:bg-maldives-600 shadow-sm'
                  : 'bg-oat-200/80 text-espresso-800 hover:bg-oat-300 border border-oat-300 dark:border-white/[0.07]'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">
                {isEditingGoals ? 'check' : 'tune'}
              </span>
              <span>{isEditingGoals ? 'Concluir %' : 'Ajustar %'}</span>
            </button>

            {isEditingGoals && (
              <button
                onClick={onResetGoals}
                className="px-2 py-1.5 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-600 hover:text-espresso-900 text-xs border border-oat-300 transition cursor-pointer"
                title="Restaurar padrão (50/30/20)"
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Carrossel Horizontal no Mobile (evita empilhamento vertical longo) e Grid no Desktop */}
      <div className="flex items-center justify-end gap-1 text-[10.5px] font-semibold text-espresso-500 mt-2.5 md:hidden">
        <span className="material-symbols-outlined text-[13px] text-maldives-600">swipe</span>
        <span>Deslize os pilares</span>
      </div>

      <div className="flex md:grid md:grid-cols-3 gap-3 sm:gap-4 mt-2 md:mt-5 overflow-x-auto md:overflow-visible snap-x snap-mandatory pb-1.5 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0 overscroll-x-contain">
        {categories.map((cat, idx) => {
          const goal = AUVP_GOALS[cat];
          const targetPercent = customGoals[cat] ?? goal.idealPercent;
          const spent = categoryTotals[cat] || 0;
          const currentPercent = totalIncome > 0 ? (spent / totalIncome) * 100 : 0;
          const idealAmount = (totalIncome * targetPercent) / 100;
          const diff = spent - idealAmount;

          const isOverBudget = cat !== 'investimento' && diff > 0;
          const isInvestmentGoalMet = cat === 'investimento' && diff >= 0;

          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.3 }}
              whileHover={{ y: -3 }}
              className={`w-[78vw] max-w-[290px] md:w-auto md:max-w-none shrink-0 snap-start p-4 sm:p-5 rounded-3xl bg-oat-100/60 dark:bg-oat-200/45 border ${goal.borderColor} shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] relative overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-cozy`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2.5 sm:mb-3">
                  <div>
                    <span
                      className={`inline-block text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${goal.badgeBg}`}
                    >
                      {goal.shortName}
                    </span>
                    <div className="mt-1.5 sm:mt-2">
                      {isEditingGoals ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-espresso-600 font-medium">Meta:</span>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={targetPercent}
                            onChange={(e) =>
                              onUpdateGoalPercent(
                                cat,
                                Math.max(0, Math.min(100, Number(e.target.value)))
                              )
                            }
                            className="compact-select w-14 bg-oat-50 border border-maldives-500 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-maldives-700 text-xs focus:outline-none"
                          />
                          <span className="text-xs text-maldives-700 font-bold">%</span>
                        </div>
                      ) : (
                        <span className="text-[11px] sm:text-xs font-mono font-bold text-espresso-600">
                          Ideal: {targetPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block">
                    <InteractiveAsset
                      src={goal.assetPath}
                      alt={goal.name}
                      size="md"
                      tone={toneMap[cat]}
                      badgeIcon={
                        cat === 'essencial'
                          ? 'kitchen'
                          : cat === 'estilo'
                          ? 'local_cafe'
                          : 'potted_plant'
                      }
                    />
                  </div>
                </div>

                {isEditingGoals && (
                  <div className="mb-3 pt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={targetPercent}
                      onChange={(e) => onUpdateGoalPercent(cat, Number(e.target.value))}
                      className="w-full accent-maldives-500 h-1.5 bg-oat-200 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                <div className="mt-1">
                  <div className="text-xl sm:text-2xl font-mono font-extrabold text-espresso-900 tracking-tight">
                    {formatCurrency(spent)}
                  </div>
                  <div className="flex items-center justify-between text-[11px] sm:text-xs mt-1 text-espresso-600">
                    <span>Teto: {formatCurrency(idealAmount)}</span>
                    <span
                      className={`font-bold font-mono ${
                        isOverBudget ? 'text-terracotta-600' : 'text-espresso-800'
                      }`}
                    >
                      {formatPercent(currentPercent)}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-oat-200/90 dark:bg-white/[0.08] rounded-full h-2.5 sm:h-3 mt-3 overflow-hidden p-0.5 border border-oat-300 dark:border-white/[0.04]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, currentPercent))}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: isOverBudget ? '#D97757' : goal.color,
                    }}
                  />
                </div>

                <p className="text-[11px] text-espresso-500 mt-2.5 leading-relaxed hidden md:block">
                  {goal.description}
                </p>
              </div>

              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-oat-200/90 dark:border-white/[0.06] flex items-center justify-between text-[11px] sm:text-xs">
                <span className="text-espresso-600 font-medium">
                  {cat === 'investimento' ? 'Aporte:' : 'Margem:'}
                </span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-lg ${
                    cat === 'investimento'
                      ? isInvestmentGoalMet
                        ? 'bg-maldives-100 text-maldives-800'
                        : 'bg-terracotta-100 text-terracotta-700'
                      : !isOverBudget
                      ? 'bg-sage-100 text-sage-600'
                      : 'bg-terracotta-100 text-terracotta-700'
                  }`}
                >
                  {diff === 0
                    ? 'Na medida ✨'
                    : cat === 'investimento'
                    ? diff > 0
                      ? `+${formatCurrency(diff)} acima`
                      : `Faltam ${formatCurrency(Math.abs(diff))}`
                    : diff < 0
                    ? `Folga ${formatCurrency(Math.abs(diff))}`
                    : `+${formatCurrency(diff)} ⚠️`}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

