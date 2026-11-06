import React from 'react';
import { motion } from 'framer-motion';
import { FinancialProfile } from '../types';
import { formatCurrency } from '../utils/formatters';

interface IncomeCardProps {
  profile: FinancialProfile;
  onChangeProfile: (profile: FinancialProfile) => void;
  balance: number;
  totalExpenses: number;
}

export const IncomeCard: React.FC<IncomeCardProps> = ({
  profile,
  onChangeProfile,
  balance,
  totalExpenses,
}) => {
  const totalIncome = profile.monthlyIncome + profile.additionalIncome;
  const committedPercent =
    totalIncome > 0 ? Math.min(100, Math.round((totalExpenses / totalIncome) * 100)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-4 sm:p-6 shadow-cozy relative overflow-hidden"
    >
      {/* Textura decorativa de canto */}
      <div className="absolute top-0 right-0 w-36 h-36 rounded-full bg-maldives-500/10 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full bg-terracotta-400/10 blur-2xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-oat-200 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center shadow-sm shrink-0">
            <span className="material-symbols-outlined text-maldives-600 text-xl sm:text-2xl">
              account_balance_wallet
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-display font-bold text-espresso-900">
                Renda Líquida da Casa
              </h2>
              <span className="text-[10px] sm:text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sage-100 text-sage-600 border border-sage-200 shrink-0">
                {committedPercent}% alocado
              </span>
            </div>
            <p className="text-xs sm:text-sm text-espresso-600 mt-0.5">
              Base mensal para abastecer os pilares e seus Potes dos Sonhos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3">
          <div className="px-3 sm:px-4 py-2.5 bg-maldives-50/90 border border-maldives-200 rounded-2xl shadow-cozy-inner min-w-0">
            <span className="text-[10px] uppercase font-bold text-maldives-800 tracking-wider block truncate">
              Renda Disponível
            </span>
            <span className="text-base sm:text-xl font-mono font-bold text-maldives-700 block truncate">
              {formatCurrency(totalIncome)}
            </span>
          </div>

          <div
            className={`px-3 sm:px-4 py-2.5 rounded-2xl border transition-colors min-w-0 ${
              balance >= 0
                ? 'bg-sage-50 border-sage-300'
                : 'bg-terracotta-50 border-terracotta-300'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-espresso-600 tracking-wider block truncate">
              {balance >= 0 ? 'Sobra Livre' : 'Déficit no Mês'}
            </span>
            <span
              className={`text-base sm:text-xl font-mono font-bold block truncate ${
                balance >= 0 ? 'text-sage-600' : 'text-terracotta-600'
              }`}
            >
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5 relative z-10">
        <div className="bg-oat-100/70 p-3.5 rounded-2xl border border-oat-200">
          <label className="text-xs font-semibold text-espresso-700 mb-1.5 flex items-center justify-between">
            <span>Salário / Pró-labore Líquido</span>
            <span className="text-[10px] text-maldives-700 bg-maldives-100/80 px-2 py-0.5 rounded-full font-mono">
              Principal
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-xs font-bold text-espresso-500 font-mono">
              R$
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={profile.monthlyIncome || ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  monthlyIncome: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full bg-oat-50 border border-oat-300 rounded-xl py-2 pl-10 pr-3 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500 focus:ring-2 focus:ring-maldives-500/15 transition"
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="bg-oat-100/70 p-3.5 rounded-2xl border border-oat-200">
          <label className="text-xs font-semibold text-espresso-700 mb-1.5 flex items-center justify-between">
            <span>Renda Extra & Dividendos</span>
            <span className="text-[10px] text-terracotta-600 bg-terracotta-100 px-2 py-0.5 rounded-full font-mono">
              Variável
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-xs font-bold text-espresso-500 font-mono">
              R$
            </span>
            <input
              type="number"
              min="0"
              step="50"
              value={profile.additionalIncome || ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  additionalIncome: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full bg-oat-50 border border-oat-300 rounded-xl py-2 pl-10 pr-3 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500 focus:ring-2 focus:ring-maldives-500/15 transition"
              placeholder="0,00"
            />
          </div>
        </div>

        <div className="bg-oat-100/70 p-3.5 rounded-2xl border border-oat-200 sm:col-span-2 lg:col-span-1">
          <label className="text-xs font-semibold text-espresso-700 mb-2 flex items-center justify-between gap-2">
            <span className="truncate">Meta de Reserva da Despensa</span>
            <span className="text-[11px] text-maldives-700 font-mono font-bold shrink-0">
              {profile.desiredEmergencyMonths} meses de custo
            </span>
          </label>
          <div className="flex items-center gap-3 pt-1">
            <input
              type="range"
              min="3"
              max="12"
              value={profile.desiredEmergencyMonths}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  desiredEmergencyMonths: Number(e.target.value),
                })
              }
              className="w-full accent-maldives-500 bg-oat-200 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-bold text-maldives-800 px-2.5 py-1 bg-maldives-100 rounded-xl min-w-12 text-center font-mono border border-maldives-300">
              {profile.desiredEmergencyMonths}m
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

