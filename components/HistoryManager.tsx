import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ExpenseCategory, MonthSnapshot } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import {
  formatMonthKeyLabel,
  formatMonthKeySlashLabel,
  inferMonthKeyFromLabel,
  MONTH_NAMES_FULL,
} from './MonthCalendarBar';

interface HistoryManagerProps {
  history: MonthSnapshot[];
  selectedMonthKey: string;
  currentMonthNotes?: string;
  onSaveCurrentMonth: (
    label: string,
    notes?: string,
    targetMonthKey?: string
  ) => void;
  onLoadSnapshot: (snapshot: MonthSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({
  history,
  selectedMonthKey,
  currentMonthNotes,
  onSaveCurrentMonth,
  onLoadSnapshot,
  onDeleteSnapshot,
}) => {
  const [targetMonthKey, setTargetMonthKey] = useState<string>(selectedMonthKey);
  const [newLabel, setNewLabel] = useState<string>(() =>
    formatMonthKeySlashLabel(selectedMonthKey)
  );
  const [newNotes, setNewNotes] = useState<string>(currentMonthNotes || '');
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Sincroniza o mês sugerido no formulário sempre que o usuário alternar o mês no Calendário
  useEffect(() => {
    setTargetMonthKey(selectedMonthKey);
    setNewLabel(formatMonthKeySlashLabel(selectedMonthKey));
    setNewNotes(currentMonthNotes || '');
  }, [selectedMonthKey, currentMonthNotes]);

  const [selYearStr, selMonthStr] = targetMonthKey.split('-');
  const selYear = Number(selYearStr) || new Date().getFullYear();
  const selMonthNum = Math.max(1, Math.min(12, Number(selMonthStr) || 1));

  const handleChangeMonthSelect = (year: number, monthNum: number) => {
    const nextKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    setTargetMonthKey(nextKey);
    setNewLabel(formatMonthKeySlashLabel(nextKey));
  };

  const handleSave = () => {
    const inferredFromLabel = inferMonthKeyFromLabel(newLabel);
    const finalMonthKey = inferredFromLabel || targetMonthKey || selectedMonthKey;
    const label = newLabel.trim() || formatMonthKeySlashLabel(finalMonthKey);

    onSaveCurrentMonth(label, newNotes.trim(), finalMonthKey);
    setIsFormOpen(false);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#14B8A6', '#84A98C', '#D97757'],
    });
  };

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 dark:border-white/[0.07] rounded-3xl p-4 sm:p-6 shadow-cozy">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 dark:border-maldives-300/25 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-maldives-600 text-xl">
              calendar_month
            </span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-espresso-900">
              Histórico & Fechamentos Mensais
            </h2>
            <p className="text-xs text-espresso-600">
              Os cálculos de cada mês já são salvos automaticamente no Calendário. Aqui você também pode guardar fechamentos oficiais ou restaurá-los diretamente para a competência correspondente.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setTargetMonthKey(selectedMonthKey);
            setNewLabel(formatMonthKeySlashLabel(selectedMonthKey));
            setNewNotes(currentMonthNotes || '');
          }}
          className="px-4 py-2 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">
            bookmark_add
          </span>
          <span>
            Salvar {formatMonthKeySlashLabel(selectedMonthKey)} no Histórico
          </span>
        </button>
      </div>

      {isFormOpen && (
        <div className="mt-4 p-4 rounded-2xl bg-oat-100 dark:bg-oat-200/50 border border-maldives-300 dark:border-maldives-300/35 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-maldives-800 uppercase tracking-wider">
              Registrar Fechamento de {formatMonthKeyLabel(targetMonthKey)}
            </span>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-espresso-500 hover:text-espresso-900 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-espresso-700 block mb-1">
                Competência do Calendário
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={selMonthNum}
                  onChange={(e) =>
                    handleChangeMonthSelect(selYear, Number(e.target.value))
                  }
                  className="bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-2.5 py-2 text-xs font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                >
                  {MONTH_NAMES_FULL.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={2020}
                  max={2100}
                  value={selYear}
                  onChange={(e) =>
                    handleChangeMonthSelect(
                      Number(e.target.value) || new Date().getFullYear(),
                      selMonthNum
                    )
                  }
                  className="bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-2.5 py-2 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-espresso-700 block mb-1">
                Título / Rótulo do Fechamento
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Novembro / 2026"
                className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-espresso-700 block mb-1">
                Notas do Mês (Opcional)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ex: 13º salário investido, meta batida..."
                className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl px-3.5 py-2 text-sm text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Salvar no Caderno
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        {history.length === 0 ? (
          <div className="p-10 text-center bg-oat-100/60 dark:bg-oat-200/35 rounded-2xl border border-dashed border-oat-300 dark:border-white/[0.1]">
            <span className="material-symbols-outlined text-espresso-400 text-4xl mb-2">
              history_edu
            </span>
            <p className="text-espresso-700 text-sm font-bold">
              Nenhum fechamento mensal salvo ainda.
            </p>
            <p className="text-espresso-500 text-xs mt-1">
              Seus cálculos mensais já ficam salvos automaticamente no Calendário de Meses no topo da tela. Use o botão acima se quiser criar um marco de fechamento adicional.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item) => {
              const resolvedMonthKey =
                item.monthKey ||
                inferMonthKeyFromLabel(item.monthLabel, item.dateCreated) ||
                selectedMonthKey;
              const isCurrentCalendarMonth =
                resolvedMonthKey === selectedMonthKey;

              const income =
                item.profile.monthlyIncome + item.profile.additionalIncome;
              const catTotals: Record<ExpenseCategory, number> = {
                essencial: 0,
                estilo: 0,
                investimento: 0,
              };
              item.expenses.forEach((e) => {
                catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
              });

              const totalExpenses =
                catTotals.essencial + catTotals.estilo + catTotals.investimento;
              const aportePercent =
                income > 0 ? (catTotals.investimento / income) * 100 : 0;

              return (
                <motion.div
                  key={item.id}
                  whileHover={{ y: -3 }}
                  className={`bg-oat-100/80 border-2 rounded-2xl p-4 flex flex-col justify-between transition shadow-sm ${
                    isCurrentCalendarMonth
                      ? 'border-maldives-500 bg-maldives-50/40'
                      : 'border-oat-300 hover:border-maldives-400'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-display font-bold text-espresso-900">
                            {item.monthLabel}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-oat-200 text-espresso-700 border border-oat-300">
                            {formatMonthKeyLabel(resolvedMonthKey)}
                          </span>
                        </div>
                        <span className="text-[10px] text-espresso-500 font-mono block mt-0.5">
                          Salvo em{' '}
                          {new Date(item.dateCreated).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300 shrink-0">
                        {formatPercent(aportePercent)} aportes
                      </span>
                    </div>

                    {item.notes && (
                      <p className="text-xs text-espresso-600 italic bg-oat-50 p-2.5 rounded-xl mt-2.5 border border-oat-200">
                        “{item.notes}”
                      </p>
                    )}

                    <div className="mt-3 space-y-1.5 text-xs text-espresso-700 font-mono">
                      <div className="flex justify-between">
                        <span className="font-sans text-espresso-500">Renda Total:</span>
                        <span className="font-bold text-espresso-900">
                          {formatCurrency(income)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-espresso-500">Essenciais:</span>
                        <span>{formatCurrency(catTotals.essencial)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-espresso-500">Estilo de Vida:</span>
                        <span>{formatCurrency(catTotals.estilo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-espresso-500">Investimentos:</span>
                        <span className="font-bold text-maldives-700">
                          {formatCurrency(catTotals.investimento)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-oat-300 pt-1.5">
                        <span className="font-sans text-espresso-600 font-semibold">
                          Total Alocado:
                        </span>
                        <span className="font-bold">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-oat-300 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onLoadSnapshot(item)}
                      className="px-3 py-1.5 rounded-xl bg-oat-50 hover:bg-maldives-50 text-xs font-bold text-maldives-700 border border-oat-300 hover:border-maldives-300 transition flex items-center gap-1 cursor-pointer"
                      title={`Abrir e restaurar na competência ${formatMonthKeyLabel(resolvedMonthKey)}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        file_open
                      </span>
                      <span>
                        Restaurar em {formatMonthKeySlashLabel(resolvedMonthKey)}
                      </span>
                    </button>

                    <button
                      onClick={() => onDeleteSnapshot(item.id)}
                      className="text-espresso-400 hover:text-terracotta-600 p-1.5 rounded-xl hover:bg-terracotta-50 transition cursor-pointer"
                      title="Excluir mês do histórico"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
