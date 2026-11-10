import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExpenseCategory, ExpenseItem, FinancialProfile, MonthDataRecord, MonthSnapshot } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { formatMonthKeyLabel, formatMonthKeySlashLabel, inferMonthKeyFromLabel } from './MonthCalendarBar';

const SHORT_MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatShortMonthSlash(monthKey: string): string {
  const parts = (monthKey || '').split('-');
  if (parts.length === 2) {
    const year = parts[0].slice(-2);
    const monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${SHORT_MONTHS_PT[monthIdx]}/${year}`;
    }
  }
  return monthKey;
}

interface FinancialChartsProps {
  monthsData: Record<string, MonthDataRecord>;
  history: MonthSnapshot[];
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  currentMonthExpenses: ExpenseItem[];
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
}

interface MonthMetric {
  key: string;
  label: string;
  slashLabel: string;
  shortLabel: string;
  totalIncome: number;
  totalExpenses: number;
  essencial: number;
  estilo: number;
  investimento: number;
  balance: number;
  savingsRate: number; // %
  expenses: ExpenseItem[];
}

export const FinancialCharts: React.FC<FinancialChartsProps> = ({
  monthsData,
  history,
  selectedMonthKey,
  onSelectMonth,
  currentMonthExpenses,
  profile,
  customGoals,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ExpenseCategory>('all');
  const [hoveredMonthKey, setHoveredMonthKey] = useState<string | null>(null);
  const [selectedChartMonthKey, setSelectedChartMonthKey] = useState<string>(selectedMonthKey);

  useEffect(() => {
    setSelectedChartMonthKey(selectedMonthKey);
  }, [selectedMonthKey]);

  // Compilar métricas cronológicas de todos os meses disponíveis (do histórico + monthsData)
  const allMonthsMetrics = useMemo<MonthMetric[]>(() => {
    const map = new Map<string, MonthMetric>();

    // 1. Histórico
    for (const snap of history) {
      const mKey = snap.monthKey || inferMonthKeyFromLabel(snap.monthLabel, snap.dateCreated) || selectedMonthKey;
      const income = (snap.profile.monthlyIncome || 0) + (snap.profile.additionalIncome || 0);
      let es = 0;
      let est = 0;
      let inv = 0;
      const exps = snap.expenses || [];
      for (const e of exps) {
        if (e.category === 'essencial') es += e.amount;
        else if (e.category === 'estilo') est += e.amount;
        else if (e.category === 'investimento') inv += e.amount;
      }
      const totalExp = es + est + inv;
      map.set(mKey, {
        key: mKey,
        label: formatMonthKeyLabel(mKey),
        slashLabel: formatMonthKeySlashLabel(mKey),
        shortLabel: formatShortMonthSlash(mKey),
        totalIncome: income,
        totalExpenses: totalExp,
        essencial: es,
        estilo: est,
        investimento: inv,
        balance: income - totalExp,
        savingsRate: income > 0 ? (inv / income) * 100 : 0,
        expenses: exps,
      });
    }

    // 2. monthsData (sobrescreve se for mais recente ou se ainda não estiver no mapa)
    for (const [mKey, rec] of Object.entries(monthsData)) {
      if (!rec || !rec.expenses) continue;
      const income = (rec.profile?.monthlyIncome || 0) + (rec.profile?.additionalIncome || 0);
      let es = 0;
      let est = 0;
      let inv = 0;
      const exps = rec.expenses || [];
      for (const e of exps) {
        if (e.category === 'essencial') es += e.amount;
        else if (e.category === 'estilo') est += e.amount;
        else if (e.category === 'investimento') inv += e.amount;
      }
      const totalExp = es + est + inv;
      map.set(mKey, {
        key: mKey,
        label: formatMonthKeyLabel(mKey),
        slashLabel: formatMonthKeySlashLabel(mKey),
        shortLabel: formatShortMonthSlash(mKey),
        totalIncome: income,
        totalExpenses: totalExp,
        essencial: es,
        estilo: est,
        investimento: inv,
        balance: income - totalExp,
        savingsRate: income > 0 ? (inv / income) * 100 : 0,
        expenses: exps,
      });
    }

    // Ordenar cronologicamente pelo monthKey (ex: "2026-08", "2026-09", "2026-10", "2026-11")
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [monthsData, history, selectedMonthKey]);

  // Se o mês ativo na tela ainda não tiver sido incluído, inclui com os dados atuais
  const activeMetricsList = useMemo<MonthMetric[]>(() => {
    if (allMonthsMetrics.length === 0) {
      const income = profile.monthlyIncome + profile.additionalIncome;
      let es = 0;
      let est = 0;
      let inv = 0;
      for (const e of currentMonthExpenses) {
        if (e.category === 'essencial') es += e.amount;
        else if (e.category === 'estilo') est += e.amount;
        else if (e.category === 'investimento') inv += e.amount;
      }
      return [
        {
          key: selectedMonthKey,
          label: formatMonthKeyLabel(selectedMonthKey),
          slashLabel: formatMonthKeySlashLabel(selectedMonthKey),
          shortLabel: formatShortMonthSlash(selectedMonthKey),
          totalIncome: income,
          totalExpenses: es + est + inv,
          essencial: es,
          estilo: est,
          investimento: inv,
          balance: income - (es + est + inv),
          savingsRate: income > 0 ? (inv / income) * 100 : 0,
          expenses: currentMonthExpenses,
        },
      ];
    }
    return allMonthsMetrics;
  }, [allMonthsMetrics, selectedMonthKey, profile, currentMonthExpenses]);

  // Médias Gerais
  const averages = useMemo(() => {
    const count = activeMetricsList.length || 1;
    let sumTotal = 0;
    let sumEssencial = 0;
    let sumEstilo = 0;
    let sumInvest = 0;
    let sumIncome = 0;

    for (const m of activeMetricsList) {
      sumTotal += m.totalExpenses;
      sumEssencial += m.essencial;
      sumEstilo += m.estilo;
      sumInvest += m.investimento;
      sumIncome += m.totalIncome;
    }

    const avgTotal = sumTotal / count;
    const avgEssencial = sumEssencial / count;
    const avgEstilo = sumEstilo / count;
    const avgInvest = sumInvest / count;
    const avgIncome = sumIncome / count;
    const avgSavingsRate = avgIncome > 0 ? (avgInvest / avgIncome) * 100 : 0;

    // Maior e menor mês de despesa
    let maxMonth = activeMetricsList[0];
    let minMonth = activeMetricsList[0];
    for (const m of activeMetricsList) {
      if (m.totalExpenses > maxMonth.totalExpenses) maxMonth = m;
      if (m.totalExpenses < minMonth.totalExpenses && m.totalExpenses > 0) minMonth = m;
    }

    return {
      count,
      avgTotal,
      avgEssencial,
      avgEstilo,
      avgInvest,
      avgIncome,
      avgSavingsRate,
      maxMonth,
      minMonth,
    };
  }, [activeMetricsList]);

  // Dados do mês selecionado para detalhamento
  const currentChartMonth = useMemo(() => {
    return (
      activeMetricsList.find((m) => m.key === selectedChartMonthKey) ||
      activeMetricsList.find((m) => m.key === selectedMonthKey) ||
      activeMetricsList[activeMetricsList.length - 1]
    );
  }, [activeMetricsList, selectedChartMonthKey, selectedMonthKey]);

  // Ranking de gastos do mês selecionado
  const rankedItems = useMemo(() => {
    const list = [...(currentChartMonth?.expenses || [])];
    const filtered =
      categoryFilter === 'all'
        ? list
        : list.filter((e) => e.category === categoryFilter);

    // Agrupar itens com mesmo nome se houver repetidos ou ordenar decrescente
    const grouped = new Map<string, { id: string; name: string; amount: number; category: ExpenseCategory }>();
    for (const e of filtered) {
      const existing = grouped.get(e.name.toLowerCase().trim());
      if (existing) {
        existing.amount += e.amount;
      } else {
        grouped.set(e.name.toLowerCase().trim(), {
          id: e.id,
          name: e.name,
          amount: e.amount,
          category: e.category,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }, [currentChartMonth, categoryFilter]);

  // Escalas para o gráfico de barras
  const maxBarValue = useMemo(() => {
    const maxVal = Math.max(...activeMetricsList.map((m) => m.totalExpenses), averages.avgTotal);
    return Math.max(maxVal * 1.15, 1000);
  }, [activeMetricsList, averages.avgTotal]);

  const activeCategoryTotal =
    (currentChartMonth?.essencial || 0) +
    (currentChartMonth?.estilo || 0) +
    (currentChartMonth?.investimento || 0) || 1;

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Painel */}
      <div className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 pb-4 border-b border-oat-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-maldives-600 text-2xl">
                analytics
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-espresso-900 leading-snug">
                Gráficos & Análise de Gastos
              </h2>
              <p className="text-xs sm:text-sm text-espresso-600 hidden sm:block">
                Visualização comparativa dos seus gastos mensais, médias por categoria e ranking de despesas.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto min-w-0 shrink-0">
            <span className="text-[11px] sm:text-xs font-bold text-espresso-600 whitespace-nowrap shrink-0">
              Mês em Análise:
            </span>
            <select
              value={selectedChartMonthKey}
              onChange={(e) => {
                setSelectedChartMonthKey(e.target.value);
                onSelectMonth(e.target.value);
              }}
              className="compact-select min-w-0 flex-1 sm:flex-initial max-w-[215px] sm:max-w-[240px] truncate bg-surface-input border border-oat-300 dark:border-white/[0.08] text-espresso-900 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-maldives-500 cursor-pointer"
            >
              {activeMetricsList.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.shortLabel} ({formatCurrency(m.totalExpenses)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards de Médias Financeiras */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5">
          <div className="bg-oat-100/80 dark:bg-oat-200/55 p-3.5 sm:p-4 rounded-2xl border border-oat-200 dark:border-white/[0.06]">
            <div className="flex items-center justify-between text-espresso-500 text-xs font-semibold mb-1">
              <span>Gasto Médio Mensal</span>
              <span className="material-symbols-outlined text-base text-espresso-400">
                query_stats
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono text-espresso-900">
              {formatCurrency(averages.avgTotal)}
            </p>
            <p className="text-[11px] text-espresso-500 mt-1">
              Baseado em {averages.count} {averages.count === 1 ? 'mês cadastrado' : 'meses cadastrados'}
            </p>
          </div>

          <div className="bg-sage-50/70 p-3.5 sm:p-4 rounded-2xl border border-sage-200 dark:border-sage-300/25">
            <div className="flex items-center justify-between text-sage-600 text-xs font-semibold mb-1">
              <span>Média em Essenciais</span>
              <span className="material-symbols-outlined text-base">
                home
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono text-sage-600">
              {formatCurrency(averages.avgEssencial)}
            </p>
            <p className="text-[11px] text-espresso-500 mt-1">
              {formatPercent(averages.avgTotal > 0 ? (averages.avgEssencial / averages.avgTotal) * 100 : 0)} do gasto médio
            </p>
          </div>

          <div className="bg-terracotta-50/70 p-3.5 sm:p-4 rounded-2xl border border-terracotta-200 dark:border-terracotta-300/25">
            <div className="flex items-center justify-between text-terracotta-600 text-xs font-semibold mb-1">
              <span>Média em Estilo de Vida</span>
              <span className="material-symbols-outlined text-base">
                local_cafe
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono text-terracotta-600">
              {formatCurrency(averages.avgEstilo)}
            </p>
            <p className="text-[11px] text-espresso-500 mt-1">
              {formatPercent(averages.avgTotal > 0 ? (averages.avgEstilo / averages.avgTotal) * 100 : 0)} do gasto médio
            </p>
          </div>

          <div className="bg-maldives-50/70 p-3.5 sm:p-4 rounded-2xl border border-maldives-200 dark:border-maldives-300/25">
            <div className="flex items-center justify-between text-maldives-600 text-xs font-semibold mb-1">
              <span>Aporte Médio (Futuro)</span>
              <span className="material-symbols-outlined text-base">
                trending_up
              </span>
            </div>
            <p className="text-lg sm:text-2xl font-bold font-mono text-maldives-600">
              {formatCurrency(averages.avgInvest)}
            </p>
            <p className="text-[11px] text-espresso-500 mt-1">
              Taxa média de poupança: {formatPercent(averages.avgSavingsRate)}
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico 1: Evolução Histórica dos Gastos Mensais */}
      <div className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-display font-bold text-espresso-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-maldives-600">
                bar_chart
              </span>
              Evolução dos Gastos Mês a Mês
            </h3>
            <p className="text-xs text-espresso-600">
              Barras empilhadas com Essenciais, Estilo de Vida e Investimentos. A linha tracejada indica a média histórica.
            </p>
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sage-600 inline-block" />
              <span className="text-espresso-700 font-medium">Essencial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-terracotta-600 inline-block" />
              <span className="text-espresso-700 font-medium">Estilo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-maldives-600 inline-block" />
              <span className="text-espresso-700 font-medium">Investimentos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-espresso-400 inline-block" />
              <span className="text-espresso-500 font-medium">Média</span>
            </div>
          </div>
        </div>

        {activeMetricsList.length > 3 && (
          <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold text-espresso-500 mb-2 sm:hidden">
            <span className="material-symbols-outlined text-[15px] text-maldives-600">
              swipe
            </span>
            <span>Deslize lateralmente nos meses</span>
          </div>
        )}

        {/* Faixa Resumo Fixa do Mês Selecionado (evita tooltips cortados no mobile) */}
        {currentChartMonth && (
          <div className="mb-3 p-2.5 sm:px-3.5 sm:py-2.5 rounded-2xl bg-oat-100/80 dark:bg-oat-200/50 border border-oat-200 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="font-bold text-espresso-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-maldives-500 inline-block shrink-0" />
                {currentChartMonth.label}
              </span>
              <span className="font-mono font-bold text-espresso-900 sm:hidden">
                {formatCurrency(currentChartMonth.totalExpenses)}
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono">
              <span className="text-sage-600 font-semibold">
                Ess: {formatCurrency(currentChartMonth.essencial)}
              </span>
              <span className="text-terracotta-600 font-semibold">
                Est: {formatCurrency(currentChartMonth.estilo)}
              </span>
              <span className="text-maldives-600 font-semibold">
                Inv: {formatCurrency(currentChartMonth.investimento)}
              </span>
              <span className="hidden sm:inline font-bold text-espresso-900 pl-2 border-l border-oat-300 dark:border-white/[0.12]">
                Total: {formatCurrency(currentChartMonth.totalExpenses)}
              </span>
            </div>
          </div>
        )}

        {/* Visualização de Barras com Navegação Horizontal Fluida */}
        <div className="overflow-x-auto pb-2 -mx-2 px-2 overscroll-x-contain">
          <div className="min-w-full w-max pt-8 sm:pt-28 pb-1">
            {/* Área de Plotagem dos Prédios + Linha da Média */}
            <div className="relative h-56 sm:h-64 flex items-end justify-around gap-3 sm:gap-4 px-2 border-b border-oat-300 dark:border-white/[0.08]">
              {/* Linha da Média */}
              {averages.avgTotal > 0 && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-dashed border-espresso-400/75 pointer-events-none z-10"
                  style={{
                    bottom: `${Math.min(95, Math.max(8, (averages.avgTotal / maxBarValue) * 100))}%`,
                  }}
                >
                  <span className="sticky left-2 inline-block -translate-y-6 text-[10px] font-mono font-bold bg-oat-200 text-espresso-700 px-2 py-0.5 rounded-full border border-oat-300 dark:border-white/[0.08] shadow-xs whitespace-nowrap">
                    Média: {formatCurrency(averages.avgTotal)}
                  </span>
                </div>
              )}

              {activeMetricsList.map((m, idx) => {
                const isSelected = m.key === selectedChartMonthKey;
                const isHovered = m.key === hoveredMonthKey;
                const totalHeightPct = Math.min(100, (m.totalExpenses / maxBarValue) * 100);

                const esPct = m.totalExpenses > 0 ? (m.essencial / m.totalExpenses) * 100 : 0;
                const estPct = m.totalExpenses > 0 ? (m.estilo / m.totalExpenses) * 100 : 0;
                const invPct = m.totalExpenses > 0 ? (m.investimento / m.totalExpenses) * 100 : 0;

                const tooltipAlignClass =
                  activeMetricsList.length <= 1
                    ? 'left-1/2 -translate-x-1/2'
                    : idx === 0
                    ? 'left-0'
                    : idx === activeMetricsList.length - 1
                    ? 'right-0'
                    : 'left-1/2 -translate-x-1/2';

                return (
                  <div
                    key={m.key}
                    onMouseEnter={() => setHoveredMonthKey(m.key)}
                    onMouseLeave={() => setHoveredMonthKey(null)}
                    onClick={() => {
                      setSelectedChartMonthKey(m.key);
                      onSelectMonth(m.key);
                    }}
                    className="w-[84px] sm:w-[92px] flex-1 max-w-[116px] shrink-0 h-full flex flex-col justify-end items-center cursor-pointer group relative z-20"
                  >
                    {/* Tooltip flutuante apenas no hover desktop */}
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`hidden sm:block absolute -top-24 ${tooltipAlignClass} z-30 bg-surface-ink/95 backdrop-blur-md text-white text-[11px] p-2.5 rounded-xl shadow-cozy-lg border border-white/10 font-mono pointer-events-none whitespace-nowrap`}
                      >
                        <p className="font-sans font-bold text-white border-b border-white/15 pb-1 mb-1">
                          {m.label}
                        </p>
                        <div className="space-y-0.5">
                          <p className="text-[#A7D7B8]">Essencial: {formatCurrency(m.essencial)}</p>
                          <p className="text-[#F4B6A4]">Estilo: {formatCurrency(m.estilo)}</p>
                          <p className="text-[#5EEAD4]">Investimentos: {formatCurrency(m.investimento)}</p>
                          <p className="text-white font-bold pt-0.5 border-t border-white/15">
                            Total: {formatCurrency(m.totalExpenses)}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Barra Empilhada */}
                    <div
                      style={{ height: `${Math.max(totalHeightPct, 6)}%` }}
                      className={`w-12 sm:w-14 rounded-t-2xl overflow-hidden flex flex-col-reverse transition-all duration-300 shadow-sm ${
                        isSelected
                          ? 'ring-4 ring-maldives-500/40 shadow-md scale-[1.03]'
                          : 'group-hover:opacity-95 group-hover:scale-[1.01]'
                      }`}
                    >
                      {/* Investimento (base da barra) */}
                      <div
                        style={{ height: `${invPct}%` }}
                        className="w-full bg-maldives-500 transition-all"
                        title={`Investimento: ${formatCurrency(m.investimento)}`}
                      />
                      {/* Estilo de Vida (meio da barra) */}
                      <div
                        style={{ height: `${estPct}%` }}
                        className="w-full bg-terracotta-500 transition-all"
                        title={`Estilo: ${formatCurrency(m.estilo)}`}
                      />
                      {/* Essencial (topo da barra) */}
                      <div
                        style={{ height: `${esPct}%` }}
                        className="w-full bg-sage-600 transition-all"
                        title={`Essencial: ${formatCurrency(m.essencial)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rótulos Inferiores dos Meses (alinhados sob a linha de base sem colapsar) */}
            <div className="flex items-start justify-around gap-3 sm:gap-4 px-2 pt-2.5">
              {activeMetricsList.map((m) => {
                const isSelected = m.key === selectedChartMonthKey;
                return (
                  <button
                    key={`label-${m.key}`}
                    type="button"
                    onClick={() => {
                      setSelectedChartMonthKey(m.key);
                      onSelectMonth(m.key);
                    }}
                    className="w-[84px] sm:w-[92px] flex-1 max-w-[116px] shrink-0 text-center cursor-pointer group focus:outline-none"
                  >
                    <span
                      className={`text-[11px] sm:text-xs font-bold block whitespace-nowrap transition ${
                        isSelected
                          ? 'text-maldives-700 underline underline-offset-4 decoration-2 font-extrabold'
                          : 'text-espresso-700 group-hover:text-espresso-900'
                      }`}
                    >
                      {m.shortLabel}
                    </span>
                    <span className="text-[10px] font-mono text-espresso-500 block whitespace-nowrap mt-0.5">
                      {formatCurrency(m.totalExpenses)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Composição por Categoria + Ranking de Itens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Comparativo das Categorias (Mês Selecionado vs Meta 50/30/20) */}
        <div className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-oat-200 dark:border-white/[0.06] mb-4">
              <h3 className="text-base font-display font-bold text-espresso-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-terracotta-600">
                  pie_chart
                </span>
                Distribuição no Mês ({currentChartMonth?.slashLabel})
              </h3>
              <span className="text-xs font-mono font-bold text-espresso-600">
                Total: {formatCurrency(currentChartMonth?.totalExpenses || 0)}
              </span>
            </div>

            <div className="space-y-4">
              {/* Essencial */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-sage-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sage-600 inline-block" />
                    Custos Essenciais
                  </span>
                  <div className="font-mono text-right">
                    <span className="font-bold text-espresso-900">
                      {formatCurrency(currentChartMonth?.essencial || 0)}
                    </span>
                    <span className="text-espresso-500 text-[11px] ml-1.5">
                      ({formatPercent(currentChartMonth?.totalExpenses ? (currentChartMonth.essencial / currentChartMonth.totalExpenses) * 100 : 0)})
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-oat-200 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${Math.min(100, currentChartMonth?.totalExpenses ? (currentChartMonth.essencial / currentChartMonth.totalExpenses) * 100 : 0)}%`,
                    }}
                    className="h-full bg-sage-600 rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-espresso-500 mt-0.5">
                  Meta Ideal: {customGoals.essencial}% da renda
                </p>
              </div>

              {/* Estilo de Vida */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-terracotta-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-terracotta-600 inline-block" />
                    Estilo de Vida & Conforto
                  </span>
                  <div className="font-mono text-right">
                    <span className="font-bold text-espresso-900">
                      {formatCurrency(currentChartMonth?.estilo || 0)}
                    </span>
                    <span className="text-espresso-500 text-[11px] ml-1.5">
                      ({formatPercent(currentChartMonth?.totalExpenses ? (currentChartMonth.estilo / currentChartMonth.totalExpenses) * 100 : 0)})
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-oat-200 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${Math.min(100, currentChartMonth?.totalExpenses ? (currentChartMonth.estilo / currentChartMonth.totalExpenses) * 100 : 0)}%`,
                    }}
                    className="h-full bg-terracotta-500 rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-espresso-500 mt-0.5">
                  Meta Ideal: {customGoals.estilo}% da renda
                </p>
              </div>

              {/* Investimentos */}
              <div>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-maldives-600 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-maldives-600 inline-block" />
                    Investimentos & Futuro
                  </span>
                  <div className="font-mono text-right">
                    <span className="font-bold text-espresso-900">
                      {formatCurrency(currentChartMonth?.investimento || 0)}
                    </span>
                    <span className="text-espresso-500 text-[11px] ml-1.5">
                      ({formatPercent(currentChartMonth?.totalExpenses ? (currentChartMonth.investimento / currentChartMonth.totalExpenses) * 100 : 0)})
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-oat-200 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${Math.min(100, currentChartMonth?.totalExpenses ? (currentChartMonth.investimento / currentChartMonth.totalExpenses) * 100 : 0)}%`,
                    }}
                    className="h-full bg-maldives-500 rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-espresso-500 mt-0.5">
                  Meta Ideal: {customGoals.investimento}% da renda
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-oat-100 dark:bg-oat-200/55 rounded-2xl border border-oat-200 dark:border-white/[0.06] text-xs text-espresso-700 flex items-center justify-between">
            <span>Renda Total Informada no Mês:</span>
            <span className="font-mono font-bold text-espresso-900">
              {formatCurrency(currentChartMonth?.totalIncome || 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Ranking de Gastos por Item Específico */}
        <div className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-oat-200 dark:border-white/[0.06] mb-4">
              <h3 className="text-base font-display font-bold text-espresso-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-sage-600">
                  format_list_numbered
                </span>
                Maiores Despesas do Mês
              </h3>

              {/* Filtro por categoria */}
              <div className="flex items-center gap-1 text-[11px] flex-wrap">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-surface-ink dark:bg-maldives-500 text-white'
                      : 'bg-oat-100 dark:bg-oat-200/60 text-espresso-600 hover:bg-oat-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setCategoryFilter('essencial')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    categoryFilter === 'essencial'
                      ? 'bg-sage-500 text-white'
                      : 'bg-oat-100 dark:bg-oat-200/60 text-espresso-600 hover:bg-oat-200'
                  }`}
                >
                  Essencial
                </button>
                <button
                  onClick={() => setCategoryFilter('estilo')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    categoryFilter === 'estilo'
                      ? 'bg-terracotta-500 text-white'
                      : 'bg-oat-100 dark:bg-oat-200/60 text-espresso-600 hover:bg-oat-200'
                  }`}
                >
                  Estilo
                </button>
                <button
                  onClick={() => setCategoryFilter('investimento')}
                  className={`px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                    categoryFilter === 'investimento'
                      ? 'bg-maldives-500 text-white'
                      : 'bg-oat-100 dark:bg-oat-200/60 text-espresso-600 hover:bg-oat-200'
                  }`}
                >
                  Aportes
                </button>
              </div>
            </div>

            {rankedItems.length === 0 ? (
              <div className="p-8 text-center text-espresso-400 text-xs">
                Nenhum item encontrado para o filtro selecionado neste mês.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {rankedItems.slice(0, 8).map((item, idx) => {
                  const itemPct =
                    currentChartMonth?.totalExpenses && currentChartMonth.totalExpenses > 0
                      ? (item.amount / currentChartMonth.totalExpenses) * 100
                      : 0;
                  const catColor =
                    item.category === 'essencial'
                      ? 'bg-sage-600'
                      : item.category === 'estilo'
                      ? 'bg-terracotta-500'
                      : 'bg-maldives-500';

                  return (
                    <div
                      key={item.id || idx}
                      className="p-2.5 bg-oat-100/70 dark:bg-oat-200/50 rounded-xl border border-oat-200 dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-5 h-5 rounded-full bg-oat-200 text-espresso-600 font-bold flex items-center justify-center text-[10px] shrink-0 font-mono">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-espresso-900 truncate">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`w-2 h-2 rounded-full ${catColor} inline-block`} />
                            <span className="text-[10px] text-espresso-500 capitalize">
                              {item.category === 'essencial'
                                ? 'Essencial'
                                : item.category === 'estilo'
                                ? 'Estilo de Vida'
                                : 'Investimento'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-mono">
                        <span className="font-bold text-espresso-900 block">
                          {formatCurrency(item.amount)}
                        </span>
                        <span className="text-[10px] text-espresso-500">
                          {formatPercent(itemPct)} do mês
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Variação Mensal em Relação à Média */}
      <div className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy">
        <h3 className="text-base font-display font-bold text-espresso-900 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-espresso-600">
            table_chart
          </span>
          Comparativo Mensal vs. Média Histórica
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-oat-200 dark:border-white/[0.07] text-espresso-500 font-semibold whitespace-nowrap">
                <th className="py-2.5 px-3">Competência</th>
                <th className="py-2.5 px-3 font-mono">Total Gasto</th>
                <th className="py-2.5 px-3 font-mono">Essenciais</th>
                <th className="py-2.5 px-3 font-mono">Estilo</th>
                <th className="py-2.5 px-3 font-mono">Investimento</th>
                <th className="py-2.5 px-3">Variação vs. Média</th>
                <th className="py-2.5 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-oat-200 dark:divide-white/[0.05]">
              {activeMetricsList.map((m) => {
                const diff = m.totalExpenses - averages.avgTotal;
                const diffPct = averages.avgTotal > 0 ? (diff / averages.avgTotal) * 100 : 0;
                const isSelected = m.key === selectedChartMonthKey;

                return (
                  <tr
                    key={m.key}
                    className={`hover:bg-oat-100/60 transition ${
                      isSelected ? 'bg-maldives-50/50 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-espresso-900">{m.slashLabel}</span>
                      <span className="text-[10px] text-espresso-500 block">
                        {m.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-espresso-900">
                      {formatCurrency(m.totalExpenses)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-sage-600">
                      {formatCurrency(m.essencial)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-terracotta-600">
                      {formatCurrency(m.estilo)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-maldives-600">
                      {formatCurrency(m.investimento)}
                    </td>
                    <td className="py-2.5 px-3">
                      {Math.abs(diffPct) < 1 ? (
                        <span className="text-espresso-500 font-mono text-[11px]">Na média</span>
                      ) : diff > 0 ? (
                        <span className="text-terracotta-600 font-mono font-bold text-[11px] bg-terracotta-50 px-2 py-0.5 rounded-full border border-terracotta-200">
                          +{formatPercent(diffPct)} acima
                        </span>
                      ) : (
                        <span className="text-maldives-700 font-mono font-bold text-[11px] bg-maldives-50 px-2 py-0.5 rounded-full border border-maldives-200">
                          {formatPercent(diffPct)} abaixo
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedChartMonthKey(m.key);
                          onSelectMonth(m.key);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-oat-100 hover:bg-maldives-100 text-espresso-700 hover:text-maldives-800 font-bold text-[11px] transition cursor-pointer"
                      >
                        Ver Mês
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

