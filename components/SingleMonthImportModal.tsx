import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarvitBackupData, MonthDataRecord, MonthSnapshot } from '../types';
import { formatCurrency } from '../utils/formatters';
import { formatMonthKeyLabel, formatMonthKeySlashLabel, inferMonthKeyFromLabel } from './MonthCalendarBar';

interface SingleMonthImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupPayload: MarvitBackupData | null;
  onImportSingleMonth: (monthKey: string, monthData: MonthDataRecord, snapshot?: MonthSnapshot) => void;
  onImportFullBackup: (payload: MarvitBackupData) => void;
}

export const SingleMonthImportModal: React.FC<SingleMonthImportModalProps> = ({
  isOpen,
  onClose,
  backupPayload,
  onImportSingleMonth,
  onImportFullBackup,
}) => {
  if (!isOpen || !backupPayload) return null;

  // Extrair todos os meses únicos disponíveis no arquivo
  const availableMonths = (() => {
    const map = new Map<
      string,
      {
        monthKey: string;
        label: string;
        slashLabel: string;
        record: MonthDataRecord;
        snapshot?: MonthSnapshot;
        totalExpenses: number;
        totalIncome: number;
        expenseCount: number;
      }
    >();

    // 1. A partir de monthsData do arquivo
    if (backupPayload.monthsData) {
      for (const [mKey, rec] of Object.entries(backupPayload.monthsData)) {
        if (!rec || !rec.expenses) continue;
        const totalExp = rec.expenses.reduce((acc, e) => acc + e.amount, 0);
        const income = (rec.profile?.monthlyIncome || 0) + (rec.profile?.additionalIncome || 0);
        map.set(mKey, {
          monthKey: mKey,
          label: formatMonthKeyLabel(mKey),
          slashLabel: formatMonthKeySlashLabel(mKey),
          record: rec,
          totalExpenses: totalExp,
          totalIncome: income,
          expenseCount: rec.expenses.length,
        });
      }
    }

    // 2. A partir de history do arquivo
    if (backupPayload.history) {
      for (const snap of backupPayload.history) {
        const mKey =
          snap.monthKey ||
          inferMonthKeyFromLabel(snap.monthLabel, snap.dateCreated) ||
          '';
        if (!mKey) continue;
        const totalExp = (snap.expenses || []).reduce((acc, e) => acc + e.amount, 0);
        const income = (snap.profile?.monthlyIncome || 0) + (snap.profile?.additionalIncome || 0);

        const existing = map.get(mKey);
        if (existing) {
          existing.snapshot = snap;
        } else {
          map.set(mKey, {
            monthKey: mKey,
            label: formatMonthKeyLabel(mKey),
            slashLabel: formatMonthKeySlashLabel(mKey),
            record: {
              monthKey: mKey,
              updatedAt: snap.dateCreated || new Date().toISOString(),
              profile: { ...snap.profile },
              customGoals: { ...snap.customGoals },
              expenses: snap.expenses || [],
              notes: snap.notes,
            },
            snapshot: snap,
            totalExpenses: totalExp,
            totalIncome: income,
            expenseCount: (snap.expenses || []).length,
          });
        }
      }
    }

    // 3. Se ainda não houver meses, adiciona o mês raiz do arquivo
    if (map.size === 0 && backupPayload.profile && backupPayload.expenses) {
      const topKey = backupPayload.selectedMonthKey || new Date().toISOString().slice(0, 7);
      const totalExp = backupPayload.expenses.reduce((acc, e) => acc + e.amount, 0);
      const income = (backupPayload.profile.monthlyIncome || 0) + (backupPayload.profile.additionalIncome || 0);
      map.set(topKey, {
        monthKey: topKey,
        label: formatMonthKeyLabel(topKey),
        slashLabel: formatMonthKeySlashLabel(topKey),
        record: {
          monthKey: topKey,
          updatedAt: backupPayload.exportedAt || new Date().toISOString(),
          profile: { ...backupPayload.profile },
          customGoals: { ...backupPayload.customGoals },
          expenses: backupPayload.expenses,
        },
        totalExpenses: totalExp,
        totalIncome: income,
        expenseCount: backupPayload.expenses.length,
      });
    }

    return Array.from(map.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  })();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-espresso-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-oat-50 border border-oat-300 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-cozy-lg flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-oat-200">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-maldives-600 text-xl">
                  file_upload
                </span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-display font-bold text-espresso-900">
                  Importar Arquivo de Backup
                </h3>
                <p className="text-xs text-espresso-600">
                  Escolha se deseja importar apenas um mês específico ou restaurar o arquivo completo.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-xl text-espresso-400 hover:text-espresso-700 hover:bg-oat-100 transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Destaque de Segurança */}
          <div className="mt-3 p-3 bg-maldives-50/70 border border-maldives-200 rounded-2xl text-xs text-espresso-700 flex items-start gap-2">
            <span className="material-symbols-outlined text-maldives-700 text-lg shrink-0 mt-0.5">
              shield
            </span>
            <p>
              <span className="font-bold text-maldives-900">Importação Isolada:</span> Ao importar apenas um mês, os dados dos seus outros meses (como Novembro) permanecerão <strong>100% intactos e inalterados</strong>.
            </p>
          </div>

          {/* Lista de Meses Encontrados no Arquivo */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1 space-y-2.5">
            <p className="text-xs font-bold text-espresso-800 uppercase tracking-wider">
              Meses Encontrados no Arquivo ({availableMonths.length}):
            </p>

            {availableMonths.map((item) => (
              <div
                key={item.monthKey}
                className="p-3.5 bg-oat-100/80 rounded-2xl border border-oat-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-maldives-300 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-display text-espresso-900">
                      {item.slashLabel}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-oat-200 text-espresso-700 border border-oat-300">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-espresso-600 font-mono mt-1">
                    <span>Despesas: <strong>{formatCurrency(item.totalExpenses)}</strong></span>
                    <span>•</span>
                    <span>{item.expenseCount} {item.expenseCount === 1 ? 'item' : 'itens'}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onImportSingleMonth(item.monthKey, item.record, item.snapshot);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    download_for_offline
                  </span>
                  <span>Importar Apenas Este Mês</span>
                </button>
              </div>
            ))}
          </div>

          {/* Ações Inferiores (Opção de Restaurar Tudo ou Cancelar) */}
          <div className="mt-4 pt-3 border-t border-oat-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <button
              onClick={() => {
                onImportFullBackup(backupPayload);
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-700 font-bold text-xs border border-oat-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                settings_backup_restore
              </span>
              <span>Restaurar Todos os Meses (Completo)</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-espresso-500 hover:text-espresso-800 transition cursor-pointer text-center"
            >
              Cancelar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

