import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FinancialProfile } from '../types';
import {
  calculateFireTarget,
  estimateMonthsToFire,
  formatCurrency,
} from '../utils/formatters';
import { InteractiveAsset } from './InteractiveAsset';

interface FreedomSimulatorProps {
  monthlyEssentialCost: number;
  monthlyTotalCost: number;
  monthlyInvestment: number;
  profile: FinancialProfile;
}

export const FreedomSimulator: React.FC<FreedomSimulatorProps> = ({
  monthlyEssentialCost,
  monthlyTotalCost,
  monthlyInvestment,
  profile,
}) => {
  const [rateAnnual, setRateAnnual] = useState(10.5);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState(6.0);

  const emergencyFundTarget = monthlyEssentialCost * profile.desiredEmergencyMonths;
  const firePleno = calculateFireTarget(monthlyTotalCost, safeWithdrawalRate / 100);
  const fireEssencial = calculateFireTarget(
    monthlyEssentialCost,
    safeWithdrawalRate / 100
  );

  const monthsToFirePleno = estimateMonthsToFire(
    monthlyInvestment,
    firePleno,
    rateAnnual / 100
  );
  const yearsToFirePleno = (monthsToFirePleno / 12).toFixed(1);

  const monthsToFireEssencial = estimateMonthsToFire(
    monthlyInvestment,
    fireEssencial,
    rateAnnual / 100
  );
  const yearsToFireEssencial = (monthsToFireEssencial / 12).toFixed(1);

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 dark:border-white/[0.07] rounded-3xl p-3 sm:p-6 shadow-cozy overflow-hidden">
      <div className="flex items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-oat-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-maldives-600 text-lg sm:text-xl">
              sailing
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-display font-bold text-espresso-900 truncate">
              Simulador FIRE
            </h2>
            <p className="text-xs text-espresso-600 hidden sm:block">
              Descubra o patrimônio necessário para que seus rendimentos paguem todas as contas da casa.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-4 mt-3 sm:mt-5">
        {/* 1. Reserva de Segurança */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-oat-100/70 dark:bg-oat-200/45 p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-sage-300 dark:border-sage-300/35 flex flex-col justify-between shadow-sm min-w-0"
        >
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 w-full">
                <span className="text-[9.5px] sm:text-xs font-bold uppercase text-sage-600 tracking-tight sm:tracking-wider block truncate">
                  <span className="sm:hidden">1. Reserva</span>
                  <span className="hidden sm:inline">1. Reserva de Emergência</span>
                </span>
                <div className="text-[11px] sm:text-2xl font-mono font-extrabold tracking-tighter sm:tracking-normal text-espresso-900 mt-1 leading-tight break-words">
                  {formatCurrency(emergencyFundTarget)}
                </div>
                <span className="text-[9px] text-espresso-500 mt-0.5 block sm:hidden">
                  {profile.desiredEmergencyMonths}m essenciais
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                <InteractiveAsset
                  src="/assets/marvit-reserva.png"
                  alt="Reserva de Segurança"
                  size="md"
                  tone="sage"
                  badgeIcon="shield_with_heart"
                />
              </div>
            </div>

            <p className="text-xs text-espresso-600 mt-3 leading-relaxed hidden sm:block">
              Equivalente a{' '}
              <strong className="text-espresso-900">
                {profile.desiredEmergencyMonths} meses
              </strong>{' '}
              dos seus custos essenciais ({formatCurrency(monthlyEssentialCost)}/mês).
              Mantenha em liquidez diária segura (Tesouro Selic / CDB 100% CDI).
            </p>
          </div>

          <div className="mt-2 sm:mt-4 pt-1.5 sm:pt-3 border-t border-oat-200 text-[9.5px] sm:text-xs text-espresso-600 flex items-center justify-between gap-1">
            <span className="hidden sm:inline">Tempo p/ formar do zero:</span>
            <span className="sm:hidden">Prazo:</span>
            <span className="font-bold text-sage-600 font-mono bg-sage-100 px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg border border-sage-200 shrink-0">
              {monthlyInvestment > 0
                ? `${Math.ceil(emergencyFundTarget / monthlyInvestment)}m`
                : '—'}
            </span>
          </div>
        </motion.div>

        {/* 2. Liberdade Básica */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-oat-100/70 dark:bg-oat-200/45 p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-terracotta-200 dark:border-terracotta-300/35 flex flex-col justify-between shadow-sm min-w-0"
        >
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 w-full">
                <span className="text-[9.5px] sm:text-xs font-bold uppercase text-terracotta-600 tracking-tight sm:tracking-wider block truncate">
                  <span className="sm:hidden">2. Essencial</span>
                  <span className="hidden sm:inline">2. Liberdade Essencial</span>
                </span>
                <div className="text-[11px] sm:text-2xl font-mono font-extrabold tracking-tighter sm:tracking-normal text-espresso-900 mt-1 leading-tight break-words">
                  {formatCurrency(fireEssencial)}
                </div>
                <span className="text-[9px] text-espresso-500 mt-0.5 block sm:hidden truncate">
                  Custo base/mês
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                <InteractiveAsset
                  src="/assets/marvit-essencial.png"
                  alt="Liberdade Essencial"
                  size="md"
                  tone="terracotta"
                  badgeIcon="cottage"
                />
              </div>
            </div>

            <p className="text-xs text-espresso-600 mt-3 leading-relaxed hidden sm:block">
              Patrimônio acumulado capaz de gerar{' '}
              <strong className="text-espresso-900">
                {formatCurrency(monthlyEssentialCost)}/mês
              </strong>{' '}
              em renda passiva vitalícia, garantindo segurança e tranquilidade financeira para sempre.
            </p>
          </div>

          <div className="mt-2 sm:mt-4 pt-1.5 sm:pt-3 border-t border-oat-200 text-[9.5px] sm:text-xs text-espresso-600 flex items-center justify-between gap-1">
            <span className="hidden sm:inline">Horizonte estimado:</span>
            <span className="sm:hidden">Prazo:</span>
            <span className="font-bold text-terracotta-700 font-mono bg-terracotta-100 px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg border border-terracotta-200 shrink-0">
              {monthlyInvestment > 0 ? `~${yearsToFireEssencial}a` : '—'}
            </span>
          </div>
        </motion.div>

        {/* 3. Liberdade Plena (Maldivas Life) */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-gradient-to-b from-maldives-50/90 to-oat-50 dark:from-maldives-100/40 dark:to-oat-50 p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-maldives-400/70 dark:border-maldives-400/40 flex flex-col justify-between shadow-cozy min-w-0"
        >
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 w-full">
                <span className="text-[9.5px] sm:text-xs font-bold uppercase text-maldives-700 tracking-tight sm:tracking-wider block truncate">
                  <span className="sm:hidden">3. Plena</span>
                  <span className="hidden sm:inline">3. Liberdade Plena (Maldivas)</span>
                </span>
                <div className="text-[11px] sm:text-2xl font-mono font-extrabold tracking-tighter sm:tracking-normal text-maldives-700 mt-1 leading-tight break-words">
                  {formatCurrency(firePleno)}
                </div>
                <span className="text-[9px] text-espresso-600 mt-0.5 block sm:hidden truncate">
                  Vida completa
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                <InteractiveAsset
                  src="/assets/marvit-liberdade.png"
                  alt="Liberdade Plena Maldivas"
                  size="md"
                  tone="maldives"
                  badgeIcon="diamond"
                />
              </div>
            </div>

            <p className="text-xs text-espresso-700 mt-3 leading-relaxed hidden sm:block">
              Patrimônio investido que cobre seu custo de vida completo com lazer (
              <strong className="text-maldives-800">
                {formatCurrency(monthlyTotalCost)}/mês
              </strong>
              ) a uma taxa de retirada perpétua segura de {safeWithdrawalRate}% a.a.
            </p>
          </div>

          <div className="mt-2 sm:mt-4 pt-1.5 sm:pt-3 border-t border-maldives-200 text-[9.5px] sm:text-xs text-espresso-700 flex items-center justify-between gap-1">
            <span className="hidden sm:inline">Horizonte c/ aporte atual:</span>
            <span className="sm:hidden">Prazo:</span>
            <span className="font-bold text-maldives-800 font-mono bg-maldives-100 px-1.5 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg border border-maldives-300 shrink-0">
              {monthlyInvestment > 0 ? `~${yearsToFirePleno}a` : '—'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Parâmetros de Simulação */}
      <div className="mt-3 sm:mt-5 p-2.5 sm:p-4 rounded-2xl bg-oat-100/90 dark:bg-oat-200/50 border border-oat-300 dark:border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 text-[11px] sm:text-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-1.5">
            <span className="text-espresso-700 font-semibold">
              Rentabilidade:
            </span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="30"
              value={rateAnnual}
              onChange={(e) => setRateAnnual(Number(e.target.value))}
              className="compact-select w-14 sm:w-16 bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-lg px-1.5 py-0.5 sm:py-1 text-espresso-900 font-mono font-bold text-center focus:outline-none focus:border-maldives-500"
            />
            <span className="text-espresso-600">% a.a.</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-espresso-700 font-semibold">
              Retirada:
            </span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="15"
              value={safeWithdrawalRate}
              onChange={(e) => setSafeWithdrawalRate(Number(e.target.value))}
              className="compact-select w-14 sm:w-16 bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-lg px-1.5 py-0.5 sm:py-1 text-espresso-900 font-mono font-bold text-center focus:outline-none focus:border-maldives-500"
            />
            <span className="text-espresso-600">% a.a.</span>
          </div>
        </div>

        <div className="text-espresso-700 sm:text-right w-full sm:w-auto font-medium">
          Aporte em liberdade:{' '}
          <strong className="text-maldives-700 font-mono">
            {formatCurrency(monthlyInvestment)}/mês
          </strong>
        </div>
      </div>
    </div>
  );
};

