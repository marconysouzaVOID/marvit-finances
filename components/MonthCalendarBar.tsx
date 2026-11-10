import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MonthDataRecord } from '../types';
import { formatCurrency } from '../utils/formatters';

export const MONTH_NAMES_FULL = [
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

export const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function formatMonthKeyLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const monthIdx = Math.max(0, Math.min(11, (Number(mStr) || 1) - 1));
  return `${MONTH_NAMES_FULL[monthIdx]} de ${year}`;
}

export function formatMonthKeySlashLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const monthIdx = Math.max(0, Math.min(11, (Number(mStr) || 1) - 1));
  return `${MONTH_NAMES_FULL[monthIdx]} / ${year}`;
}

/**
 * Infere a chave de competência "YYYY-MM" a partir de um rótulo de histórico
 * (ex: "Novembro / 2026", "Outubro de 2026", "Set/2026", "11/2026", "2026-11").
 */
export function inferMonthKeyFromLabel(
  label?: string,
  fallbackIsoDate?: string
): string | null {
  const raw = (label || '').trim();
  const fallbackYear = fallbackIsoDate
    ? new Date(fallbackIsoDate).getFullYear() || new Date().getFullYear()
    : new Date().getFullYear();

  if (raw) {
    // 1. Formato direto YYYY-MM
    const isoMatch = raw.match(/\b(20\d{2})-(0[1-9]|1[0-2])\b/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}`;
    }

    // 2. Formato numérico MM/YYYY
    const slashNumMatch = raw.match(/\b(0?[1-9]|1[0-2])\s*[/.-]\s*(20\d{2})\b/);
    if (slashNumMatch) {
      return `${slashNumMatch[2]}-${String(Number(slashNumMatch[1])).padStart(2, '0')}`;
    }

    // 3. Nome do mês em português (completo ou abreviado) + ano opcional
    const normalized = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const monthPatterns: [RegExp, number][] = [
      [/\b(janeiro|jan)\b/, 1],
      [/\b(fevereiro|fev)\b/, 2],
      [/\b(marco|mar)\b/, 3],
      [/\b(abril|abr)\b/, 4],
      [/\b(maio|mai)\b/, 5],
      [/\b(junho|jun)\b/, 6],
      [/\b(julho|jul)\b/, 7],
      [/\b(agosto|ago)\b/, 8],
      [/\b(setembro|set)\b/, 9],
      [/\b(outubro|out)\b/, 10],
      [/\b(novembro|nov)\b/, 11],
      [/\b(dezembro|dez)\b/, 12],
    ];

    for (const [regex, monthNum] of monthPatterns) {
      if (regex.test(normalized)) {
        const yearMatch = normalized.match(/\b(20\d{2})\b/);
        const year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
        return `${year}-${String(monthNum).padStart(2, '0')}`;
      }
    }
  }

  if (fallbackIsoDate) {
    const d = new Date(fallbackIsoDate);
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  return null;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const monthIdx = (Number(mStr) || 1) - 1;
  const date = new Date(year, monthIdx + deltaMonths, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface MonthCalendarBarProps {
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
  monthsData: Record<string, MonthDataRecord>;
  currentMonthNotes: string;
  onChangeMonthNotes: (notes: string) => void;
  onCopyFromPreviousMonth: () => void;
  linkedGoalsMonthlyTotal: number;
}

export const MonthCalendarBar: React.FC<MonthCalendarBarProps> = ({
  selectedMonthKey,
  onSelectMonth,
  monthsData,
  currentMonthNotes,
  onChangeMonthNotes,
  onCopyFromPreviousMonth,
  linkedGoalsMonthlyTotal,
}) => {
  const [isGridExpanded, setIsGridExpanded] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const currentSystemMonthKey = getCurrentMonthKey();

  const [selectedYearStr, selectedMonthStr] = selectedMonthKey.split('-');
  const selectedYear = Number(selectedYearStr) || new Date().getFullYear();
  const selectedMonthIdx = Math.max(0, Math.min(11, (Number(selectedMonthStr) || 1) - 1));

  const [viewYear, setViewYear] = useState<number>(selectedYear);

  // Sincroniza o ano visível do calendário sempre que o mês selecionado mudar (ex: ao restaurar do Histórico)
  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear]);

  const handleSelectYearAndMonth = (year: number, monthIndex0: number) => {
    const key = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
    onSelectMonth(key);
  };

  const handleStepMonth = (delta: number) => {
    const nextKey = shiftMonthKey(selectedMonthKey, delta);
    const [ny] = nextKey.split('-');
    setViewYear(Number(ny));
    onSelectMonth(nextKey);
  };

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 dark:border-white/[0.07] rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 md:p-5 shadow-cozy transition-colors overflow-hidden">
      {/* Linha Compacta Principal: Mês Ativo + Ações */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 md:flex-initial min-w-0">
          <button
            type="button"
            onClick={() => handleStepMonth(-1)}
            className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-oat-100 dark:bg-oat-200/80 hover:bg-maldives-50 border border-oat-300 dark:border-white/[0.07] flex items-center justify-center text-espresso-800 hover:text-maldives-700 transition cursor-pointer"
            title="Mês anterior"
          >
            <span className="material-symbols-outlined text-[19px]">
              chevron_left
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen((v) => !v)}
            className="flex items-center justify-center md:justify-start gap-2 px-3 py-1.5 rounded-xl sm:rounded-2xl bg-maldives-50/80 border border-maldives-200/90 dark:border-maldives-300/25 flex-1 md:flex-initial min-w-0 cursor-pointer md:cursor-default"
            title="Selecionar mês ou abrir notas"
          >
            <span className="material-symbols-outlined text-maldives-600 text-[17px] sm:text-xl shrink-0">
              calendar_month
            </span>
            <div className="min-w-0 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-maldives-700 hidden md:block leading-none truncate">
                Competência em Edição
              </span>
              <span className="text-[11px] sm:text-base font-display font-extrabold text-espresso-900 block whitespace-nowrap">
                {MONTH_NAMES_FULL[selectedMonthIdx]}/{selectedYear}
              </span>
            </div>
            <span className="material-symbols-outlined text-[17px] text-maldives-700 md:hidden shrink-0">
              {isMobileDrawerOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleStepMonth(1)}
            className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-oat-100 dark:bg-oat-200/80 hover:bg-maldives-50 border border-oat-300 dark:border-white/[0.07] flex items-center justify-center text-espresso-800 hover:text-maldives-700 transition cursor-pointer"
            title="Próximo mês"
          >
            <span className="material-symbols-outlined text-[19px]">
              chevron_right
            </span>
          </button>

          {selectedMonthKey !== currentSystemMonthKey && (
            <button
              type="button"
              onClick={() => {
                const [cy] = currentSystemMonthKey.split('-');
                setViewYear(Number(cy));
                onSelectMonth(currentSystemMonthKey);
              }}
              className="hidden sm:inline-flex px-2.5 py-1.5 rounded-xl bg-oat-100 dark:bg-oat-200/80 hover:bg-oat-200 text-espresso-700 border border-oat-300 dark:border-white/[0.07] text-xs font-bold transition cursor-pointer shrink-0"
              title="Voltar para o mês atual"
            >
              Mês Atual
            </button>
          )}
        </div>

        {/* Botões Rápidos Compactos no Mobile */}
        <div className="flex items-center gap-1 md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen((v) => !v)}
            className={`relative w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
              isMobileDrawerOpen
                ? 'bg-maldives-500 text-white border-maldives-600/40'
                : 'bg-oat-100 dark:bg-oat-200/75 text-espresso-700 border-oat-300 dark:border-white/[0.07]'
            }`}
            title="Abrir meses e nota do mês"
          >
            <span className="material-symbols-outlined text-[17px]">tune</span>
            {currentMonthNotes && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-terracotta-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsGridExpanded((v) => !v)}
            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
              isGridExpanded
                ? 'bg-maldives-500 text-white border-maldives-600/40'
                : 'bg-oat-100 dark:bg-oat-200/75 text-espresso-700 border-oat-300 dark:border-white/[0.07]'
            }`}
            title="Visão Anual"
          >
            <span className="material-symbols-outlined text-[17px]">date_range</span>
          </button>
        </div>

        {/* Nota Rápida + Ações no Desktop */}
        <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
          <div className="relative flex-1 max-w-xs min-w-0">
            <span className="material-symbols-outlined text-espresso-400 text-[16px] absolute left-3 top-2">
              sticky_note_2
            </span>
            <input
              type="text"
              value={currentMonthNotes}
              onChange={(e) => onChangeMonthNotes(e.target.value)}
              placeholder={`Nota de ${MONTH_NAMES_SHORT[selectedMonthIdx]}/${selectedYear}...`}
              className="w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
            />
          </div>

          <button
            type="button"
            onClick={onCopyFromPreviousMonth}
            className="px-3 py-1.5 rounded-xl bg-oat-100 dark:bg-oat-200/75 hover:bg-oat-200 text-espresso-800 border border-oat-300 dark:border-white/[0.07] text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Copiar renda e despesas do mês anterior"
          >
            <span className="material-symbols-outlined text-[16px] text-sage-600 shrink-0">
              content_copy
            </span>
            <span>Copiar Anterior</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGridExpanded(!isGridExpanded)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition cursor-pointer ${
              isGridExpanded
                ? 'bg-maldives-500 text-white border-maldives-600/40 shadow-xs'
                : 'bg-oat-100 dark:bg-oat-200/75 text-espresso-800 border-oat-300 dark:border-white/[0.07] hover:border-maldives-400/50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">
              {isGridExpanded ? 'expand_less' : 'date_range'}
            </span>
            <span>{isGridExpanded ? 'Fechar Visão' : 'Calendário Anual'}</span>
          </button>
        </div>
      </div>

      {/* Painel Retrátil no Mobile + Sempre Visível no Desktop: Meses, Nota e Copiar */}
      <div className={`${isMobileDrawerOpen ? 'block' : 'hidden'} md:block mt-2.5 pt-2.5 border-t border-oat-200 dark:border-white/[0.06] space-y-2.5`}>
        {/* Controles extras só necessários na gaveta mobile */}
        <div className="flex flex-col gap-2 md:hidden">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <span className="material-symbols-outlined text-espresso-400 text-[15px] absolute left-2.5 top-2">
                sticky_note_2
              </span>
              <input
                type="text"
                value={currentMonthNotes}
                onChange={(e) => onChangeMonthNotes(e.target.value)}
                placeholder={`Nota de ${MONTH_NAMES_SHORT[selectedMonthIdx]}/${selectedYear}...`}
                className="compact-select w-full bg-surface-input border border-oat-300 dark:border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
              />
            </div>

            <button
              type="button"
              onClick={onCopyFromPreviousMonth}
              className="px-2.5 py-1.5 rounded-xl bg-oat-100 dark:bg-oat-200/75 text-espresso-800 border border-oat-300 dark:border-white/[0.07] text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              title="Copiar mês anterior"
            >
              <span className="material-symbols-outlined text-[15px] text-sage-600">
                content_copy
              </span>
              <span>Copiar ant.</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center justify-between sm:justify-start gap-1 sm:pr-2 sm:border-r border-oat-200 dark:border-white/[0.06] shrink-0">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="p-1 rounded-lg bg-oat-100 dark:bg-oat-200/70 sm:bg-transparent sm:dark:bg-transparent hover:bg-oat-200 text-espresso-600 hover:text-espresso-900 cursor-pointer flex items-center justify-center"
                title="Ano anterior"
              >
                <span className="material-symbols-outlined text-[16px]">
                  keyboard_double_arrow_left
                </span>
              </button>
              <span className="text-xs font-mono font-extrabold text-espresso-900 px-1.5">
                {viewYear}
              </span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="p-1 rounded-lg bg-oat-100 dark:bg-oat-200/70 sm:bg-transparent sm:dark:bg-transparent hover:bg-oat-200 text-espresso-600 hover:text-espresso-900 cursor-pointer flex items-center justify-center"
                title="Próximo ano"
              >
                <span className="material-symbols-outlined text-[16px]">
                  keyboard_double_arrow_right
                </span>
              </button>
            </div>

            {selectedMonthKey !== currentSystemMonthKey && (
              <button
                type="button"
                onClick={() => {
                  const [cy] = currentSystemMonthKey.split('-');
                  setViewYear(Number(cy));
                  onSelectMonth(currentSystemMonthKey);
                  setIsMobileDrawerOpen(false);
                }}
                className="sm:hidden px-2 py-0.5 rounded-lg bg-maldives-50 text-maldives-700 border border-maldives-200 text-[10px] font-bold cursor-pointer"
              >
                Mês atual
              </button>
            )}
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 w-full flex-1">
            {MONTH_NAMES_SHORT.map((shortName, idx) => {
              const mKey = `${viewYear}-${String(idx + 1).padStart(2, '0')}`;
              const isSelected = mKey === selectedMonthKey;
              const isCurrentNow = mKey === currentSystemMonthKey;
              const hasSavedData = Boolean(monthsData[mKey]);

              return (
                <button
                  key={mKey}
                  type="button"
                  onClick={() => {
                    handleSelectYearAndMonth(viewYear, idx);
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`relative py-1.5 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer border min-w-0 ${
                    isSelected
                      ? 'bg-maldives-500 text-white border-maldives-600/40 shadow-xs'
                      : isCurrentNow
                      ? 'bg-maldives-50 text-maldives-800 border-maldives-300/70 hover:bg-maldives-100'
                      : 'bg-oat-100/70 dark:bg-oat-200/50 text-espresso-700 border-oat-200 dark:border-white/[0.06] hover:border-maldives-300/60 hover:text-espresso-900'
                  }`}
                >
                  <span className="truncate">{shortName}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected
                        ? 'bg-white'
                        : hasSavedData
                        ? 'bg-maldives-500'
                        : 'bg-oat-300 dark:bg-white/[0.14]'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grade Expandida do Calendário Anual (Resumo dos 12 Meses) */}
      <AnimatePresence>
        {isGridExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-oat-200 dark:border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-espresso-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-maldives-600 text-[18px]">
                    calendar_view_month
                  </span>
                  <span>Visão Anual de {viewYear} • Clique em qualquer mês para editar</span>
                </h3>
              </div>

              <div className="flex overflow-x-auto snap-x snap-mandatory gap-2 pb-1.5 scrollbar-hide sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:gap-3 sm:pb-0 sm:overflow-visible [&>*]:shrink-0 [&>*]:w-[128px] sm:[&>*]:w-auto [&>*]:snap-start [&>*]:!p-2.5 sm:[&>*]:!p-3.5 [&_h4]:text-xs [&_p]:text-[10px]">
                {MONTH_NAMES_FULL.map((fullName, idx) => {
                  const mKey = `${viewYear}-${String(idx + 1).padStart(2, '0')}`;
                  const isSelected = mKey === selectedMonthKey;
                  const record = monthsData[mKey];

                  const income = record
                    ? record.profile.monthlyIncome + record.profile.additionalIncome
                    : 0;
                  const manualSpent = record
                    ? record.expenses.reduce((acc, e) => acc + e.amount, 0)
                    : 0;
                  const totalSpent = record
                    ? manualSpent + linkedGoalsMonthlyTotal
                    : 0;
                  const balance = income - totalSpent;

                  return (
                    <div
                      key={mKey}
                      onClick={() => {
                        handleSelectYearAndMonth(viewYear, idx);
                        setIsGridExpanded(false);
                      }}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-maldives-50/90 border-maldives-500/80 shadow-xs'
                          : record
                          ? 'bg-oat-100/80 dark:bg-oat-200/60 border-oat-300 dark:border-white/[0.07] hover:border-maldives-400/60'
                          : 'bg-oat-100/40 dark:bg-oat-100/40 border-dashed border-oat-300 dark:border-white/[0.08] hover:border-maldives-300/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-display font-bold text-espresso-900">
                          {fullName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isSelected
                              ? 'bg-maldives-500 text-white border-maldives-600/40'
                              : record
                              ? 'bg-sage-100 text-sage-600 border-sage-300/70 dark:border-sage-300/35'
                              : 'bg-oat-200 text-espresso-500 border-oat-300 dark:border-white/[0.07]'
                          }`}
                        >
                          {isSelected
                            ? 'Em edição'
                            : record
                            ? 'Preenchido'
                            : 'Vazio'}
                        </span>
                      </div>

                      {record ? (
                        <div className="mt-2.5 space-y-1 text-[11px] font-mono">
                          <div className="flex justify-between text-espresso-600">
                            <span className="font-sans">Renda:</span>
                            <span className="font-bold text-espresso-900">
                              {formatCurrency(income)}
                            </span>
                          </div>
                          <div className="flex justify-between text-espresso-600">
                            <span className="font-sans">Alocado:</span>
                            <span>{formatCurrency(totalSpent)}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-oat-200">
                            <span className="font-sans font-semibold text-espresso-700">
                              Saldo:
                            </span>
                            <span
                              className={`font-bold ${
                                balance >= 0
                                  ? 'text-maldives-700'
                                  : 'text-terracotta-600'
                              }`}
                            >
                              {formatCurrency(balance)}
                            </span>
                          </div>
                          {record.notes && (
                            <p className="text-[10px] font-sans italic text-espresso-500 truncate pt-0.5">
                              “{record.notes}”
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-espresso-500 mt-3">
                          Clique para abrir e preencher o orçamento de {fullName}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

