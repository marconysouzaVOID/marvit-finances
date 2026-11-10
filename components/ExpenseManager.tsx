import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AUVP_GOALS } from '../constants';
import { ExpenseCategory, ExpenseItem, LifestyleSubcategory } from '../types';
import { formatCurrency } from '../utils/formatters';

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

  const filteredExpenses =
    selectedFilter === 'all'
      ? expenses
      : expenses.filter((e) => e.category === selectedFilter);

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
  };

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-maldives-600 text-xl">
              receipt_long
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-display font-bold text-espresso-900">
                Caderno de Gastos & Aportes
              </h2>
              <span className="text-[11px] bg-oat-200 text-espresso-700 font-mono font-bold px-2.5 py-0.5 rounded-full border border-oat-300 shrink-0 whitespace-nowrap">
                {expenses.length} itens
              </span>
            </div>
            <p className="text-xs text-espresso-600">
              Edite valores diretamente na lista ou adicione novos itens na planilha financeira.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsCloneMenuOpen(!isCloneMenuOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
              isCloneMenuOpen
                ? 'bg-maldives-500 text-white border-maldives-600'
                : 'bg-oat-100 hover:bg-oat-200 text-espresso-800 border-oat-300'
            }`}
            title="Clonar orçamento de outro mês ou aplicar um modelo pronto para não ter que digitar tudo do zero"
          >
            <span className="material-symbols-outlined text-[17px] text-maldives-600">
              copy_all
            </span>
            <span>Clonar Orçamento</span>
          </button>

          <div className="grid grid-cols-4 sm:flex items-center gap-1 bg-oat-200/70 p-1 rounded-2xl border border-oat-300 text-[11px] sm:text-xs w-full sm:w-auto">
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
                className={`px-2 sm:px-3 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1 cursor-pointer min-w-0 ${
                  selectedFilter === tab.id
                    ? 'bg-oat-50 text-espresso-900 shadow-sm border border-oat-300'
                    : 'text-espresso-600 hover:text-espresso-900'
                }`}
              >
                {tab.dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${tab.dot}`} />}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painel de Clonar Orçamento (Outro Mês ou Modelos Prontos) */}
      <AnimatePresence>
        {isCloneMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-4"
          >
            <div className="p-4 rounded-2xl bg-oat-100/95 dark:bg-espresso-800/90 border-2 border-maldives-300 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-maldives-600 text-lg">
                    content_copy
                  </span>
                  <h3 className="text-sm font-display font-bold text-espresso-900 dark:text-oat-100">
                    Clonar Orçamento para este Mês
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCloneMenuOpen(false)}
                  className="p-1 rounded-lg hover:bg-oat-200 text-espresso-500 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Clonar de Mês Existente */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-espresso-900 border border-oat-200 dark:border-espresso-700 space-y-2.5">
                  <span className="text-xs font-bold text-espresso-800 dark:text-oat-100 block">
                    📅 Clonar de Outro Mês Salvo
                  </span>
                  <p className="text-[11px] text-espresso-500">
                    Copia todas as despesas e perfil de um mês anterior diretamente para o mês atual.
                  </p>

                  {availableMonthsToClone && availableMonthsToClone.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {availableMonthsToClone.map((opt) => (
                        <div
                          key={opt.monthKey}
                          className="flex items-center justify-between p-2 rounded-lg bg-oat-50 dark:bg-espresso-800 border border-oat-200 dark:border-espresso-700 text-xs"
                        >
                          <div>
                            <span className="font-bold text-espresso-900 dark:text-oat-100 block">
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
                            className="px-2.5 py-1 rounded-lg bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-[11px] transition cursor-pointer shadow-xs"
                          >
                            Clonar
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-espresso-400 italic">
                      Nenhum outro mês com dados salvos no momento.
                    </p>
                  )}
                </div>

                {/* 2. Modelos Prontos de Orçamento (Presets) */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-espresso-900 border border-oat-200 dark:border-espresso-700 space-y-2.5">
                  <span className="text-xs font-bold text-espresso-800 dark:text-oat-100 block">
                    ✨ Modelos Prontos (Presets)
                  </span>
                  <p className="text-[11px] text-espresso-500">
                    Preencha seu mês em 1 clique sem precisar escrever tudo do zero.
                  </p>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (onApplyPreset) onApplyPreset('auvp-50-30-20');
                        setIsCloneMenuOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg bg-oat-50 dark:bg-espresso-800 hover:bg-maldives-50 dark:hover:bg-maldives-950/30 border border-oat-200 dark:border-espresso-700 transition flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-bold text-espresso-900 dark:text-oat-100 block">
                          🏡 Padrão AUVP (50/30/20)
                        </span>
                        <span className="text-[10px] text-espresso-500">
                          Essencial, Cartões, Reserva de Emergência e Ações
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
                      className="w-full text-left p-2.5 rounded-lg bg-oat-50 dark:bg-espresso-800 hover:bg-maldives-50 dark:hover:bg-maldives-950/30 border border-oat-200 dark:border-espresso-700 transition flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-bold text-espresso-900 dark:text-oat-100 block">
                          🚀 Foco em Investimentos (40/30/30)
                        </span>
                        <span className="text-[10px] text-espresso-500">
                          Gastos contidos e 30% em aportes acelerados
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
                      className="w-full text-left p-2.5 rounded-lg bg-oat-50 dark:bg-espresso-800 hover:bg-maldives-50 dark:hover:bg-maldives-950/30 border border-oat-200 dark:border-espresso-700 transition flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-bold text-espresso-900 dark:text-oat-100 block">
                          🍃 Enxuto & Minimalista
                        </span>
                        <span className="text-[10px] text-espresso-500">
                          Custos baixos e foco em reserva e liberdade
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-maldives-600 text-[18px]">
                        arrow_forward
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulário de Novo Gasto/Aporte */}
      <div className="bg-oat-100/90 border border-oat-300 rounded-2xl p-4 mt-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="text-xs font-semibold text-espresso-700 mb-1 block">
              {newCategory === 'estilo' && newSubcategory === 'cartao'
                ? 'Nome do Cartão de Crédito'
                : 'Descrição do gasto ou aporte'}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={
                newCategory === 'estilo' && newSubcategory === 'cartao'
                  ? 'Ex: Cartão Nubank, Cartão Inter, Itaú...'
                  : 'Ex: Feira Orgânica, Jantar, Tesouro IPCA...'
              }
              className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2.5 text-sm text-espresso-900 placeholder-espresso-400 focus:outline-none focus:border-maldives-500"
            />
          </div>

          <div className="sm:col-span-3">
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
              className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2.5 text-sm text-espresso-900 font-mono font-bold focus:outline-none focus:border-maldives-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="text-xs font-semibold text-espresso-700 mb-1 block">
              Pilar de Destino
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
              className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-espresso-900 focus:outline-none focus:border-maldives-500"
            >
              <option value="essencial">🌿 Custos Essenciais</option>
              <option value="estilo">☕ Estilo de Vida</option>
              <option value="investimento">💎 Investimentos</option>
            </select>
          </div>

          <div className="sm:col-span-1">
            <button
              onClick={handleCreate}
              disabled={
                !newName.trim() ||
                (!(newCategory === 'estilo' && newSubcategory === 'cartao') &&
                  !newAmount)
              }
              className="w-full h-[42px] flex items-center justify-center gap-1.5 bg-maldives-500 hover:bg-maldives-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
              title="Adicionar à planilha"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="sm:hidden">Adicionar Item</span>
            </button>
          </div>
        </div>

        {/* Subcategoria do Pilar Estilo de Vida (Cartão de Crédito vs Gasto Direto) */}
        <AnimatePresence>
          {newCategory === 'estilo' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-oat-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-terracotta-600 text-[18px]">
                    credit_card
                  </span>
                  <span className="text-xs font-bold text-espresso-800">
                    Subcategoria de Estilo de Vida:
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSubcategory('cartao')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      newSubcategory === 'cartao'
                        ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                        : 'bg-oat-50 text-espresso-700 border-oat-300 hover:border-terracotta-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      credit_card
                    </span>
                    <span>Cartão de Crédito</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewSubcategory('direto')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      newSubcategory === 'direto'
                        ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-xs'
                        : 'bg-oat-50 text-espresso-700 border-oat-300 hover:border-terracotta-400'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      payments
                    </span>
                    <span>Gasto Direto / Pix</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lista de Itens */}
      <div className="mt-5 overflow-hidden border border-oat-300 rounded-2xl bg-oat-50">
        <div className="max-h-[420px] overflow-y-auto divide-y divide-oat-200">
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
                    className="p-3.5 sm:px-4 hover:bg-oat-100/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: goal.color }}
                        title={goal.name}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isGoalLinked ? (
                            <span className="text-sm font-bold text-espresso-900 flex items-center gap-1.5 flex-wrap">
                              <span className="truncate">{item.name}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300 shrink-0">
                                Pote dos Sonhos
                              </span>
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                onUpdateExpense(item.id, { name: e.target.value })
                              }
                              className="w-full sm:w-auto sm:min-w-[220px] min-w-0 bg-transparent text-sm font-semibold text-espresso-900 hover:border-b hover:border-oat-400 focus:border-b focus:border-maldives-500 focus:outline-none truncate"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${goal.badgeBg}`}
                          >
                            {goal.shortName}
                          </span>

                          {item.category === 'estilo' && !isGoalLinked && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateExpense(item.id, {
                                  subcategory:
                                    item.subcategory === 'cartao' ? 'direto' : 'cartao',
                                })
                              }
                              title="Clique para alternar a subcategoria entre Cartão de Crédito e Gasto Direto"
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition cursor-pointer ${
                                item.subcategory === 'cartao'
                                  ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-2xs'
                                  : 'bg-oat-100 text-espresso-600 border-oat-300 hover:border-terracotta-400'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px]">
                                {item.subcategory === 'cartao'
                                  ? 'credit_card'
                                  : 'payments'}
                              </span>
                              <span>
                                {item.subcategory === 'cartao'
                                  ? 'Cartão de Crédito'
                                  : 'Gasto Direto'}
                              </span>
                            </button>
                          )}

                          {item.category === 'estilo' && item.subcategory === 'cartao' && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-oat-200 text-espresso-600 border border-oat-300 flex items-center gap-0.5 shadow-2xs"
                              title="Cartão global reutilizável em todos os meses"
                            >
                              <span className="material-symbols-outlined text-[11px] text-terracotta-500">
                                language
                              </span>
                              <span>Global</span>
                            </span>
                          )}

                          {item.category === 'estilo' &&
                            item.subcategory === 'cartao' &&
                            onOpenCardsTab && (
                              <button
                                type="button"
                                onClick={() => onOpenCardsTab(item.id)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-maldives-50 text-maldives-800 border border-maldives-300 hover:bg-maldives-100 flex items-center gap-1 transition cursor-pointer"
                                title="Abrir aba Cartões para gerir os gastos individualizados deste cartão"
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  receipt_long
                                </span>
                                <span>
                                  Detalhar Fatura (
                                  {item.cardTransactions?.length || 0})
                                </span>
                              </button>
                            )}

                          <span className="text-[11px] text-espresso-500 font-mono sm:hidden">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-espresso-500 font-mono">
                          R$
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={item.amount}
                          onChange={(e) =>
                            onUpdateExpense(item.id, {
                              amount: Math.max(0, Number(e.target.value)),
                            })
                          }
                          title={
                            isGoalLinked
                              ? 'Valor de aporte deste Pote dos Sonhos neste mês (ajuste se necessário)'
                              : 'Editar valor mensal'
                          }
                          className="w-28 bg-oat-100 border border-oat-300 focus:border-maldives-500 rounded-xl px-2.5 py-1.5 text-sm font-bold text-right text-espresso-900 font-mono focus:outline-none"
                        />
                      </div>

                      {isGoalLinked ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onDeleteExpense(item.id)}
                            className="px-2.5 py-1 rounded-xl bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 border border-terracotta-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                            title="Excluir o aporte deste Pote dos Sonhos apenas deste mês (não afeta os outros meses)"
                          >
                            <span className="material-symbols-outlined text-[16px] text-terracotta-600">
                              delete
                            </span>
                            <span className="hidden sm:inline">Excluir deste Mês</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleCloneExpense(item)}
                            className="text-espresso-400 hover:text-maldives-600 p-1.5 rounded-xl hover:bg-maldives-50 dark:hover:bg-maldives-950/40 transition cursor-pointer"
                            title="Clonar este lançamento (duplicar no orçamento)"
                          >
                            <span className="material-symbols-outlined text-[19px]">
                              content_copy
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteExpense(item.id)}
                            className="text-espresso-400 hover:text-terracotta-600 p-1.5 rounded-xl hover:bg-terracotta-50 transition cursor-pointer"
                            title="Excluir item"
                          >
                            <span className="material-symbols-outlined text-[19px]">
                              delete
                            </span>
                          </button>
                        </div>
                      )}
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
        <div className="mt-3.5 p-3.5 bg-oat-100/90 dark:bg-espresso-800/80 border border-dashed border-oat-300 dark:border-espresso-700 rounded-2xl space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-espresso-800 dark:text-espresso-200">
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
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-oat-50 dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 text-xs shadow-2xs"
              >
                <span className="font-bold text-espresso-800 dark:text-espresso-200 truncate max-w-[190px]">
                  🎯 {g.title}
                </span>
                <span className="font-mono text-espresso-500 text-[11px]">
                  ({formatCurrency(g.monthlyContribution)})
                </span>
                <button
                  type="button"
                  onClick={() => onRestoreGoalContribution?.(g.id)}
                  className="text-maldives-700 dark:text-maldives-400 hover:text-maldives-800 font-bold flex items-center gap-1 ml-1 transition cursor-pointer hover:underline"
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

