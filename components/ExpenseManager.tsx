import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AUVP_GOALS } from '../constants';
import { ExpenseCategory, ExpenseItem, LifestyleSubcategory } from '../types';
import { formatCurrency } from '../utils/formatters';
import { PwaSheetModal } from './PwaSheetModal';
import { FormattedBrlInput } from './FormattedBrlInput';

export interface CloneableMonthOption {
  monthKey: string;
  monthLabel: string;
  itemCount: number;
}

export interface ExcludedGoalInfo {
  id: string;
  title: string;
  monthlyContribution: number;
  budgetCategory: ExpenseCategory;
}

interface ExpenseManagerProps {
  expenses: ExpenseItem[];
  selectedMonthKey?: string;
  availableMonthsToClone?: CloneableMonthOption[];
  onAddExpense: (item: Omit<ExpenseItem, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (id: string, updated: Partial<ExpenseItem>) => void;
  onOpenCardsTab?: (cardId?: string) => void;
  excludedGoals?: ExcludedGoalInfo[];
  onRestoreGoalContribution?: (goalId: string) => void;
  onCloneFromMonth?: (sourceMonthKey: string) => void;
  onApplyPreset?: (presetId: string) => void;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  expenses,
  selectedMonthKey,
  availableMonthsToClone,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onOpenCardsTab,
  excludedGoals,
  onRestoreGoalContribution,
  onCloneFromMonth,
  onApplyPreset,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | ExpenseCategory>('all');
  const [isCloneMenuOpen, setIsCloneMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('essencial');
  const [newSubcategory, setNewSubcategory] =
    useState<LifestyleSubcategory>('cartao');

  // Clonar/duplicar um lançamento individual da planilha
  const handleCloneExpense = (item: ExpenseItem) => {
    onAddExpense({
      name: `${item.name} (Cópia)`,
      amount: item.amount,
      category: item.category,
      subcategory: item.subcategory,
      cardLimit: item.cardLimit,
      cardDueDay: item.cardDueDay,
      cardTransactions: item.cardTransactions
        ? item.cardTransactions.map((tx) => ({
            ...tx,
            id: `tx-clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          }))
        : undefined,
      isCustom: true,
    });
  };

  const CATEGORY_SORT_ORDER: Record<ExpenseCategory, number> = {
    essencial: 0,
    estilo: 1,
    investimento: 2,
  };

  const filteredExpenses = (
    selectedFilter === 'all'
      ? expenses
      : expenses.filter((e) => e.category === selectedFilter)
  )
    .slice()
    .sort((a, b) => {
      const orderDiff =
        (CATEGORY_SORT_ORDER[a.category] ?? 99) -
        (CATEGORY_SORT_ORDER[b.category] ?? 99);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

  const handleCreate = () => {
    const isCardCreation = newCategory === 'estilo' && newSubcategory === 'cartao';
    if (!newName.trim()) return;
    if (!isCardCreation && (!newAmount || Number(newAmount) <= 0)) return;

    onAddExpense({
      name: newName.trim(),
      amount: Math.max(0, Number(newAmount) || 0),
      category: newCategory,
      subcategory: newCategory === 'estilo' ? newSubcategory : undefined,
      cardTransactions: isCardCreation ? [] : undefined,
      isCustom: true,
    });
    setNewName('');
    setNewAmount('');
    setIsAddModalOpen(false);
  };

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 sm:pb-4 border-b border-oat-200 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-maldives-600 text-lg sm:text-xl">
                receipt_long
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-xl font-display font-bold text-espresso-900 whitespace-nowrap">
                  Gastos & Aportes
                </h2>
                <span className="text-[10px] sm:text-[11px] bg-oat-200 text-espresso-700 font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded-full border border-oat-300 dark:border-white/[0.07] shrink-0">
                  {expenses.length}
                </span>
              </div>
              <p className="text-xs text-espresso-600 hidden sm:block">
                Edite valores diretamente na lista ou adicione novos itens na planilha financeira.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:hidden shrink-0">
            <button
              type="button"
              onClick={() => setIsCloneMenuOpen(true)}
              className="w-7 h-7 rounded-xl bg-oat-100 dark:bg-oat-200/75 text-maldives-600 border border-oat-300 dark:border-white/[0.08] flex items-center justify-center cursor-pointer"
              title="Clonar orçamento"
            >
              <span className="material-symbols-outlined text-[16px]">copy_all</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-maldives-500 text-white text-[11px] font-bold flex items-center gap-0.5 shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              <span>Novo</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCloneMenuOpen(true)}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs bg-oat-100 dark:bg-oat-200/75 hover:bg-oat-200 text-espresso-800 border-oat-300 dark:border-white/[0.08]"
              title="Clonar orçamento de outro mês ou aplicar modelo pronto"
            >
              <span className="material-symbols-outlined text-[17px] text-maldives-600">
                copy_all
              </span>
              <span>Clonar</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-maldives-500 hover:bg-maldives-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-[17px]">add</span>
              <span>Novo Item</span>
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-1 bg-oat-200/70 dark:bg-oat-200/60 p-1 rounded-2xl border border-oat-300 dark:border-white/[0.06] text-[10px] sm:text-xs w-full sm:w-auto">
            {(
              [
                { id: 'all', label: 'Todos', dot: '' },
                { id: 'essencial', label: 'Essenciais', dot: 'bg-sage-500' },
                { id: 'estilo', label: 'Estilo', dot: 'bg-terracotta-500' },
                { id: 'investimento', label: 'Aportes', dot: 'bg-maldives-500' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedFilter(tab.id)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1 cursor-pointer shrink-0 ${
                  selectedFilter === tab.id
                    ? 'bg-oat-50 text-espresso-900 shadow-sm border border-oat-300 dark:border-white/[0.08]'
                    : 'text-espresso-600 hover:text-espresso-900'
                }`}
              >
                {tab.dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.dot}`} />}
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Bottom Sheet: Novo Lançamento / Aporte */}
      <PwaSheetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Lançamento"
        subtitle="Adicione uma despesa, cartão ou aporte ao mês"
        icon="add_circle"
        tone="maldives"
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-espresso-700 mb-1 block">
              Pilar de Destino
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'essencial', label: 'Essencial', emoji: '🌿' },
                  { id: 'estilo', label: 'Estilo', emoji: '☕' },
                  { id: 'investimento', label: 'Aporte', emoji: '💎' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNewCategory(cat.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                    newCategory === cat.id
                      ? 'bg-maldives-500 text-white border-maldives-600 shadow-xs'
                      : 'bg-surface-input text-espresso-700 border-oat-300 dark:border-white/[0.08]'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {newCategory === 'estilo' && (
            <div>
              <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                Formato em Estilo de Vida
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewSubcategory('cartao')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    newSubcategory === 'cartao'
                      ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                      : 'bg-surface-input text-espresso-700 border-oat-300 dark:border-white/[0.08]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">credit_card</span>
                  <span>Cartão de Crédito</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewSubcategory('direto')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    newSubcategory === 'direto'
                      ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                      : 'bg-surface-input text-espresso-700 border-oat-300 dark:border-white/[0.08]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">payments</span>
                  <span>Gasto Direto / Pix</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-espresso-700 mb-1 block">
              {newCategory === 'estilo' && newSubcategory === 'cartao'
                ? 'Nome do Cartão de Crédito'
                : 'Descrição'}
            </label>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={
                newCategory === 'estilo' && newSubcategory === 'cartao'
                  ? 'Ex: Cartão Nubank, Inter...'
                  : 'Ex: Mercado, Jantar, Tesouro IPCA...'
              }
              className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-espresso-900 placeholder-espresso-400 focus:outline-none focus:border-maldives-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-espresso-700 mb-1 block">
              {newCategory === 'estilo' && newSubcategory === 'cartao'
                ? 'Fatura Inicial (Opcional R$)'
                : 'Valor Mensal (R$)'}
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={newAmount}
              onChange={(e) =>
                setNewAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="0,00"
              className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-espresso-900 font-mono font-bold focus:outline-none focus:border-maldives-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={
                !newName.trim() ||
                (!(newCategory === 'estilo' && newSubcategory === 'cartao') &&
                  !newAmount)
              }
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-maldives-500 hover:bg-maldives-600 disabled:opacity-40 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">check</span>
              <span>Adicionar ao Mês</span>
            </button>
          </div>
        </div>
      </PwaSheetModal>

      {/* Modal Bottom Sheet: Clonar Orçamento */}
      <PwaSheetModal
        isOpen={isCloneMenuOpen}
        onClose={() => setIsCloneMenuOpen(false)}
        title="Clonar Orçamento"
        subtitle="Copie um mês anterior ou aplique um modelo pronto"
        icon="content_copy"
        tone="maldives"
        maxWidthClass="max-w-2xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-2xl bg-oat-100/70 dark:bg-oat-200/45 border border-oat-200 dark:border-white/[0.07] space-y-2.5">
            <span className="text-xs font-bold text-espresso-800 block">
              📅 De Outro Mês Salvo
            </span>
            {availableMonthsToClone && availableMonthsToClone.length > 0 ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableMonthsToClone.map((opt) => (
                  <div
                    key={opt.monthKey}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-oat-50 border border-oat-200 dark:border-white/[0.06] text-xs"
                  >
                    <div>
                      <span className="font-bold text-espresso-900 block">
                        {opt.monthLabel}
                      </span>
                      <span className="text-[10px] text-espresso-500">
                        {opt.itemCount} {opt.itemCount === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onCloneFromMonth) onCloneFromMonth(opt.monthKey);
                        setIsCloneMenuOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-[11px] transition cursor-pointer shadow-xs"
                    >
                      Clonar
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-espresso-500 italic">
                Nenhum outro mês com dados salvos.
              </p>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-oat-100/70 dark:bg-oat-200/45 border border-oat-200 dark:border-white/[0.07] space-y-2">
            <span className="text-xs font-bold text-espresso-800 block">
              ✨ Modelos Prontos
            </span>
            <button
              type="button"
              onClick={() => {
                if (onApplyPreset) onApplyPreset('auvp-50-30-20');
                setIsCloneMenuOpen(false);
              }}
              className="w-full text-left p-2.5 rounded-xl bg-oat-50 hover:bg-maldives-50 border border-oat-200 dark:border-white/[0.06] transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-espresso-900 block">
                  🏡 Padrão AUVP (50/30/20)
                </span>
                <span className="text-[10px] text-espresso-500">
                  Essencial, Cartões, Reserva e Ações
                </span>
              </div>
              <span className="material-symbols-outlined text-maldives-600 text-[18px]">
                arrow_forward
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onApplyPreset) onApplyPreset('investidor-40-30-30');
                setIsCloneMenuOpen(false);
              }}
              className="w-full text-left p-2.5 rounded-xl bg-oat-50 hover:bg-maldives-50 border border-oat-200 dark:border-white/[0.06] transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-espresso-900 block">
                  🚀 Foco em Investimentos (40/30/30)
                </span>
                <span className="text-[10px] text-espresso-500">
                  30% dedicados a patrimônio
                </span>
              </div>
              <span className="material-symbols-outlined text-maldives-600 text-[18px]">
                arrow_forward
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onApplyPreset) onApplyPreset('enxuto-minimalista');
                setIsCloneMenuOpen(false);
              }}
              className="w-full text-left p-2.5 rounded-xl bg-oat-50 hover:bg-maldives-50 border border-oat-200 dark:border-white/[0.06] transition flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-espresso-900 block">
                  🍃 Enxuto & Minimalista
                </span>
                <span className="text-[10px] text-espresso-500">
                  Custos baixos e reserva prioritária
                </span>
              </div>
              <span className="material-symbols-outlined text-maldives-600 text-[18px]">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </PwaSheetModal>

      {/* Lista de Itens */}
      <div className="mt-4 overflow-hidden border border-oat-300 dark:border-white/[0.07] rounded-2xl bg-oat-50 dark:bg-oat-100/50">
        <div className="max-h-[420px] overflow-y-auto divide-y divide-oat-200 dark:divide-white/[0.05]">
          <AnimatePresence initial={false}>
            {filteredExpenses.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 text-center text-espresso-500 text-sm"
              >
                Nenhum item cadastrado neste pilar ainda.
              </motion.div>
            ) : (
              filteredExpenses.map((item) => {
                const goal = AUVP_GOALS[item.category];
                const isGoalLinked = Boolean(item.linkedGoalId);

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="px-2.5 py-2 sm:px-4 sm:py-2.5 hover:bg-oat-100/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: goal.color }}
                        title={goal.name}
                      />
                      <div className="flex-1 min-w-0 flex items-center justify-between sm:justify-start gap-1.5 flex-wrap">
                        <div className="flex-1 min-w-0">
                          {isGoalLinked ? (
                            <span className="text-xs sm:text-sm font-bold text-espresso-900 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{item.name}</span>
                              <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300 shrink-0">
                                Pote
                              </span>
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                onUpdateExpense(item.id, { name: e.target.value })
                              }
                              className="compact-select w-full sm:w-auto sm:min-w-[200px] min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-espresso-900 hover:border-b hover:border-oat-400 focus:border-b focus:border-maldives-500 focus:outline-none truncate"
                            />
                          )}
                        </div>
                        <span
                          className={`text-[9px] sm:text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${goal.badgeBg}`}
                        >
                          {goal.shortName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 justify-between sm:justify-end pl-4 sm:pl-0">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        {item.category === 'estilo' && !isGoalLinked && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateExpense(item.id, {
                                subcategory:
                                  item.subcategory === 'cartao' ? 'direto' : 'cartao',
                              })
                            }
                            title="Clique para alternar entre Cartão de Crédito e Gasto Direto"
                            className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 transition cursor-pointer shrink-0 ${
                              item.subcategory === 'cartao'
                                ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-2xs'
                                : 'bg-oat-100 text-espresso-600 border-oat-300 hover:border-terracotta-400'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[11px]">
                              {item.subcategory === 'cartao'
                                ? 'credit_card'
                                : 'payments'}
                            </span>
                            <span>
                              {item.subcategory === 'cartao' ? 'Cartão' : 'Direto'}
                            </span>
                          </button>
                        )}

                        {item.category === 'estilo' &&
                          item.subcategory === 'cartao' &&
                          onOpenCardsTab && (
                            <button
                              type="button"
                              onClick={() => onOpenCardsTab(item.id)}
                              className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-maldives-50 text-maldives-800 border border-maldives-300 hover:bg-maldives-100 flex items-center gap-0.5 transition cursor-pointer shrink-0"
                              title="Abrir aba Cartões para gerir os gastos individualizados deste cartão"
                            >
                              <span className="material-symbols-outlined text-[11px]">
                                receipt_long
                              </span>
                              <span>
                                Fatura ({item.cardTransactions?.length || 0})
                              </span>
                            </button>
                          )}
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold text-espresso-500 font-mono">
                            R$
                          </span>
                          <FormattedBrlInput
                            value={item.amount}
                            onChange={(val) =>
                              onUpdateExpense(item.id, { amount: Math.max(0, val) })
                            }
                            className="w-24 sm:w-28 bg-surface-input border border-oat-300 dark:border-white/[0.08] focus:border-maldives-500 rounded-lg px-2 py-1 text-xs sm:text-sm font-bold text-right text-espresso-900 font-mono focus:outline-none"
                          />
                        </div>

                        {isGoalLinked ? (
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(item.id)}
                            className="px-2 py-1 rounded-lg bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 border border-terracotta-300/80 dark:border-terracotta-300/35 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Excluir o aporte deste Pote dos Sonhos apenas deste mês"
                          >
                            <span className="material-symbols-outlined text-[15px] text-terracotta-600">
                              delete
                            </span>
                            <span className="hidden sm:inline">Excluir deste Mês</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleCloneExpense(item)}
                              className="text-espresso-400 hover:text-maldives-600 p-1 rounded-lg hover:bg-maldives-50 transition cursor-pointer"
                              title="Clonar este lançamento"
                            >
                              <span className="material-symbols-outlined text-[17px]">
                                content_copy
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteExpense(item.id)}
                              className="text-espresso-400 hover:text-terracotta-600 p-1 rounded-lg hover:bg-terracotta-50 transition cursor-pointer"
                              title="Excluir item"
                            >
                              <span className="material-symbols-outlined text-[17px]">
                                delete
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Banner de Potes dos Sonhos não aportados neste mês */}
      {excludedGoals && excludedGoals.length > 0 && (
        <div className="mt-3.5 p-3.5 bg-oat-100/90 dark:bg-oat-200/45 border border-dashed border-oat-300 dark:border-white/[0.1] rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-espresso-800">
            <span className="material-symbols-outlined text-base text-terracotta-500">
              savings
            </span>
            <span>
              Potes dos Sonhos sem aporte neste mês ({excludedGoals.length}):
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {excludedGoals.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-oat-50 border border-oat-300 dark:border-white/[0.08] text-xs shadow-2xs"
              >
                <span className="font-bold text-espresso-800 truncate max-w-[190px]">
                  🎯 {g.title}
                </span>
                <span className="font-mono text-espresso-500 text-[11px]">
                  ({formatCurrency(g.monthlyContribution)})
                </span>
                <button
                  type="button"
                  onClick={() => onRestoreGoalContribution?.(g.id)}
                  className="text-maldives-700 hover:text-maldives-800 font-bold flex items-center gap-1 ml-1 transition cursor-pointer hover:underline"
                  title="Reativar aporte deste Pote dos Sonhos neste mês"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    add_circle
                  </span>
                  <span>Incluir Aporte</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

