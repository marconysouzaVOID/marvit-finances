import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_PURCHASE_TAGS } from '../constants';
import {
  CardPurchaseTag,
  CreditCardTransaction,
  ExpenseItem,
} from '../types';
import { formatCurrency, formatMonthKeyLabel } from '../utils/formatters';

interface DailyCalendarPurchase {
  id: string;
  sourceType: 'card' | 'direct';
  sourceId: string;
  sourceName: string;
  description: string;
  amount: number;
  tag: CardPurchaseTag;
  installment?: string;
  dateStr?: string;
  rawDay?: number;
}

interface LifestyleDailyCalendarProps {
  expenses: ExpenseItem[];
  selectedMonthKey: string;
  lifestyleIdealAmount: number;
  onUpdateExpense?: (id: string, updated: Partial<ExpenseItem>) => void;
  onOpenCardInvoices?: (cardId?: string) => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Normaliza e extrai o dia do mês (1 a 31) a partir de strings como:
 * - "2026-11-12" (ISO)
 * - "12/11" ou "12/11/2026" (padrão brasileiro)
 * - "12"
 */
function extractDayNumber(
  dateStr: string | undefined,
  targetYear: number,
  targetMonthIndex: number
): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();

  // Caso 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const parts = trimmed.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2].slice(0, 2), 10);
    if (year === targetYear && month === targetMonthIndex && day >= 1 && day <= 31) {
      return day;
    }
    return null;
  }

  // Caso 2: DD/MM ou DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}/.test(trimmed)) {
    const parts = trimmed.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    if (parts.length >= 3) {
      const year = parseInt(parts[2], 10);
      if (year !== targetYear) return null;
    }
    if (month === targetMonthIndex && day >= 1 && day <= 31) {
      return day;
    }
    return null;
  }

  // Caso 3: apenas o número do dia (1..31)
  const num = parseInt(trimmed, 10);
  if (!isNaN(num) && num >= 1 && num <= 31 && String(num) === trimmed) {
    return num;
  }

  return null;
}

