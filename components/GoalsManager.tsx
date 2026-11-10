import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { GOAL_ICONS } from '../constants';
import { CustomGoalItem, ExpenseCategory } from '../types';
import {
  calculateGoalProjection,
  formatCurrency,
  formatPercent,
} from '../utils/formatters';
import { InteractiveAsset } from './InteractiveAsset';

interface GoalsManagerProps {
  goals: CustomGoalItem[];
  selectedMonthKey?: string;
  excludedGoalIds?: string[];
  onToggleMonthExclusion?: (goalId: string) => void;
  onAddGoal: (goal: Omit<CustomGoalItem, 'id'>) => void;
  onUpdateGoal: (id: string, updated: Partial<CustomGoalItem>) => void;
  onDeleteGoal: (id: string) => void;
}

export const GoalsManager: React.FC<GoalsManagerProps> = ({
  goals,
  selectedMonthKey,
  excludedGoalIds,
  onToggleMonthExclusion,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('beach_access');
  const [targetAmount, setTargetAmount] = useState<number | ''>(25000);
  const [currentAmount, setCurrentAmount] = useState<number | ''>(2000);
  const [monthlyContribution, setMonthlyContribution] = useState<number | ''>(500);
  const [annualInterestRate, setAnnualInterestRate] = useState<number>(10.5);
  const [syncWithBudget, setSyncWithBudget] = useState(true);
  const [budgetCategory, setBudgetCategory] = useState<ExpenseCategory>('investimento');
  const [notes, setNotes] = useState('');

  // Estado de edição de pote existente
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editIcon, setEditIcon] = useState('savings');
  const [editTargetAmount, setEditTargetAmount] = useState<number | ''>(0);
  const [editAnnualRate, setEditAnnualRate] = useState<number | ''>(10.5);
  const [editNotes, setEditNotes] = useState('');
  const [editBudgetCategory, setEditBudgetCategory] =
    useState<ExpenseCategory>('investimento');

  const totalAccumulated = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalMonthlyPlanned = goals.reduce((acc, g) => acc + g.monthlyContribution, 0);

  const handleCreateGoal = () => {
    if (!title.trim() || !targetAmount || Number(targetAmount) <= 0) return;

    onAddGoal({
      title: title.trim(),
      icon,
      targetAmount: Number(targetAmount),
      currentAmount: Math.max(0, Number(currentAmount) || 0),
      monthlyContribution: Math.max(0, Number(monthlyContribution) || 0),
      annualInterestRate: Math.max(0, Number(annualInterestRate) || 0),
      syncWithBudget,
      budgetCategory,
      notes: notes.trim() || undefined,
    });

    setTitle('');
    setNotes('');
    setIsCreating(false);
  };

  const startEditingGoal = (goal: CustomGoalItem) => {
    setEditingGoalId(goal.id);
    setEditTitle(goal.title);
    setEditIcon(goal.icon || 'savings');
    setEditTargetAmount(goal.targetAmount);
    setEditAnnualRate(goal.annualInterestRate);
    setEditNotes(goal.notes || '');
    setEditBudgetCategory(goal.budgetCategory || 'investimento');
  };

  const handleSaveEditGoal = (id: string) => {
    if (!editTitle.trim()) return;
    onUpdateGoal(id, {
      title: editTitle.trim(),
      icon: editIcon,
      targetAmount: Math.max(1, Number(editTargetAmount) || 1),
      annualInterestRate: Math.max(0, Number(editAnnualRate) || 0),
      notes: editNotes.trim() || undefined,
      budgetCategory: editBudgetCategory,
    });
    setEditingGoalId(null);
  };

  const handleQuickDeposit = (goal: CustomGoalItem) => {
    const deposit = goal.monthlyContribution > 0 ? goal.monthlyContribution : 250;
    const nextAmount = goal.currentAmount + deposit;
    onUpdateGoal(goal.id, { currentAmount: nextAmount });

    if (nextAmount >= goal.targetAmount) {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.65 },
        colors: ['#14B8A6', '#D97757', '#84A98C'],
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho dos Potes dos Sonhos */}
      <div className="bg-oat-50/95 border border-oat-300/90 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-oat-200 dark:border-white/[0.06]">
          <div className="flex items-center gap-3 sm:gap-4">
            <InteractiveAsset
              src="/assets/marvit-metas.png"
              alt="Potes dos Sonhos & Metas"
              size="md"
              tone="maldives"
              badgeIcon="emoji_events"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-display font-bold text-espresso-900">
                  Potes dos Sonhos & Metas de Longo Prazo
                </h2>
                <span className="text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300 dark:border-maldives-300/35">
                  Juros Compostos Ativos
                </span>
              </div>
              <p className="text-xs sm:text-sm text-espresso-600 mt-1">
                Destine aportes mensais para seus projetos de vida, edite nome, rentabilidade e observações a qualquer momento e acompanhe a projeção exata de conclusão.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2.5 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCreating ? 'close' : 'add_circle'}
            </span>
            <span>{isCreating ? 'Fechar Formulário' : 'Novo Pote de Meta'}</span>
          </button>
        </div>

        {/* Resumo Consolidado das Metas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-4 rounded-2xl bg-maldives-50/80 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-maldives-800 tracking-wider block">
                Total Guardado nos Potes
              </span>
              <span className="text-xl font-mono font-extrabold text-maldives-700 mt-0.5 block">
                {formatCurrency(totalAccumulated)}
              </span>
              <span className="text-[11px] text-espresso-600">
                de {formatCurrency(totalTarget)} em metas
              </span>
            </div>
            <span className="material-symbols-outlined text-maldives-500 text-3xl">
              savings
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-sage-50 border border-sage-200 dark:border-sage-300/25 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-sage-600 tracking-wider block">
                Aporte Mensal Destinado
              </span>
              <span className="text-xl font-mono font-extrabold text-espresso-900 mt-0.5 block">
                {formatCurrency(totalMonthlyPlanned)}/mês
              </span>
              <span className="text-[11px] text-espresso-600">
                Somando {goals.length} {goals.length === 1 ? 'meta ativa' : 'metas ativas'}
              </span>
            </div>
            <span className="material-symbols-outlined text-sage-500 text-3xl">
              calendar_Check
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-terracotta-50 border border-terracotta-200 dark:border-terracotta-300/25 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-terracotta-700 tracking-wider block">
                Progresso Global
              </span>
              <span className="text-xl font-mono font-extrabold text-terracotta-600 mt-0.5 block">
                {formatPercent(totalTarget > 0 ? (totalAccumulated / totalTarget) * 100 : 0)}
              </span>
              <span className="text-[11px] text-espresso-600">
                Faltam {formatCurrency(Math.max(0, totalTarget - totalAccumulated))}
              </span>
            </div>
            <span className="material-symbols-outlined text-terracotta-500 text-3xl">
              auto_graph
            </span>
          </div>
        </div>

        {/* Formulário de Criação de Nova Meta */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 p-5 rounded-2xl bg-oat-100 dark:bg-oat-200/50 border border-maldives-300 dark:border-maldives-300/35 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-espresso-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-maldives-600 text-lg">
                      temp_preferences_custom
                    </span>
                    <span>Criar Novo Pote dos Sonhos</span>
                  </h3>
                </div>

                {/* Escolha de Ícone */}
                <div>
                  <label className="text-xs font-semibold text-espresso-700 mb-1.5 block">
                    Ícone do Pote
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_ICONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setIcon(item.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                          icon === item.id
                            ? 'bg-maldives-500 text-white border-maldives-600/40 shadow-sm'
                            : 'bg-oat-50 text-espresso-700 border-oat-300 dark:border-white/[0.08] hover:border-maldives-400'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {item.id}
                        </span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Nome da Meta / Projeto
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Viagem p/ Itália, Reforma da Cozinha..."
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Valor Alvo Total (R$)
                    </label>
                    <input
                      type="number"
                      min="100"
                      step="500"
                      value={targetAmount}
                      onChange={(e) =>
                        setTargetAmount(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Valor Já Guardado (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={currentAmount}
                      onChange={(e) =>
                        setCurrentAmount(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Aporte Mensal (R$/mês)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={monthlyContribution}
                      onChange={(e) =>
                        setMonthlyContribution(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-maldives-700 focus:outline-none focus:border-maldives-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Rentabilidade Esperada (% a.a.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      value={annualInterestRate}
                      onChange={(e) => setAnnualInterestRate(Number(e.target.value))}
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Observações (Opcional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Aplicado em CDB 110% CDI / Tesouro IPCA+"
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
                    />
                  </div>
                </div>

                {/* Vínculo com a planilha mensal */}
                <div className="p-3.5 rounded-xl bg-oat-50 border border-oat-300 dark:border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncWithBudget}
                      onChange={(e) => setSyncWithBudget(e.target.checked)}
                      className="w-4 h-4 accent-maldives-500 rounded cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-espresso-800">
                      Contabilizar aporte automaticamente na Planilha Mensal de Gastos & Aportes
                    </span>
                  </label>

                  {syncWithBudget && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-espresso-600">Pilar:</span>
                      <select
                        value={budgetCategory}
                        onChange={(e) => setBudgetCategory(e.target.value as ExpenseCategory)}
                        className="bg-oat-100 border border-oat-300 rounded-lg px-2.5 py-1 text-xs font-bold text-espresso-900"
                      >
                        <option value="investimento">💎 Investimentos (20%)</option>
                        <option value="estilo">☕ Estilo de Vida (30%)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateGoal}
                    disabled={!title.trim() || !targetAmount}
                    className="px-5 py-2 rounded-xl bg-maldives-500 hover:bg-maldives-600 disabled:opacity-40 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Salvar Pote dos Sonhos
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Grid de Cards das Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {goals.map((goal, idx) => {
          const isEditingThis = editingGoalId === goal.id;
          const proj = calculateGoalProjection(
            goal.targetAmount,
            goal.currentAmount,
            goal.monthlyContribution,
            goal.annualInterestRate
          );

          return (
            <motion.div
              key={goal.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="bg-oat-50/95 border border-oat-300 dark:border-white/[0.07] hover:border-maldives-400/70 rounded-3xl p-5 shadow-cozy flex flex-col justify-between transition-all"
            >
              <div>
                {/* Topo do Card */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-maldives-600 text-xl">
                        {goal.icon || 'savings'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-display font-bold text-espresso-900 leading-snug">
                        {goal.title}
                      </h3>
                      <span className="text-[11px] font-mono text-espresso-500">
                        Rentabilidade: {goal.annualInterestRate}% a.a.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        isEditingThis
                          ? setEditingGoalId(null)
                          : startEditingGoal(goal)
                      }
                      className={`p-1.5 rounded-lg transition cursor-pointer ${
                        isEditingThis
                          ? 'bg-maldives-100 text-maldives-700'
                          : 'text-espresso-500 hover:text-maldives-600 hover:bg-maldives-50'
                      }`}
                      title="Editar nome, observações, rentabilidade e meta"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isEditingThis ? 'close' : 'edit'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteGoal(goal.id)}
                      className="text-espresso-400 hover:text-terracotta-600 p-1.5 rounded-lg hover:bg-terracotta-50 transition cursor-pointer"
                      title="Remover meta"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>

                {/* Painel de Edição Completa do Pote (Nome, Observações, Rentabilidade, Valor Alvo e Ícone) */}
                <AnimatePresence>
                  {isEditingThis && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3.5 p-3.5 rounded-2xl bg-oat-100 border-2 border-maldives-300 space-y-3">
                        <div className="text-xs font-bold text-maldives-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[16px]">
                            edit_note
                          </span>
                          <span>Editar Pote dos Sonhos</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-espresso-600 block mb-1">
                            Ícone
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {GOAL_ICONS.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setEditIcon(item.id)}
                                className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition cursor-pointer ${
                                  editIcon === item.id
                                    ? 'bg-maldives-500 text-white border-maldives-600'
                                    : 'bg-oat-50 text-espresso-700 border-oat-300 hover:border-maldives-400'
                                }`}
                                title={item.label}
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {item.id}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-espresso-600 block mb-1">
                            Nome da Meta
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-oat-50 border border-oat-300 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-espresso-900 focus:outline-none focus:border-maldives-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-espresso-600 block mb-1">
                              Meta Final (R$)
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="500"
                              value={editTargetAmount}
                              onChange={(e) =>
                                setEditTargetAmount(
                                  e.target.value === ''
                                    ? ''
                                    : Number(e.target.value)
                                )
                              }
                              className="w-full bg-oat-50 border border-oat-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase text-espresso-600 block mb-1">
                              Rentabilidade (% a.a.)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="50"
                              step="0.5"
                              value={editAnnualRate}
                              onChange={(e) =>
                                setEditAnnualRate(
                                  e.target.value === ''
                                    ? ''
                                    : Number(e.target.value)
                                )
                              }
                              className="w-full bg-oat-50 border border-oat-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-maldives-700 focus:outline-none focus:border-maldives-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-espresso-600 block mb-1">
                            Observações
                          </label>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Adicione ou altere as observações..."
                            className="w-full bg-oat-50 border border-oat-300 rounded-xl px-2.5 py-1.5 text-xs text-espresso-900 focus:outline-none focus:border-maldives-500"
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-[10px] font-bold uppercase text-espresso-600">
                            Pilar na Planilha:
                          </span>
                          <select
                            value={editBudgetCategory}
                            onChange={(e) =>
                              setEditBudgetCategory(
                                e.target.value as ExpenseCategory
                              )
                            }
                            className="bg-oat-50 border border-oat-300 rounded-lg px-2 py-1 text-xs font-bold text-espresso-900"
                          >
                            <option value="investimento">
                              💎 Investimentos (20%)
                            </option>
                            <option value="estilo">☕ Estilo de Vida (30%)</option>
                          </select>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingGoalId(null)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditGoal(goal.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-maldives-500 hover:bg-maldives-600 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                          >
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isEditingThis && goal.notes && (
                  <p
                    onClick={() => startEditingGoal(goal)}
                    title="Clique para editar observações"
                    className="text-xs text-espresso-600 bg-oat-100/80 dark:bg-oat-200/45 hover:bg-oat-200/70 px-3 py-2 rounded-xl mt-3 border border-oat-200 dark:border-white/[0.06] italic cursor-pointer transition"
                  >
                    “{goal.notes}”
                  </p>
                )}

                {/* Progresso do Pote */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-espresso-500 block">Acumulado no Pote</span>
                      <span className="text-xl font-mono font-extrabold text-maldives-700">
                        {formatCurrency(goal.currentAmount)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-espresso-500 block">Meta Final</span>
                      <span className="text-sm font-mono font-bold text-espresso-800">
                        {formatCurrency(goal.targetAmount)}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-oat-200 dark:bg-white/[0.08] rounded-full h-3.5 mt-2.5 overflow-hidden p-0.5 border border-oat-300 dark:border-white/[0.04]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${proj.progressPercent}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-gradient-to-r from-maldives-500 to-sage-400"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono font-bold text-espresso-600 mt-1">
                    <span>{formatPercent(proj.progressPercent)} concluído</span>
                    <span>Faltam {formatCurrency(proj.remainingAmount)}</span>
                  </div>
                </div>

                {/* Edição Rápida de Saldo, Aporte Mensal e Rentabilidade */}
                <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-2xl bg-oat-100/90 dark:bg-oat-200/45 border border-oat-200 dark:border-white/[0.06]">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-espresso-500 block mb-1">
                      Já Guardado (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={goal.currentAmount}
                      onChange={(e) =>
                        onUpdateGoal(goal.id, {
                          currentAmount: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-lg px-2 py-1 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-maldives-700 block mb-1">
                      Aporte (R$/mês)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={goal.monthlyContribution}
                      onChange={(e) =>
                        onUpdateGoal(goal.id, {
                          monthlyContribution: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-surface-input border border-maldives-300 dark:border-maldives-400/35 rounded-lg px-2 py-1 text-xs font-mono font-bold text-maldives-700 focus:outline-none focus:border-maldives-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-espresso-500 block mb-1">
                      Taxa (% a.a.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.5"
                      value={goal.annualInterestRate}
                      onChange={(e) =>
                        onUpdateGoal(goal.id, {
                          annualInterestRate: Math.max(0, Number(e.target.value)),
                        })
                      }
                      className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-lg px-2 py-1 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                    />
                  </div>
                </div>

                {/* Projeção de Quando Será Batida */}
                <div className="mt-3.5 p-3.5 rounded-2xl bg-maldives-50/70 border border-maldives-200 dark:border-maldives-300/25 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-espresso-700 font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-maldives-600 text-[16px]">
                        event_available
                      </span>
                      Previsão da Meta:
                    </span>
                    <span className="font-bold text-maldives-800">
                      {proj.estimatedDateLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-espresso-600">
                    <span>Tempo estimado:</span>
                    <span className="font-mono font-bold text-espresso-900">
                      {proj.yearsFormatted}
                    </span>
                  </div>

                  {!proj.isAlreadyReached && Number.isFinite(proj.monthsRemaining) && (
                    <div className="flex items-center justify-between text-[11px] text-espresso-600 pt-1 border-t border-maldives-200/70 dark:border-white/[0.06]">
                      <span>Juros compostos ganhos:</span>
                      <span className="font-mono font-bold text-sage-600">
                        +{formatCurrency(proj.totalInterestEarned)}
                      </span>
                    </div>
                  )}

                  {proj.monthsSavedWithExtra100 > 0 && (
                    <div className="text-[11px] text-terracotta-700 bg-terracotta-50 px-2.5 py-1 rounded-lg border border-terracotta-200 dark:border-terracotta-300/25 mt-1">
                      💡 +R$ 200/mês antecipa sua conquista em{' '}
                      <strong>{proj.monthsSavedWithExtra100} meses</strong>!
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Card: Toggle de Vínculo com Orçamento + Exclusão do Mês + Botão de Depósito Rápido */}
              <div className="mt-4 pt-3 border-t border-oat-200 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateGoal(goal.id, { syncWithBudget: !goal.syncWithBudget })
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                      goal.syncWithBudget
                        ? 'bg-sage-100 text-sage-600 border-sage-300'
                        : 'bg-oat-100 text-espresso-500 border-oat-300 hover:text-espresso-800'
                    }`}
                    title="Vínculo geral: Contabilizar ou não este pote no orçamento"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {goal.syncWithBudget ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span>{goal.syncWithBudget ? 'Na Planilha' : 'Simulação'}</span>
                  </button>

                  {goal.syncWithBudget && onToggleMonthExclusion && (
                    <button
                      type="button"
                      onClick={() => onToggleMonthExclusion(goal.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 cursor-pointer ${
                        (excludedGoalIds || []).includes(goal.id)
                          ? 'bg-terracotta-100 text-terracotta-700 border-terracotta-300 hover:bg-terracotta-200'
                          : 'bg-maldives-50 text-maldives-800 border-maldives-300 hover:bg-maldives-100'
                      }`}
                      title={
                        (excludedGoalIds || []).includes(goal.id)
                          ? 'Aporte pausado neste mês. Clique para reativar o aporte no orçamento deste mês!'
                          : 'Aporte ativo neste mês. Clique para pausar/excluir o aporte apenas deste mês!'
                      }
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        {(excludedGoalIds || []).includes(goal.id)
                          ? 'pause_circle'
                          : 'task_alt'}
                      </span>
                      <span>
                        {(excludedGoalIds || []).includes(goal.id)
                          ? 'Pausado no Mês'
                          : 'Aportando no Mês'}
                      </span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickDeposit(goal)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-maldives-500 hover:bg-maldives-600 text-white text-[11px] sm:text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                  title="Somar 1 aporte mensal ao saldo guardado deste pote"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    add_task
                  </span>
                  <span>+1 Aporte ({formatCurrency(goal.monthlyContribution)})</span>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
