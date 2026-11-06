import React, { useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ExpenseCategory, MonthSnapshot } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface HistoryManagerProps {
  history: MonthSnapshot[];
  onSaveCurrentMonth: (label: string, notes?: string) => void;
  onLoadSnapshot: (snapshot: MonthSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

export const HistoryManager: React.FC<HistoryManagerProps> = ({
  history,
  onSaveCurrentMonth,
  onLoadSnapshot,
  onDeleteSnapshot,
}) => {
  const [newLabel, setNewLabel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const defaultMonthName = () => {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    const now = new Date();
    return `${months[now.getMonth()]} / ${now.getFullYear()}`;
  };

  const handleSave = () => {
    const label = newLabel.trim() || defaultMonthName();
    onSaveCurrentMonth(label, newNotes.trim());
    setNewLabel('');
    setNewNotes('');
    setIsFormOpen(false);
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#14B8A6', '#84A98C', '#D97757'],
    });
  };

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-5 sm:p-6 shadow-cozy">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center">
            <span className="material-symbols-outlined text-maldives-600 text-xl">
              calendar_month
            </span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-espresso-900">
              Histórico & Fechamentos Mensais
            </h2>
            <p className="text-xs text-espresso-600">
              Guarde uma fotografia de cada mês para comparar sua evolução patrimonial.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            if (!newLabel) setNewLabel(defaultMonthName());
          }}
          className="px-4 py-2 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">
            bookmark_add
          </span>
          <span>Salvar Mês Atual no Histórico</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="mt-4 p-4 rounded-2xl bg-oat-100 border-2 border-maldives-300 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-maldives-800 uppercase tracking-wider">
              Registrar Fechamento do Mês
            </span>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-espresso-500 hover:text-espresso-900 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-espresso-700 block mb-1">
                Mês de Referência
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Novembro / 2026"
                className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm text-espresso-900 focus:outline-none focus:border-maldives-500"
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
                placeholder="Ex: 13º salário investido, meta da cozinha batida..."
                className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm text-espresso-900 focus:outline-none focus:border-maldives-500"
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
          <div className="p-10 text-center bg-oat-100/60 rounded-2xl border-2 border-dashed border-oat-300">
            <span className="material-symbols-outlined text-espresso-400 text-4xl mb-2">
              history_edu
            </span>
            <p className="text-espresso-700 text-sm font-bold">
              Nenhum fechamento mensal salvo ainda.
            </p>
            <p className="text-espresso-500 text-xs mt-1">
              Clique em “Salvar Mês Atual no Histórico” para registrar sua linha do tempo financeira.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item) => {
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
                  className="bg-oat-100/80 border-2 border-oat-300 hover:border-maldives-400 rounded-2xl p-4 flex flex-col justify-between transition shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-display font-bold text-espresso-900">
                          {item.monthLabel}
                        </h3>
                        <span className="text-[10px] text-espresso-500 font-mono">
                          Salvo em{' '}
                          {new Date(item.dateCreated).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300">
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
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        file_open
                      </span>
                      <span>Restaurar p/ Tela</span>
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