export const LifestyleDailyCalendar: React.FC<LifestyleDailyCalendarProps> = ({
  expenses,
  selectedMonthKey,
  lifestyleIdealAmount,
  onUpdateExpense,
  onOpenCardInvoices,
}) => {
  // Extrai ano e mês da competência selecionada (ex: "2026-11")
  const [yearNum, monthNum] = useMemo(() => {
    const parts = (selectedMonthKey || '').split('-');
    if (parts.length === 2) {
      return [parseInt(parts[0], 10), parseInt(parts[1], 10) - 1];
    }
    const now = new Date();
    return [now.getFullYear(), now.getMonth()];
  }, [selectedMonthKey]);

  // Quantidade de dias no mês selecionado
  const daysInMonth = useMemo(() => {
    return new Date(yearNum, monthNum + 1, 0).getDate();
  }, [yearNum, monthNum]);

  // Dia da semana do 1º dia (0 = Dom, 1 = Seg, ..., 6 = Sáb)
  const firstDayOfWeek = useMemo(() => {
    return new Date(yearNum, monthNum, 1).getDay();
  }, [yearNum, monthNum]);

  // Verifica se o mês visualizado é o mês atual do relógio
  const todayDate = useMemo(() => new Date(), []);
  const isCurrentSystemMonth =
    todayDate.getFullYear() === yearNum && todayDate.getMonth() === monthNum;
  const systemTodayDay = isCurrentSystemMonth ? todayDate.getDate() : null;

  // Estado de filtros
  const [selectedTag, setSelectedTag] = useState<'all' | CardPurchaseTag>('all');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<'all' | string>('all');
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    if (isCurrentSystemMonth && todayDate.getDate() <= daysInMonth) {
      return todayDate.getDate();
    }
    return 1;
  });

  // Estado para formulário de adicionar novo gasto no dia selecionado
  const [isAddingInDay, setIsAddingInDay] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newTag, setNewTag] = useState<CardPurchaseTag>('gastronomia');
  const [newCardId, setNewCardId] = useState<string>('');
  const [newInstallment, setNewInstallment] = useState('À vista');

  // Filtra itens de despesa do pilar Estilo de Vida
  const lifestyleExpenses = useMemo(() => {
    return expenses.filter((e) => e.category === 'estilo');
  }, [expenses]);

  // Lista de cartões disponíveis para lançamentos
  const availableCards = useMemo(() => {
    return lifestyleExpenses.filter((e) => e.subcategory === 'cartao');
  }, [lifestyleExpenses]);

  // Mapeia todas as transações e compras do pilar Estilo de Vida
  const { dailyBuckets, undatedPurchases, totalMonthLifestyle } = useMemo(() => {
    const buckets: Record<number, DailyCalendarPurchase[]> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      buckets[d] = [];
    }
    const undated: DailyCalendarPurchase[] = [];
    let totalSpent = 0;

    lifestyleExpenses.forEach((item) => {
      if (item.subcategory === 'cartao' && item.cardTransactions) {
        item.cardTransactions.forEach((tx) => {
          totalSpent += tx.amount;
          const day = extractDayNumber(tx.purchaseDate, yearNum, monthNum);
          const purchaseObj: DailyCalendarPurchase = {
            id: tx.id,
            sourceType: 'card',
            sourceId: item.id,
            sourceName: item.name,
            description: tx.description,
            amount: tx.amount,
            tag: tx.tag,
            installment: tx.installment,
            dateStr: tx.purchaseDate,
            rawDay: day || undefined,
          };
          if (day && day >= 1 && day <= daysInMonth) {
            buckets[day].push(purchaseObj);
          } else {
            undated.push(purchaseObj);
          }
        });
      } else if (item.subcategory === 'direto' || !item.subcategory) {
        totalSpent += item.amount;
        const day = extractDayNumber(item.expenseDate, yearNum, monthNum);
        const purchaseObj: DailyCalendarPurchase = {
          id: item.id,
          sourceType: 'direct',
          sourceId: item.id,
          sourceName: 'Gasto Direto / Pix',
          description: item.name,
          amount: item.amount,
          tag: 'outros',
          dateStr: item.expenseDate,
          rawDay: day || undefined,
        };
        if (day && day >= 1 && day <= daysInMonth) {
          buckets[day].push(purchaseObj);
        } else {
          undated.push(purchaseObj);
        }
      }
    });

    return {
      dailyBuckets: buckets,
      undatedPurchases: undated,
      totalMonthLifestyle: Math.round(totalSpent * 100) / 100,
    };
  }, [lifestyleExpenses, daysInMonth, yearNum, monthNum]);

  // Calcula totais diários aplicando filtros de tag e de cartão
  const dailyMetrics = useMemo(() => {
    const totals: Record<number, number> = {};
    const filteredPurchasesMap: Record<number, DailyCalendarPurchase[]> = {};
    let peakDay = 1;
    let peakDayAmount = 0;
    let zeroSpendCount = 0;
    let filteredTotal = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const items = (dailyBuckets[d] || []).filter((p) => {
        const matchesTag = selectedTag === 'all' || p.tag === selectedTag;
        const matchesSource =
          selectedSourceFilter === 'all' || p.sourceId === selectedSourceFilter;
        return matchesTag && matchesSource;
      });

      filteredPurchasesMap[d] = items;
      const daySum = Math.round(items.reduce((acc, i) => acc + i.amount, 0) * 100) / 100;
      totals[d] = daySum;
      filteredTotal += daySum;

      if (daySum === 0) {
        zeroSpendCount += 1;
      }
      if (daySum > peakDayAmount) {
        peakDayAmount = daySum;
        peakDay = d;
      }
    }

    const dailyAverage =
      daysInMonth > 0 ? Math.round((filteredTotal / daysInMonth) * 100) / 100 : 0;

    return {
      totals,
      filteredPurchasesMap,
      peakDay,
      peakDayAmount,
      zeroSpendCount,
      filteredTotal: Math.round(filteredTotal * 100) / 100,
      dailyAverage,
    };
  }, [dailyBuckets, daysInMonth, selectedTag, selectedSourceFilter]);

  // Submissão de novo gasto no dia selecionado
  const handleAddNewPurchaseInSelectedDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount || Number(newAmount) <= 0 || !onUpdateExpense) return;

    const targetCard =
      availableCards.find((c) => c.id === newCardId) || availableCards[0];

    if (!targetCard) return;

    const formattedDayStr = `${String(selectedDay).padStart(2, '0')}/${String(
      monthNum + 1
    ).padStart(2, '0')}`;

    const newTx: CreditCardTransaction = {
      id: `tx-cal-${Date.now()}`,
      description: newDesc.trim(),
      amount: Math.round(Number(newAmount) * 100) / 100,
      tag: newTag,
      installment: newInstallment.trim() || 'À vista',
      purchaseDate: formattedDayStr,
    };

    const currentList = targetCard.cardTransactions || [];
    const nextList = [newTx, ...currentList];
    const nextTotal =
      Math.round(nextList.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

    onUpdateExpense(targetCard.id, {
      cardTransactions: nextList,
      amount: nextTotal,
    });

    setNewDesc('');
    setNewAmount('');
    setIsAddingInDay(false);
  };

  // Exclusão de uma compra selecionada
  const handleDeletePurchase = (item: DailyCalendarPurchase) => {
    if (!onUpdateExpense) return;
    if (item.sourceType === 'card') {
      const card = availableCards.find((c) => c.id === item.sourceId);
      if (!card || !card.cardTransactions) return;

      const nextList = card.cardTransactions.filter((t) => t.id !== item.id);
      const nextTotal =
        Math.round(nextList.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

      onUpdateExpense(card.id, {
        cardTransactions: nextList,
        amount: nextTotal,
      });
    }
  };

  // Clonar uma compra selecionada diretamente do calendário
  const handleClonePurchase = (purchase: DailyCalendarPurchase) => {
    if (!onUpdateExpense) return;
    if (purchase.sourceType === 'card') {
      const card = availableCards.find((c) => c.id === purchase.sourceId);
      if (!card || !card.cardTransactions) return;

      const clonedTx: CreditCardTransaction = {
        id: `tx-cal-clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        description: `${purchase.description} (Cópia)`,
        amount: purchase.amount,
        tag: purchase.tag,
        installment: purchase.installment || 'À vista',
        purchaseDate: purchase.dateStr,
      };

      const nextList = [clonedTx, ...card.cardTransactions];
      const nextTotal =
        Math.round(nextList.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

      onUpdateExpense(card.id, {
        cardTransactions: nextList,
        amount: nextTotal,
      });
    }
  };

  // Atribuir uma data a uma compra sem data
  const handleAssignDayToUndated = (
    purchase: DailyCalendarPurchase,
    dayToAssign: number
  ) => {
    if (!onUpdateExpense || dayToAssign < 1 || dayToAssign > daysInMonth) return;
    const formattedDayStr = `${String(dayToAssign).padStart(2, '0')}/${String(
      monthNum + 1
    ).padStart(2, '0')}`;

    if (purchase.sourceType === 'card') {
      const card = availableCards.find((c) => c.id === purchase.sourceId);
      if (!card || !card.cardTransactions) return;
      const nextList = card.cardTransactions.map((t) =>
        t.id === purchase.id ? { ...t, purchaseDate: formattedDayStr } : t
      );
      onUpdateExpense(card.id, {
        cardTransactions: nextList,
      });
    } else {
      onUpdateExpense(purchase.sourceId, {
        expenseDate: formattedDayStr,
      });
    }
  };

  const selectedDayPurchases = dailyMetrics.filteredPurchasesMap[selectedDay] || [];
  const selectedDayTotal = dailyMetrics.totals[selectedDay] || 0;

  // Cor térmica do dia no grid
  const getDayThermalStyle = (amount: number, isSelected: boolean) => {
    if (isSelected) {
      return 'ring-2 ring-terracotta-500 shadow-md scale-[1.02] z-10';
    }
    if (amount === 0) {
      return 'bg-oat-50/60 dark:bg-espresso-800/40 border-oat-200/80 dark:border-espresso-700/60 text-espresso-400 hover:border-oat-400';
    }
    if (amount < 80) {
      return 'bg-maldives-50/50 dark:bg-maldives-950/20 border-maldives-200/90 dark:border-maldives-800/60 text-espresso-900 hover:border-maldives-400';
    }
    if (amount < 250) {
      return 'bg-terracotta-50/70 dark:bg-terracotta-950/25 border-terracotta-300/80 dark:border-terracotta-800/70 text-espresso-900 hover:border-terracotta-400';
    }
    // Gasto alto / Dia de Pico
    return 'bg-terracotta-100/90 dark:bg-terracotta-900/40 border-terracotta-400 dark:border-terracotta-700 text-terracotta-950 dark:text-terracotta-100 font-semibold shadow-xs hover:border-terracotta-500';
  };

  return (
    <div className="space-y-6">
      {/* Topo do Calendário: Resumo e Métricas */}
      <div className="bg-oat-50/95 dark:bg-espresso-900/90 border border-oat-300 dark:border-espresso-700/80 rounded-3xl p-4 sm:p-6 shadow-cozy">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-oat-200 dark:border-espresso-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-terracotta-100 dark:bg-terracotta-900/50 border border-terracotta-300 dark:border-terracotta-700 flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-terracotta-600 dark:text-terracotta-400 text-2xl">
                calendar_month
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-display font-bold text-espresso-900 dark:text-oat-100">
                  Calendário Diário • Gastos de Estilo de Vida
                </h3>
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-terracotta-100 dark:bg-terracotta-900/60 text-terracotta-700 dark:text-terracotta-300 border border-terracotta-200 dark:border-terracotta-700">
                  {formatMonthKeyLabel(selectedMonthKey)}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-espresso-600 dark:text-espresso-400 mt-1">
                Visualize exatamente quanto saiu em cada dia com faturas de cartão, restaurantes e mimos.
              </p>
            </div>
          </div>

          {onOpenCardInvoices && (
            <button
              type="button"
              onClick={() => onOpenCardInvoices()}
              className="px-3.5 py-2 rounded-xl bg-oat-100 dark:bg-espresso-800 hover:bg-oat-200 text-espresso-700 dark:text-espresso-300 border border-oat-300 dark:border-espresso-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start lg:self-auto"
            >
              <span className="material-symbols-outlined text-[17px]">credit_card</span>
              <span>Ver Faturas dos Cartões</span>
            </button>
          )}
        </div>

        {/* 4 Cards de Métricas Principais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5">
          {/* Total Gasto no Mês */}
          <div className="bg-oat-100/70 dark:bg-espresso-800/50 border border-oat-200 dark:border-espresso-700/60 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-espresso-500 uppercase tracking-wider block">
              Gasto no Mês
            </span>
            <div className="text-base sm:text-xl font-mono font-bold text-terracotta-600 dark:text-terracotta-400 mt-1">
              {formatCurrency(dailyMetrics.filteredTotal)}
            </div>
            <span className="text-[10px] text-espresso-500 block mt-0.5">
              Teto ideal: {formatCurrency(lifestyleIdealAmount)}
            </span>
          </div>

          {/* Média por Dia */}
          <div className="bg-oat-100/70 dark:bg-espresso-800/50 border border-oat-200 dark:border-espresso-700/60 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-espresso-500 uppercase tracking-wider block">
              Média Diária
            </span>
            <div className="text-base sm:text-xl font-mono font-bold text-espresso-900 dark:text-oat-100 mt-1">
              {formatCurrency(dailyMetrics.dailyAverage)}
            </div>
            <span className="text-[10px] text-espresso-500 block mt-0.5">
              Por dia ({daysInMonth} dias no mês)
            </span>
          </div>

          {/* Dia de Pico */}
          <div className="bg-oat-100/70 dark:bg-espresso-800/50 border border-oat-200 dark:border-espresso-700/60 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-espresso-500 uppercase tracking-wider block flex items-center gap-1">
              <span>Dia de Pico</span>
              <span className="material-symbols-outlined text-[13px] text-terracotta-500">
                local_fire_department
              </span>
            </span>
            <div className="text-base sm:text-xl font-mono font-bold text-terracotta-700 dark:text-terracotta-300 mt-1">
              {dailyMetrics.peakDayAmount > 0
                ? `Dia ${dailyMetrics.peakDay}`
                : 'Nenhum'}
            </div>
            <span className="text-[10px] text-espresso-500 block mt-0.5 truncate">
              {dailyMetrics.peakDayAmount > 0
                ? `${formatCurrency(dailyMetrics.peakDayAmount)} neste dia`
                : 'Sem gastos registrados'}
            </span>
          </div>

          {/* Dias Sem Gastos (Zero Spend) */}
          <div className="bg-oat-100/70 dark:bg-espresso-800/50 border border-oat-200 dark:border-espresso-700/60 rounded-2xl p-3.5">
            <span className="text-[11px] font-bold text-espresso-500 uppercase tracking-wider block flex items-center gap-1">
              <span>Dias Sem Gastos</span>
              <span className="text-sage-600 text-[12px]">🍃</span>
            </span>
            <div className="text-base sm:text-xl font-mono font-bold text-sage-600 dark:text-sage-400 mt-1">
              {dailyMetrics.zeroSpendCount} dias
            </div>
            <span className="text-[10px] text-espresso-500 block mt-0.5">
              De {daysInMonth} dias livres de supérfluos
            </span>
          </div>
        </div>

        {/* Barra de Filtros por Categoria & Cartão */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-oat-200 dark:border-espresso-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-espresso-600 dark:text-espresso-400 mr-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">filter_list</span>
              Filtrar:
            </span>

            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                selectedTag === 'all'
                  ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                  : 'bg-oat-100 dark:bg-espresso-800 text-espresso-700 dark:text-espresso-300 border-oat-300 dark:border-espresso-700 hover:bg-oat-200'
              }`}
            >
              Todas Categorias
            </button>

            {(Object.keys(CARD_PURCHASE_TAGS) as CardPurchaseTag[]).map((tagKey) => {
              const meta = CARD_PURCHASE_TAGS[tagKey];
              const isSelected = selectedTag === tagKey;
              return (
                <button
                  key={tagKey}
                  type="button"
                  onClick={() => setSelectedTag(tagKey)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                      : 'bg-oat-100 dark:bg-espresso-800 text-espresso-700 dark:text-espresso-300 border-oat-300 dark:border-espresso-700 hover:bg-oat-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[13px]">
                    {meta.icon}
                  </span>
                  <span>{meta.label.split('&')[0].trim()}</span>
                </button>
              );
            })}
          </div>

          {availableCards.length > 1 && (
            <select
              value={selectedSourceFilter}
              onChange={(e) => setSelectedSourceFilter(e.target.value)}
              className="bg-oat-100 dark:bg-espresso-800 border border-oat-300 dark:border-espresso-700 rounded-xl px-3 py-1.5 text-xs font-bold text-espresso-800 dark:text-oat-100 focus:outline-none focus:border-terracotta-500 cursor-pointer"
            >
              <option value="all">Todos os Cartões & Pix</option>
              {availableCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Grade do Calendário Mensal */}
      <div className="bg-oat-50/95 dark:bg-espresso-900/90 border border-oat-300 dark:border-espresso-700/80 rounded-3xl p-3.5 sm:p-6 shadow-cozy">
        {/* Cabeçalho dos Dias da Semana (Dom a Sáb) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {WEEKDAYS.map((wd, idx) => (
            <div
              key={wd}
              className={`text-center py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider ${
                idx === 0 || idx === 6
                  ? 'text-terracotta-600 dark:text-terracotta-400 font-extrabold'
                  : 'text-espresso-500 dark:text-espresso-400'
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Células dos Dias */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Espaçadores vazios para compensar o dia da semana do dia 1 */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="h-20 sm:h-28 rounded-2xl bg-oat-100/20 dark:bg-espresso-950/20 border border-dashed border-oat-200/40 dark:border-espresso-800/30"
            />
          ))}

          {/* Dias 1 a daysInMonth */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isToday = isCurrentSystemMonth && dayNum === systemTodayDay;
            const isSelected = dayNum === selectedDay;
            const dayPurchases = dailyMetrics.filteredPurchasesMap[dayNum] || [];
            const dayTotal = dailyMetrics.totals[dayNum] || 0;
            const hasPurchases = dayPurchases.length > 0;
            const isPeak = dayNum === dailyMetrics.peakDay && dayTotal > 0;

            // Extrai ícones únicos de categorias deste dia
            const uniqueTagIcons = Array.from(
              new Set(dayPurchases.map((p) => CARD_PURCHASE_TAGS[p.tag]?.icon || 'receipt'))
            ).slice(0, 3);

            return (
              <motion.button
                key={`day-${dayNum}`}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setSelectedDay(dayNum);
                  setIsAddingInDay(false);
                }}
                className={`relative h-20 sm:h-28 p-1.5 sm:p-2.5 rounded-2xl border flex flex-col justify-between text-left transition-all cursor-pointer ${getDayThermalStyle(
                  dayTotal,
                  isSelected
                )}`}
              >
                {/* Linha superior: número do dia + badge hoje/pico */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono rounded-lg px-1.5 py-0.2 ${
                      isSelected
                        ? 'bg-terracotta-500 text-white'
                        : isToday
                        ? 'bg-maldives-500 text-white'
                        : 'text-espresso-700 dark:text-oat-200'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {isToday && !isSelected && (
                    <span className="text-[9px] font-bold uppercase text-maldives-600 dark:text-maldives-400 hidden sm:inline">
                      Hoje
                    </span>
                  )}

                  {isPeak && dayTotal > 0 && (
                    <span
                      title="Dia de maior gasto no mês"
                      className="material-symbols-outlined text-terracotta-600 dark:text-terracotta-400 text-[14px] sm:text-[16px]"
                    >
                      local_fire_department
                    </span>
                  )}
                </div>

                {/* Centro: ícones de tags */}
                {hasPurchases ? (
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap my-0.5">
                    {uniqueTagIcons.map((icon, iconIdx) => (
                      <span
                        key={iconIdx}
                        className="material-symbols-outlined text-[11px] sm:text-[13px] text-espresso-600 dark:text-espresso-300 opacity-80"
                      >
                        {icon}
                      </span>
                    ))}
                    {dayPurchases.length > 3 && (
                      <span className="text-[9px] font-mono font-bold text-espresso-500">
                        +{dayPurchases.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] text-espresso-400 dark:text-espresso-500 opacity-60">
                    <span>🍃</span>
                  </div>
                )}

                {/* Base: Valor gasto no dia */}
                <div className="w-full truncate">
                  {dayTotal > 0 ? (
                    <div className="text-[11px] sm:text-xs font-mono font-bold text-terracotta-700 dark:text-terracotta-300 truncate">
                      {formatCurrency(dayTotal)}
                    </div>
                  ) : (
                    <div className="text-[10px] sm:text-[11px] font-mono text-sage-600/80 dark:text-sage-400/80 truncate">
                      R$ 0,00
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Painel de Detalhamento do Dia Selecionado */}
      <div className="bg-oat-50/95 dark:bg-espresso-900/90 border border-oat-300 dark:border-espresso-700/80 rounded-3xl p-4 sm:p-6 shadow-cozy">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200 dark:border-espresso-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-terracotta-500 text-white font-mono font-bold text-base flex items-center justify-center shadow-xs">
              {selectedDay}
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-display font-bold text-espresso-900 dark:text-oat-100">
                Gastos no Dia {selectedDay} de {formatMonthKeyLabel(selectedMonthKey)}
              </h4>
              <p className="text-xs text-espresso-600 dark:text-espresso-400">
                {selectedDayPurchases.length}{' '}
                {selectedDayPurchases.length === 1 ? 'lançamento' : 'lançamentos'}{' '}
                • Total:{' '}
                <strong className="font-mono text-terracotta-600 dark:text-terracotta-400">
                  {formatCurrency(selectedDayTotal)}
                </strong>
              </p>
            </div>
          </div>

          {availableCards.length > 0 && onUpdateExpense && (
            <button
              type="button"
              onClick={() => setIsAddingInDay(!isAddingInDay)}
              className="px-3.5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
            >
              <span className="material-symbols-outlined text-[17px]">
                {isAddingInDay ? 'close' : 'add'}
              </span>
              <span>{isAddingInDay ? 'Cancelar' : 'Lançar Gasto Neste Dia'}</span>
            </button>
          )}
        </div>

        {/* Formulário Inline para Lançar Gasto neste dia */}
        <AnimatePresence>
          {isAddingInDay && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleAddNewPurchaseInSelectedDay}
              className="mt-4 p-4 rounded-2xl bg-oat-100/90 dark:bg-espresso-800/80 border border-oat-300 dark:border-espresso-700 space-y-3 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-espresso-800 dark:text-oat-100 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-terracotta-500">
                    add_circle
                  </span>
                  Novo Gasto de Estilo de Vida no Dia {selectedDay}
                </span>
                <span className="text-[11px] font-mono text-espresso-500">
                  Data: {String(selectedDay).padStart(2, '0')}/
                  {String(monthNum + 1).padStart(2, '0')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Cartão de Destino */}
                <div className="sm:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-espresso-500 block mb-1">
                    Cartão
                  </label>
                  <select
                    value={newCardId || availableCards[0]?.id || ''}
                    onChange={(e) => setNewCardId(e.target.value)}
                    className="w-full bg-white dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-espresso-900 dark:text-oat-100 focus:outline-none focus:border-terracotta-500"
                  >
                    {availableCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Descrição */}
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-bold uppercase text-espresso-500 block mb-1">
                    Descrição do Gasto
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Jantar Italiano, Uber, Cinema..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full bg-white dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 rounded-xl px-3 py-2 text-xs font-semibold text-espresso-900 dark:text-oat-100 focus:outline-none focus:border-terracotta-500"
                  />
                </div>

                {/* Valor R$ */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-espresso-500 block mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0,00"
                    value={newAmount}
                    onChange={(e) =>
                      setNewAmount(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full bg-white dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 rounded-xl px-3 py-2 text-xs font-bold font-mono text-espresso-900 dark:text-oat-100 focus:outline-none focus:border-terracotta-500"
                  />
                </div>

                {/* Categoria / Tag */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-espresso-500 block mb-1">
                    Tag
                  </label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value as CardPurchaseTag)}
                    className="w-full bg-white dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 rounded-xl px-2 py-2 text-xs font-semibold text-espresso-900 dark:text-oat-100 focus:outline-none focus:border-terracotta-500"
                  >
                    {(Object.keys(CARD_PURCHASE_TAGS) as CardPurchaseTag[]).map((k) => (
                      <option key={k} value={k}>
                        {CARD_PURCHASE_TAGS[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Botão Salvar */}
                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center shadow-xs"
                    title="Confirmar lançamento"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Lista de Compras do Dia Selecionado */}
        <div className="mt-4 space-y-2">
          {selectedDayPurchases.length === 0 ? (
            <div className="p-6 rounded-2xl bg-oat-100/50 dark:bg-espresso-800/30 border border-dashed border-oat-300 dark:border-espresso-700 text-center space-y-1.5">
              <span className="text-2xl">🍃</span>
              <p className="text-sm font-bold text-espresso-800 dark:text-oat-100">
                Dia livre de gastos de estilo de vida!
              </p>
              <p className="text-xs text-espresso-500 max-w-md mx-auto">
                Nenhum gasto supérfluo registrado no dia {selectedDay}. Excelente disciplina financeira!
              </p>
            </div>
          ) : (
            selectedDayPurchases.map((purchase) => {
              const tagMeta =
                CARD_PURCHASE_TAGS[purchase.tag] || CARD_PURCHASE_TAGS.outros;

              return (
                <div
                  key={purchase.id}
                  className="p-3 rounded-2xl bg-white dark:bg-espresso-800/70 border border-oat-200 dark:border-espresso-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-oat-300 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tagMeta.badgeClass}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {tagMeta.icon}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-bold text-espresso-900 dark:text-oat-100 truncate">
                        {purchase.description}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-espresso-500 mt-0.5">
                        <span className="font-semibold text-espresso-700 dark:text-espresso-300">
                          {purchase.sourceName}
                        </span>
                        <span>•</span>
                        <span className="font-mono">{tagMeta.label}</span>
                        {purchase.installment && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{purchase.installment}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-sm sm:text-base font-mono font-bold text-terracotta-600 dark:text-terracotta-400">
                      {formatCurrency(purchase.amount)}
                    </span>

                    {onUpdateExpense && purchase.sourceType === 'card' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleClonePurchase(purchase)}
                          className="text-espresso-400 hover:text-maldives-600 p-1.5 rounded-lg hover:bg-maldives-50 dark:hover:bg-maldives-950/40 transition cursor-pointer"
                          title="Clonar esta compra (duplicar no dia)"
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            content_copy
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeletePurchase(purchase)}
                          className="text-espresso-400 hover:text-terracotta-600 p-1.5 rounded-lg hover:bg-terracotta-50 dark:hover:bg-terracotta-950/40 transition cursor-pointer"
                          title="Remover esta compra"
                        >
                          <span className="material-symbols-outlined text-[17px]">
                            delete
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Seção Suave: Compras Sem Data Definida (caso haja) */}
      {undatedPurchases.length > 0 && (
        <div className="bg-oat-100/70 dark:bg-espresso-800/50 border border-oat-300 dark:border-espresso-700 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-terracotta-500 text-lg">
                schedule
              </span>
              <div>
                <span className="text-xs sm:text-sm font-bold text-espresso-800 dark:text-oat-100">
                  {undatedPurchases.length}{' '}
                  {undatedPurchases.length === 1 ? 'gasto' : 'gastos'} de estilo de vida sem dia definido no calendário
                </span>
                <p className="text-[11px] text-espresso-500">
                  Atribua um dia para que entrem na grade diária e nas métricas de pico.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {undatedPurchases.map((u) => (
              <div
                key={u.id}
                className="p-2.5 rounded-xl bg-white dark:bg-espresso-900 border border-oat-200 dark:border-espresso-700 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-espresso-900 dark:text-oat-100 truncate">
                    {u.description}
                  </div>
                  <div className="text-[10px] text-espresso-500 font-mono">
                    {u.sourceName} • {formatCurrency(u.amount)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 1 && val <= daysInMonth) {
                        handleAssignDayToUndated(u, val);
                      }
                    }}
                    className="bg-oat-50 dark:bg-espresso-800 border border-oat-300 dark:border-espresso-700 rounded-lg px-2 py-1 text-[11px] font-mono text-espresso-800 dark:text-oat-100 cursor-pointer"
                  >
                    <option value="" disabled>
                      Definir Dia...
                    </option>
                    {Array.from({ length: daysInMonth }).map((_, di) => (
                      <option key={di + 1} value={di + 1}>
                        Dia {di + 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

