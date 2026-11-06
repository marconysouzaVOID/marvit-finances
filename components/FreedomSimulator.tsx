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
    <div className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-5 sm:p-6 shadow-cozy">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-maldives-600 text-xl">
              sailing
            </span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-espresso-900">
              Simulador de Liberdade Financeira & Reserva
            </h2>
            <p className="text-xs text-espresso-600">
              Descubra o patrimônio necessário para que seus rendimentos paguem todas as contas da casa.
            </p>
          </div>
        </div>

        <span className="text-xs bg-maldives-100 text-maldives-800 border border-maldives-300 font-bold px-3 py-1 rounded-full self-start sm:self-auto">
          Método FIRE • Marvit Pro
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {/* 1. Reserva de Segurança */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-oat-100/70 p-5 rounded-3xl border-2 border-sage-300 flex flex-col justify-between shadow-sm"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-sage-600 tracking-wider block">
                  1. Reserva da Despensa
                </span>
                <div className="text-2xl font-mono font-extrabold text-espresso-900 mt-1.5">
                  {formatCurrency(emergencyFundTarget)}
                </div>
              </div>
              <InteractiveAsset
                src="/assets/marvit-reserva.png"
                alt="Reserva de Segurança"
                size="md"
                tone="sage"
                badgeIcon="shield_with_heart"
              />
            </div>

            <p className="text-xs text-espresso-600 mt-3 leading-relaxed">
              Equivalente a{' '}
              <strong className="text-espresso-900">
                {profile.desiredEmergencyMonths} meses
              </strong>{' '}
              dos seus custos essenciais ({formatCurrency(monthlyEssentialCost)}/mês).
              Mantenha em liquidez diária segura (Tesouro Selic / CDB 100% CDI).
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-oat-200 text-xs text-espresso-600 flex items-center justify-between">
            <span>Tempo p/ formar do zero:</span>
            <span className="font-bold text-sage-600 font-mono bg-sage-100 px-2.5 py-0.5 rounded-lg border border-sage-200">
              {monthlyInvestment > 0
                ? `${Math.ceil(emergencyFundTarget / monthlyInvestment)} meses`
                : 'Defina aportes'}
            </span>
          </div>
        </motion.div>

        {/* 2. Liberdade Básica */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-oat-100/70 p-5 rounded-3xl border-2 border-terracotta-200 flex flex-col justify-between shadow-sm"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-terracotta-600 tracking-wider block">
                  2. Liberdade Essencial
                </span>
                <div className="text-2xl font-mono font-extrabold text-espresso-900 mt-1.5">
                  {formatCurrency(fireEssencial)}
                </div>
              </div>
              <InteractiveAsset
                src="/assets/marvit-essencial.png"
                alt="Liberdade Essencial"
                size="md"
                tone="terracotta"
                badgeIcon="cottage"
              />
            </div>

            <p className="text-xs text-espresso-600 mt-3 leading-relaxed">
              Patrimônio acumulado capaz de gerar{' '}
              <strong className="text-espresso-900">
                {formatCurrency(monthlyEssentialCost)}/mês
              </strong>{' '}
              em renda passiva vitalícia, garantindo casa e despensa cheias para sempre.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-oat-200 text-xs text-espresso-600 flex items-center justify-between">
            <span>Horizonte estimado:</span>
            <span className="font-bold text-terracotta-700 font-mono bg-terracotta-100 px-2.5 py-0.5 rounded-lg border border-terracotta-200">
              {monthlyInvestment > 0 ? `~${yearsToFireEssencial} anos` : 'Sem aportes'}
            </span>
          </div>
        </motion.div>

        {/* 3. Liberdade Plena (Maldivas Life) */}
        <motion.div
          whileHover={{ y: -3 }}
          className="bg-gradient-to-b from-maldives-50/90 to-oat-50 p-5 rounded-3xl border-2 border-maldives-400 flex flex-col justify-between shadow-cozy"
        >
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-maldives-700 tracking-wider block">
                  3. Liberdade Plena (Maldivas)
                </span>
                <div className="text-2xl font-mono font-extrabold text-maldives-700 mt-1.5">
                  {formatCurrency(firePleno)}
                </div>
              </div>
              <InteractiveAsset
                src="/assets/marvit-liberdade.png"
                alt="Liberdade Plena Maldivas"
                size="md"
                tone="maldives"
                badgeIcon="diamond"
              />
            </div>

            <p className="text-xs text-espresso-700 mt-3 leading-relaxed">
              Patrimônio investido que cobre seu custo de vida completo com lazer (
              <strong className="text-maldives-800">
                {formatCurrency(monthlyTotalCost)}/mês
              </strong>
              ) a uma taxa de retirada perpétua segura de {safeWithdrawalRate}% a.a.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-maldives-200 text-xs text-espresso-700 flex items-center justify-between">
            <span>Horizonte c/ aporte atual:</span>
            <span className="font-bold text-maldives-800 font-mono bg-maldives-100 px-2.5 py-0.5 rounded-lg border border-maldives-300">
              {monthlyInvestment > 0 ? `~${yearsToFirePleno} anos` : 'Aporte zerado'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Parâmetros de Simulação */}
      <div className="mt-5 p-4 rounded-2xl bg-oat-100/90 border border-oat-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-espresso-700 font-semibold">
              Rentabilidade Anual:
            </span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="30"
              value={rateAnnual}
              onChange={(e) => setRateAnnual(Number(e.target.value))}
              className="w-16 bg-oat-50 border border-oat-300 rounded-xl px-2 py-1 text-espresso-900 font-mono font-bold text-center focus:outline-none focus:border-maldives-500"
            />
            <span className="text-espresso-600">% a.a.</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-espresso-700 font-semibold">
              Taxa Real de Retirada:
            </span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="15"
              value={safeWithdrawalRate}
              onChange={(e) => setSafeWithdrawalRate(Number(e.target.value))}
              className="w-16 bg-oat-50 border border-oat-300 rounded-xl px-2 py-1 text-espresso-900 font-mono font-bold text-center focus:outline-none focus:border-maldives-500"
            />
            <span className="text-espresso-600">% a.a.</span>
          </div>
        </div>

        <div className="text-espresso-700 text-right w-full sm:w-auto font-medium">
          Aporte mensal em liberdade:{' '}
          <strong className="text-maldives-700 font-mono">
            {formatCurrency(monthlyInvestment)}/mês
          </strong>
        </div>
      </div>
    </div>
  );
};

