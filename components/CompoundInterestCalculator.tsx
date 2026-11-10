import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CustomGoalItem, FinancialProfile } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface CompoundInterestCalculatorProps {
  profile: FinancialProfile;
  monthlyInvestmentAmount: number;
  longTermGoals: CustomGoalItem[];
}

export const CompoundInterestCalculator: React.FC<CompoundInterestCalculatorProps> = ({
  profile,
  monthlyInvestmentAmount,
  longTermGoals,
}) => {
  const [activeTab, setActiveTab] = useState<'automatic' | 'custom'>('automatic');

  // Saldo atual acumulado nas metas
  const initialAccumulatedCapital = useMemo(() => {
    return longTermGoals.reduce((acc, g) => acc + (g.currentAmount || 0), 0);
  }, [longTermGoals]);

  // --- MODO 1: PREVISÃO AUTOMÁTICA COM MEUS APORTES ---
  const [autoYears, setAutoYears] = useState<number>(10);
  const [autoAnnualRate, setAutoAnnualRate] = useState<number>(
    profile.expectedAnnualReturnRate || 10
  );
  const [autoMonthlyContribution, setAutoMonthlyContribution] = useState<number>(
    monthlyInvestmentAmount > 0 ? monthlyInvestmentAmount : 500
  );
  const [autoInitialCapital, setAutoInitialCapital] = useState<number>(
    initialAccumulatedCapital
  );

  // Recarregar dados atuais do app
  const handleSyncWithAppData = () => {
    setAutoMonthlyContribution(monthlyInvestmentAmount > 0 ? monthlyInvestmentAmount : 500);
    setAutoAnnualRate(profile.expectedAnnualReturnRate || 10);
    setAutoInitialCapital(initialAccumulatedCapital);
  };

  // Cálculo de Juros Compostos mês a mês
  const calculateCompoundInterest = (
    pv: number,
    pmt: number,
    annualRate: number,
    years: number
  ) => {
    const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
    const totalMonths = Math.round(years * 12);

    let currentBalance = pv;
    let totalInvested = pv;
    const yearlyBreakdown: Array<{
      year: number;
      invested: number;
      interestEarnedYear: number;
      totalInterest: number;
      balance: number;
      monthlyPassiveIncome: number;
    }> = [];

    let accumulatedInterest = 0;

    for (let m = 1; m <= totalMonths; m++) {
      const interestMonth = currentBalance * monthlyRate;
      currentBalance += interestMonth + pmt;
      totalInvested += pmt;
      accumulatedInterest += interestMonth;

      if (m % 12 === 0 || m === totalMonths) {
        const yearNum = Math.ceil(m / 12);
        // Renda passiva mensal estimada usando a rentabilidade anual real dividida por 12 (ou regra dos 4%)
        const monthlyPassiveIncome = (currentBalance * (annualRate / 100)) / 12;

        yearlyBreakdown.push({
          year: yearNum,
          invested: totalInvested,
          interestEarnedYear: interestMonth * 12,
          totalInterest: accumulatedInterest,
          balance: currentBalance,
          monthlyPassiveIncome,
        });
      }
    }

    return {
      finalBalance: currentBalance,
      totalInvested,
      totalInterest: accumulatedInterest,
      monthlyPassiveIncome: (currentBalance * (annualRate / 100)) / 12,
      yearlyBreakdown,
    };
  };

  const autoResult = useMemo(() => {
    return calculateCompoundInterest(
      autoInitialCapital,
      autoMonthlyContribution,
      autoAnnualRate,
      autoYears
    );
  }, [autoInitialCapital, autoMonthlyContribution, autoAnnualRate, autoYears]);

  // Marcos Fixos de Previsão Automática (1, 3, 5, 10, 20, 30 anos)
  const milestoneYears = [1, 3, 5, 10, 20, 30];
  const milestones = useMemo(() => {
    return milestoneYears.map((yr) => {
      const res = calculateCompoundInterest(
        autoInitialCapital,
        autoMonthlyContribution,
        autoAnnualRate,
        yr
      );
      return {
        years: yr,
        balance: res.finalBalance,
        invested: res.totalInvested,
        interest: res.totalInterest,
        monthlyPassiveIncome: res.monthlyPassiveIncome,
      };
    });
  }, [autoInitialCapital, autoMonthlyContribution, autoAnnualRate]);

  // --- MODO 2: CALCULADORA LIVRE ---
  const [freeInitial, setFreeInitial] = useState<number>(5000);
  const [freeMonthly, setFreeMonthly] = useState<number>(1000);
  const [freeRate, setFreeRate] = useState<number>(11);
  const [freeRateType, setFreeRateType] = useState<'annual' | 'monthly'>('annual');
  const [freePeriod, setFreePeriod] = useState<number>(15);
  const [freePeriodType, setFreePeriodType] = useState<'years' | 'months'>('years');
  const [showTable, setShowTable] = useState<boolean>(false);

  const effectiveFreeAnnualRate =
    freeRateType === 'annual'
      ? freeRate
      : (Math.pow(1 + freeRate / 100, 12) - 1) * 100;

  const effectiveFreeYears =
    freePeriodType === 'years' ? freePeriod : freePeriod / 12;

  const freeResult = useMemo(() => {
    return calculateCompoundInterest(
      freeInitial,
      freeMonthly,
      effectiveFreeAnnualRate,
      effectiveFreeYears
    );
  }, [freeInitial, freeMonthly, effectiveFreeAnnualRate, effectiveFreeYears]);

  return (
    <div className="space-y-6">
      {/* Header com Navegação Interna */}
      <div className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-oat-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-maldives-600 text-2xl">
                calculate
              </span>
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-espresso-900">
                Calculadora de Juros Compostos
              </h2>
              <p className="text-xs sm:text-sm text-espresso-600">
                Simule o poder multiplicador do tempo e da rentabilidade sobre seus aportes mensais.
              </p>
            </div>
          </div>

          {/* Toggle entre Previsão Automática e Simulador Livre */}
          <div className="flex items-center bg-oat-100 dark:bg-oat-200/60 p-1 rounded-2xl border border-oat-300 dark:border-white/[0.07] self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('automatic')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'automatic'
                  ? 'bg-maldives-500 text-white shadow-xs'
                  : 'text-espresso-600 hover:text-espresso-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                auto_awesome
              </span>
              <span>Previsão Automática</span>
            </button>

            <button
              onClick={() => setActiveTab('custom')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-maldives-500 text-white shadow-xs'
                  : 'text-espresso-600 hover:text-espresso-900'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                tune
              </span>
              <span>Simulador Livre</span>
            </button>
          </div>
        </div>

        {/* --- CONTEÚDO MODO AUTOMÁTICO --- */}
        {activeTab === 'automatic' && (
          <div className="mt-5 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-maldives-50/60 border border-maldives-200 dark:border-maldives-300/25 p-4 rounded-2xl">
              <div>
                <p className="text-xs font-bold text-maldives-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">
                    sync
                  </span>
                  Previsão conectada aos seus aportes reais do Marvit&Finances
                </p>
                <p className="text-xs text-espresso-600 mt-0.5">
                  Aporte do orçamento:{' '}
                  <span className="font-mono font-bold text-espresso-900">
                    {formatCurrency(monthlyInvestmentAmount)}/mês
                  </span>{' '}
                  | Saldo atual nos potes:{' '}
                  <span className="font-mono font-bold text-espresso-900">
                    {formatCurrency(initialAccumulatedCapital)}
                  </span>
                </p>
              </div>

              <button
                onClick={handleSyncWithAppData}
                className="px-3 py-1.5 rounded-xl bg-oat-50 dark:bg-oat-200/80 hover:bg-maldives-100 text-maldives-800 font-bold text-xs border border-maldives-300 dark:border-maldives-300/35 transition flex items-center gap-1.5 cursor-pointer shrink-0 self-start md:self-auto shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">
                  refresh
                </span>
                Recarregar Dados Atuais
              </button>
            </div>

            {/* Parâmetros da Previsão Automática */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <label className="text-xs font-semibold text-espresso-700 block mb-1">
                  Patrimônio Atual Inicial
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={autoInitialCapital}
                  onChange={(e) => setAutoInitialCapital(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
                <span className="text-[10px] text-espresso-500 mt-1 block">
                  Soma dos seus potes de metas
                </span>
              </div>

              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <label className="text-xs font-semibold text-espresso-700 block mb-1">
                  Aporte Mensal Previsto
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={autoMonthlyContribution}
                  onChange={(e) => setAutoMonthlyContribution(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
                <span className="text-[10px] text-espresso-500 mt-1 block">
                  Valor investido a cada mês
                </span>
              </div>

              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <label className="text-xs font-semibold text-espresso-700 block mb-1">
                  Rentabilidade Esperada (% ao ano)
                </label>
                <input
                  type="number"
                  min="1"
                  max="40"
                  step="0.5"
                  value={autoAnnualRate}
                  onChange={(e) => setAutoAnnualRate(Math.max(0.1, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
                <span className="text-[10px] text-espresso-500 mt-1 block">
                  Ex: 10% a 12% a.a. em renda fixa/fundos
                </span>
              </div>
            </div>

            {/* Slider de Horizonte em Anos */}
            <div className="bg-oat-100/70 dark:bg-oat-200/50 p-4 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-espresso-700">
                  Prazo de Acumulação: <span className="text-maldives-700 font-mono text-sm">{autoYears} anos</span> ({autoYears * 12} meses)
                </span>
                <div className="flex items-center gap-1.5">
                  {[5, 10, 20, 30].map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setAutoYears(yr)}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-bold font-mono transition cursor-pointer ${
                        autoYears === yr
                          ? 'bg-maldives-500 text-white'
                          : 'bg-oat-200 text-espresso-600 hover:bg-oat-300'
                      }`}
                    >
                      {yr} anos
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={autoYears}
                onChange={(e) => setAutoYears(Number(e.target.value))}
                className="w-full accent-maldives-500 cursor-pointer"
              />
            </div>

            {/* Resultado Principal em Destaque */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-ink dark:bg-gradient-to-br dark:from-[#1B232B] dark:to-[#132125] border border-transparent dark:border-maldives-500/25 text-white p-5 rounded-2xl shadow-cozy flex flex-col justify-between">
                <div>
                  <span className="text-xs text-white/70 font-bold block mb-1">
                    Patrimônio Estimado em {autoYears} Anos
                  </span>
                  <p className="text-2xl sm:text-3xl font-extrabold font-mono text-[#5EEAD4]">
                    {formatCurrency(autoResult.finalBalance)}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 text-xs space-y-1">
                  <div className="flex justify-between text-white/75">
                    <span>Aportes do Bolso:</span>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(autoResult.totalInvested)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[#5EEAD4]">
                    <span>Juros Acumulados:</span>
                    <span className="font-mono font-bold">
                      {formatCurrency(autoResult.totalInterest)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-maldives-50/90 border border-maldives-200 dark:border-maldives-300/25 p-5 rounded-2xl shadow-cozy flex flex-col justify-between">
                <div>
                  <span className="text-xs text-maldives-800 font-bold block mb-1">
                    Renda Passiva Mensal Estimada
                  </span>
                  <p className="text-2xl sm:text-3xl font-extrabold font-mono text-maldives-700">
                    {formatCurrency(autoResult.monthlyPassiveIncome)}
                    <span className="text-xs text-espresso-600 font-normal block font-sans mt-0.5">
                      /mês pingando na conta
                    </span>
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-maldives-200 dark:border-white/[0.08] text-xs text-espresso-700">
                  <p>
                    Com esse patrimônio, seu dinheiro trabalha por você sem que você precise mexer no valor principal.
                  </p>
                </div>
              </div>

              <div className="bg-oat-100/90 dark:bg-oat-200/55 border border-oat-300 dark:border-white/[0.07] p-5 rounded-2xl shadow-cozy flex flex-col justify-between">
                <div>
                  <span className="text-xs text-espresso-600 font-bold block mb-1">
                    Efeito Bola de Neve (Multiplicação)
                  </span>
                  <p className="text-2xl sm:text-3xl font-extrabold font-mono text-terracotta-600">
                    {autoResult.totalInvested > 0
                      ? `${(autoResult.finalBalance / autoResult.totalInvested).toFixed(1)}x`
                      : '1.0x'}
                  </p>
                  <p className="text-xs text-espresso-600 mt-1">
                    Os juros representam{' '}
                    <span className="font-bold text-espresso-900 font-mono">
                      {formatPercent(autoResult.finalBalance > 0 ? (autoResult.totalInterest / autoResult.finalBalance) * 100 : 0)}
                    </span>{' '}
                    de todo o patrimônio final!
                  </p>
                </div>

                {/* Barra de Proporção Bolso vs Juros */}
                <div className="mt-4 pt-2">
                  <div className="h-3 w-full bg-oat-200 dark:bg-white/[0.08] rounded-full overflow-hidden flex">
                    <div
                      style={{
                        width: `${Math.min(100, autoResult.finalBalance > 0 ? (autoResult.totalInvested / autoResult.finalBalance) * 100 : 100)}%`,
                      }}
                      className="bg-espresso-600 dark:bg-espresso-500 h-full"
                      title="Total Aportado"
                    />
                    <div
                      style={{
                        width: `${Math.min(100, autoResult.finalBalance > 0 ? (autoResult.totalInterest / autoResult.finalBalance) * 100 : 0)}%`,
                      }}
                      className="bg-maldives-500 h-full"
                      title="Juros Ganhos"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-espresso-500 font-mono mt-1">
                    <span>Aportes</span>
                    <span>Juros Compostos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Marcos Futuros em Cards */}
            <div>
              <h3 className="text-base font-display font-bold text-espresso-900 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-maldives-600">
                  flag
                </span>
                Marcos de Liberdade ao Longo do Tempo
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {milestones.map((ms) => (
                  <div
                    key={ms.years}
                    onClick={() => setAutoYears(ms.years)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                      autoYears === ms.years
                        ? 'bg-maldives-50 border-maldives-500/80 ring-2 ring-maldives-500/25'
                        : 'bg-oat-100/70 dark:bg-oat-200/45 border-oat-200 dark:border-white/[0.06] hover:border-maldives-300/60'
                    }`}
                  >
                    <div>
                      <span className="text-[11px] font-bold text-espresso-600 block">
                        Em {ms.years} {ms.years === 1 ? 'ano' : 'anos'}
                      </span>
                      <p className="text-sm font-bold font-mono text-espresso-900 mt-1">
                        {formatCurrency(ms.balance)}
                      </p>
                    </div>
                    <div className="mt-2 pt-2 border-t border-oat-200 dark:border-white/[0.06] text-[10px] font-mono text-maldives-700">
                      <span>Renda passiva:</span>
                      <span className="font-bold block">{formatCurrency(ms.monthlyPassiveIncome)}/mês</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- CONTEÚDO MODO LIVRE (SIMULADOR CUSTOMIZÁVEL) --- */}
        {activeTab === 'custom' && (
          <div className="mt-5 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <label className="text-xs font-semibold text-espresso-700 block mb-1">
                  Valor Inicial (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={freeInitial}
                  onChange={(e) => setFreeInitial(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
              </div>

              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <label className="text-xs font-semibold text-espresso-700 block mb-1">
                  Aporte Mensal (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={freeMonthly}
                  onChange={(e) => setFreeMonthly(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
              </div>

              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-espresso-700">
                    Taxa de Juros (%)
                  </label>
                  <div className="flex text-[10px] bg-oat-200 dark:bg-oat-100 rounded-lg p-0.5 font-bold">
                    <button
                      onClick={() => setFreeRateType('annual')}
                      className={`px-1.5 py-0.5 rounded transition ${
                        freeRateType === 'annual' ? 'bg-oat-50 shadow-xs text-espresso-900' : 'text-espresso-500'
                      }`}
                    >
                      a.a.
                    </button>
                    <button
                      onClick={() => setFreeRateType('monthly')}
                      className={`px-1.5 py-0.5 rounded transition ${
                        freeRateType === 'monthly' ? 'bg-oat-50 shadow-xs text-espresso-900' : 'text-espresso-500'
                      }`}
                    >
                      a.m.
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={freeRate}
                  onChange={(e) => setFreeRate(Math.max(0.01, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
              </div>

              <div className="bg-oat-100/70 dark:bg-oat-200/50 p-3.5 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-espresso-700">
                    Período
                  </label>
                  <div className="flex text-[10px] bg-oat-200 dark:bg-oat-100 rounded-lg p-0.5 font-bold">
                    <button
                      onClick={() => setFreePeriodType('years')}
                      className={`px-1.5 py-0.5 rounded transition ${
                        freePeriodType === 'years' ? 'bg-oat-50 shadow-xs text-espresso-900' : 'text-espresso-500'
                      }`}
                    >
                      Anos
                    </button>
                    <button
                      onClick={() => setFreePeriodType('months')}
                      className={`px-1.5 py-0.5 rounded transition ${
                        freePeriodType === 'months' ? 'bg-oat-50 shadow-xs text-espresso-900' : 'text-espresso-500'
                      }`}
                    >
                      Meses
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="600"
                  value={freePeriod}
                  onChange={(e) => setFreePeriod(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:ring-2 focus:ring-maldives-500"
                />
              </div>
            </div>

            {/* Resultados do Simulador Livre */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-surface-ink dark:bg-gradient-to-br dark:from-[#1B232B] dark:to-[#132125] border border-transparent dark:border-maldives-500/25 text-white p-4 rounded-2xl shadow-cozy">
                <span className="text-[11px] text-white/70 font-semibold block mb-0.5">
                  Valor Total Final
                </span>
                <p className="text-xl sm:text-2xl font-bold font-mono text-[#5EEAD4]">
                  {formatCurrency(freeResult.finalBalance)}
                </p>
              </div>

              <div className="bg-oat-100 dark:bg-oat-200/55 p-4 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
                <span className="text-[11px] text-espresso-500 font-semibold block mb-0.5">
                  Total Investido (Bolso)
                </span>
                <p className="text-xl sm:text-2xl font-bold font-mono text-espresso-900">
                  {formatCurrency(freeResult.totalInvested)}
                </p>
              </div>

              <div className="bg-maldives-50 p-4 rounded-2xl border border-maldives-200 dark:border-maldives-300/25">
                <span className="text-[11px] text-maldives-800 font-semibold block mb-0.5">
                  Total em Juros Ganhos
                </span>
                <p className="text-xl sm:text-2xl font-bold font-mono text-maldives-700">
                  {formatCurrency(freeResult.totalInterest)}
                </p>
              </div>

              <div className="bg-terracotta-50 p-4 rounded-2xl border border-terracotta-200 dark:border-terracotta-300/25">
                <span className="text-[11px] text-terracotta-800 font-semibold block mb-0.5">
                  Renda Passiva Mensal
                </span>
                <p className="text-xl sm:text-2xl font-bold font-mono text-terracotta-700">
                  {formatCurrency(freeResult.monthlyPassiveIncome)}
                </p>
              </div>
            </div>

            {/* Botão para Exibir Tabela Detalhada Ano a Ano */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => setShowTable(!showTable)}
                className="px-4 py-2 rounded-xl bg-oat-100 hover:bg-oat-200 text-xs font-bold text-espresso-800 border border-oat-300 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showTable ? 'expand_less' : 'table_rows'}
                </span>
                <span>{showTable ? 'Ocultar Tabela Ano a Ano' : 'Ver Tabela Detalhada Ano a Ano'}</span>
              </button>
            </div>

            {showTable && (
              <div className="overflow-x-auto bg-oat-100/70 p-3 rounded-2xl border border-oat-200">
                <table className="w-full text-xs text-left font-mono">
                  <thead>
                    <tr className="border-b border-oat-300 text-espresso-600 font-sans font-bold">
                      <th className="py-2 px-3">Ano</th>
                      <th className="py-2 px-3">Total Investido</th>
                      <th className="py-2 px-3">Juros Acumulados</th>
                      <th className="py-2 px-3">Saldo Final</th>
                      <th className="py-2 px-3">Renda Passiva/mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-oat-200">
                    {freeResult.yearlyBreakdown.map((row) => (
                      <tr key={row.year} className="hover:bg-oat-200/50">
                        <td className="py-2 px-3 font-sans font-bold text-espresso-900">
                          Ano {row.year}
                        </td>
                        <td className="py-2 px-3 text-espresso-700">
                          {formatCurrency(row.invested)}
                        </td>
                        <td className="py-2 px-3 text-maldives-700 font-bold">
                          {formatCurrency(row.totalInterest)}
                        </td>
                        <td className="py-2 px-3 text-espresso-900 font-bold">
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="py-2 px-3 text-terracotta-600 font-bold">
                          {formatCurrency(row.monthlyPassiveIncome)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

