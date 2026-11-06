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
    <div className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-maldives-600 text-xl">
              donut_large
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-display font-bold text-espresso-900">
              Pilares Orçamentários da Casa
            </h2>
            <p className="text-xs text-espresso-600">
              Equilíbrio proporcional entre Despensa Essencial, Estilo de Vida e Futuro.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border ${
              sumPercent === 100
                ? 'bg-maldives-50 border-maldives-300 text-maldives-700'
                : 'bg-terracotta-50 border-terracotta-300 text-terracotta-700'
            }`}
          >
            Soma: {sumPercent}% {sumPercent !== 100 && '(Ideal: 100%)'}
          </div>

          <button
            onClick={() => setIsEditingGoals(!isEditingGoals)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isEditingGoals
                ? 'bg-maldives-500 text-white hover:bg-maldives-600 shadow-sm'
                : 'bg-oat-200/80 text-espresso-800 hover:bg-oat-300 border border-oat-300'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isEditingGoals ? 'check' : 'tune'}
            </span>
            <span>{isEditingGoals ? 'Concluir %' : 'Ajustar %'}</span>
          </button>

          {isEditingGoals && (
            <button
              onClick={onResetGoals}
              className="px-2.5 py-1.5 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-600 hover:text-espresso-900 text-xs border border-oat-300 transition cursor-pointer"
              title="Restaurar padrão (50/30/20)"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
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
              transition={{ delay: idx * 0.07, duration: 0.35 }}
              whileHover={{ y: -3 }}
              className={`p-5 rounded-3xl bg-oat-100/60 border-2 ${goal.borderColor} shadow-sm relative overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-cozy`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span
                      className={`inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${goal.badgeBg}`}
                    >
                      {goal.shortName}
                    </span>
                    <div className="mt-2">
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
                            className="w-16 bg-oat-50 border border-maldives-500 rounded-lg px-2 py-0.5 text-right font-mono font-bold text-maldives-700 text-xs focus:outline-none"
                          />
                          <span className="text-xs text-maldives-700 font-bold">%</span>
                        </div>
                      ) : (
                        <span className="text-xs font-mono font-bold text-espresso-600">
                          Meta Ideal: {targetPercent}%
                        </span>
                      )}
                    </div>
                  </div>

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
                  <div className="text-2xl font-mono font-extrabold text-espresso-900 tracking-tight">
                    {formatCurrency(spent)}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1 text-espresso-600">
                    <span>Teto: {formatCurrency(idealAmount)}</span>
                    <span
                      className={`font-bold font-mono ${
                        isOverBudget ? 'text-terracotta-600' : 'text-espresso-800'
                      }`}
                    >
                      {formatPercent(currentPercent)} da renda
                    </span>
                  </div>
                </div>

                <div className="w-full bg-oat-200/90 rounded-full h-3 mt-3.5 overflow-hidden p-0.5 border border-oat-300">
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

                <p className="text-[11px] text-espresso-500 mt-2.5 leading-relaxed">
                  {goal.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-oat-200/90 flex items-center justify-between text-xs">
                <span className="text-espresso-600 font-medium">
                  {cat === 'investimento' ? 'Status do Aporte:' : 'Margem do Teto:'}
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
                    ? 'Na medida certa ✨'
                    : cat === 'investimento'
                    ? diff > 0
                      ? `+${formatCurrency(diff)} acima 🌿`
                      : `Faltam ${formatCurrency(Math.abs(diff))}`
                    : diff < 0
                    ? `Folga de ${formatCurrency(Math.abs(diff))}`
                    : `Excedeu ${formatCurrency(diff)} ⚠️`}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

