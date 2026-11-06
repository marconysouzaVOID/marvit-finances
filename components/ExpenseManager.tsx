import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AUVP_GOALS } from '../constants';
import { ExpenseCategory, ExpenseItem, LifestyleSubcategory } from '../types';
import { formatCurrency } from '../utils/formatters';

interface ExpenseManagerProps {
  expenses: ExpenseItem[];
  onAddExpense: (item: Omit<ExpenseItem, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (id: string, updated: Partial<ExpenseItem>) => void;
  onOpenCardsTab?: (cardId?: string) => void;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  expenses,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
  onOpenCardsTab,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | ExpenseCategory>('all');
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('essencial');
  const [newSubcategory, setNewSubcategory] =
    useState<LifestyleSubcategory>('cartao');

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
              Edite valores diretamente na lista ou adicione novos itens na despensa financeira.
            </p>
          </div>
        </div>

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
                          disabled={isGoalLinked}
                          value={item.amount}
                          onChange={(e) =>
                            onUpdateExpense(item.id, {
                              amount: Math.max(0, Number(e.target.value)),
                            })
                          }
                          title={
                            isGoalLinked
                              ? 'Valor sincronizado automaticamente pela aba Potes dos Sonhos'
                              : 'Editar valor mensal'
                          }
                          className={`w-28 bg-oat-100 border border-oat-300 focus:border-maldives-500 rounded-xl px-2.5 py-1.5 text-sm font-bold text-right text-espresso-900 font-mono focus:outline-none ${
                            isGoalLinked ? 'opacity-75 cursor-not-allowed' : ''
                          }`}
                        />
                      </div>

                      {!isGoalLinked ? (
                        <button
                          onClick={() => onDeleteExpense(item.id)}
                          className="text-espresso-400 hover:text-terracotta-600 p-1.5 rounded-xl hover:bg-terracotta-50 transition cursor-pointer"
                          title="Excluir item"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            delete
                          </span>
                        </button>
                      ) : (
                        <span
                          className="p-1.5 text-maldives-600"
                          title="Vinculado à aba Metas & Sonhos"
                        >
                          <span className="material-symbols-outlined text-[19px]">
                            link
                          </span>
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

