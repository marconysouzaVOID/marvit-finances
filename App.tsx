import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AUVP_GOALS,
  INITIAL_EXPENSES,
  INITIAL_GLOBAL_CARDS,
  INITIAL_LONG_TERM_GOALS,
} from './constants';
import {
  CustomGoalItem,
  ExpenseCategory,
  ExpenseItem,
  FinancialProfile,
  GlobalCreditCard,
  MarvitBackupData,
  MonthDataRecord,
  MonthSnapshot,
  VaultCredentials,
} from './types';
import { AdvicePanel } from './components/AdvicePanel';
import { CreditCardsManager } from './components/CreditCardsManager';
import { ExpenseManager } from './components/ExpenseManager';
import { FinancialOverview } from './components/FinancialOverview';
import { FreedomSimulator } from './components/FreedomSimulator';
import { GoalsManager } from './components/GoalsManager';
import { HistoryManager } from './components/HistoryManager';
import { IncomeCard } from './components/IncomeCard';
import { InteractiveAsset } from './components/InteractiveAsset';
import { InteractiveBrandTitle } from './components/InteractiveBrandTitle';
import { FinancialCharts } from './components/FinancialCharts';
import { CompoundInterestCalculator } from './components/CompoundInterestCalculator';
import { SingleMonthImportModal } from './components/SingleMonthImportModal';
import {
  formatMonthKeyLabel,
  formatMonthKeySlashLabel,
  getCurrentMonthKey,
  inferMonthKeyFromLabel,
  MonthCalendarBar,
  shiftMonthKey,
} from './components/MonthCalendarBar';
import { VaultAuthModal } from './components/VaultAuthModal';
import { generateReportImageSync } from './utils/exportCanvas';
import {
  canUseNativeMobileShare,
  isMobileOrTouchDevice,
  prepareBackupJsonFile,
  PreparedExportFile,
  prepareMarkdownReportFile,
  saveExportedFileWithPrompt,
} from './utils/sourceExporter';
import {
  DEFAULT_INITIAL_PIN,
  DEFAULT_VAULT_ID,
  hashPin,
  pullVaultFromCloud,
  pushVaultToCloud,
  saveLocalMirrorVault,
} from './utils/cloudSync';
import {
  hasRegisteredBiometrics,
  isBiometricsSupported,
  isRunningAsPwa,
  registerBiometricVault,
  unlockWithBiometrics,
} from './utils/biometricAuth';

export type ActiveTab =
  | 'budget'
  | 'cards'
  | 'goals'
  | 'freedom'
  | 'advice'
  | 'history';

const STORAGE_KEY = 'marvit_finances_state_v2';
const VAULT_SESSION_KEY = 'marvit_vault_session_v2';
const SESSION_UNLOCKED_KEY = 'marvit_pin_unlocked_session_v2';
const THEME_STORAGE_KEY = 'marvit_theme_mode';

const CARD_NAME_REGEX =
  /(cart[aã]o|nubank|nu\b|inter\b|ita[uú]|bradesco|santander|c6\b|xp\b|btg|picpay|neon|next|will|digio|fatura|cr[eé]dito|ultravioleta|black|platinum|infinite|mastercard|visa|elo|amex|sicredi|sicoob|caixa)/i;

const DEFAULT_PROFILE: FinancialProfile = {
  monthlyIncome: 7500,
  additionalIncome: 500,
  desiredEmergencyMonths: 6,
  expectedAnnualReturnRate: 10.5,
};

const DEFAULT_CUSTOM_GOALS: Record<ExpenseCategory, number> = {
  essencial: 50,
  estilo: 30,
  investimento: 20,
};

function normalizeLifestyleExpenses(items: ExpenseItem[]): ExpenseItem[] {
  return items.map((item) => {
    if (item.category !== 'estilo' || item.linkedGoalId) return item;
    if (item.subcategory) return item;
    const isLikelyCard = CARD_NAME_REGEX.test(item.name);
    return {
      ...item,
      subcategory: isLikelyCard ? 'cartao' : 'direto',
      cardTransactions: isLikelyCard ? item.cardTransactions || [] : undefined,
    };
  });
}

/**
 * Verifica se o registro de um mês ainda está exatamente igual ao template padrão inicial
 * (sem edições do usuário), para permitir que cálculos reais ou fechamentos do Histórico tenham prioridade.
 */
function isUntouchedDefaultMonth(rec?: {
  profile?: FinancialProfile;
  expenses?: ExpenseItem[];
  notes?: string;
}): boolean {
  if (!rec || !rec.profile || !rec.expenses) return true;
  if (rec.notes && rec.notes.trim().length > 0) return false;
  if (
    rec.profile.monthlyIncome !== DEFAULT_PROFILE.monthlyIncome ||
    rec.profile.additionalIncome !== DEFAULT_PROFILE.additionalIncome ||
    rec.profile.desiredEmergencyMonths !==
      DEFAULT_PROFILE.desiredEmergencyMonths ||
    rec.profile.expectedAnnualReturnRate !==
      DEFAULT_PROFILE.expectedAnnualReturnRate
  ) {
    return false;
  }

  const manual = rec.expenses.filter((e) => !e.linkedGoalId);
  if (manual.length !== INITIAL_EXPENSES.length) return false;

  for (let i = 0; i < INITIAL_EXPENSES.length; i++) {
    const initExp = INITIAL_EXPENSES[i];
    const curExp = manual[i];
    if (
      !curExp ||
      curExp.id !== initExp.id ||
      curExp.name !== initExp.name ||
      curExp.amount !== initExp.amount ||
      curExp.category !== initExp.category ||
      (curExp.cardTransactions && curExp.cardTransactions.length > 0)
    ) {
      return false;
    }
  }
  return true;
}

interface HydratedAppState {
  selectedMonthKey: string;
  monthsData: Record<string, MonthDataRecord>;
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  currentMonthNotes: string;
  longTermGoals: CustomGoalItem[];
  globalCards: GlobalCreditCard[];
  history: MonthSnapshot[];
  exportedAt: string;
  restoredAt?: string;
  excludedGoalIds?: string[];
  goalContributionOverrides?: Record<string, number>;
}

function extractGlobalCards(
  rawGlobalCards?: GlobalCreditCard[],
  monthsMap?: Record<string, MonthDataRecord>,
  expensesList?: ExpenseItem[]
): GlobalCreditCard[] {
  if (rawGlobalCards && rawGlobalCards.length > 0) {
    return rawGlobalCards;
  }

  const cardMap = new Map<string, GlobalCreditCard>();

  const scanItems = (items?: ExpenseItem[]) => {
    if (!items) return;
    for (const item of items) {
      if (
        item.category === 'estilo' &&
        item.subcategory === 'cartao' &&
        !item.linkedGoalId
      ) {
        const id = item.globalCardId || item.id;
        if (!cardMap.has(id)) {
          cardMap.set(id, {
            id,
            name: item.name,
            cardLimit: item.cardLimit || 1500,
            cardDueDay: item.cardDueDay || 10,
            cardClosingDay: item.cardClosingDay || (item.name.toLowerCase().includes('nubank') ? 25 : 5),
          });
        }
      }
    }
  };

  scanItems(expensesList);
  if (monthsMap) {
    for (const rec of Object.values(monthsMap)) {
      scanItems(rec.expenses);
    }
  }

  if (cardMap.size > 0) {
    return Array.from(cardMap.values());
  }

  return INITIAL_GLOBAL_CARDS;
}

function normalizeExpensesWithGlobalCards(
  items: ExpenseItem[],
  globalCards: GlobalCreditCard[]
): ExpenseItem[] {
  const normalized = normalizeLifestyleExpenses(items);
  const activeGlobalCards = (globalCards || []).filter((g) => !g.isArchived);

  const result: ExpenseItem[] = [];
  const matchedGlobalCardIds = new Set<string>();

  for (const item of normalized) {
    if (
      item.category === 'estilo' &&
      item.subcategory === 'cartao' &&
      !item.linkedGoalId
    ) {
      const matchingGlobalCard = activeGlobalCards.find(
        (g) =>
          g.id === item.globalCardId ||
          g.id === item.id ||
          g.name.toLowerCase() === item.name.toLowerCase()
      );

      if (matchingGlobalCard) {
        matchedGlobalCardIds.add(matchingGlobalCard.id);
        result.push({
          ...item,
          id: matchingGlobalCard.id,
          globalCardId: matchingGlobalCard.id,
          name: matchingGlobalCard.name,
          cardLimit: matchingGlobalCard.cardLimit ?? item.cardLimit,
          cardDueDay: matchingGlobalCard.cardDueDay ?? item.cardDueDay,
          cardClosingDay: matchingGlobalCard.cardClosingDay ?? item.cardClosingDay,
        });
        continue;
      }
    }
    result.push(item);
  }

  // Injetar cartões globais ativos que ainda não foram lançados neste mês
  for (const gCard of activeGlobalCards) {
    if (!matchedGlobalCardIds.has(gCard.id)) {
      result.push({
        id: gCard.id,
        globalCardId: gCard.id,
        name: gCard.name,
        amount: 0,
        category: 'estilo',
        subcategory: 'cartao',
        cardLimit: gCard.cardLimit,
        cardDueDay: gCard.cardDueDay,
        cardClosingDay: gCard.cardClosingDay,
        cardTransactions: [],
        isCustom: true,
      });
    }
  }

  return result;
}

function hydratePayloadState(
  raw?: Partial<MarvitBackupData> | null,
  preferredMonthKey?: string
): HydratedAppState {
  const sysMonthKey = getCurrentMonthKey();
  const normalizedHistory: MonthSnapshot[] = (raw?.history || []).map((snap) => {
    const resolvedKey =
      snap.monthKey ||
      inferMonthKeyFromLabel(snap.monthLabel, snap.dateCreated) ||
      sysMonthKey;
    return {
      ...snap,
      monthKey: resolvedKey,
      expenses: normalizeLifestyleExpenses(
        (snap.expenses || []).filter((e) => !e.linkedGoalId)
      ),
    };
  });

  const monthsMap: Record<string, MonthDataRecord> = {};

  if (raw?.monthsData) {
    for (const [mKey, rec] of Object.entries(raw.monthsData)) {
      if (!rec || !rec.profile || !rec.expenses) continue;
      monthsMap[mKey] = {
        ...rec,
        monthKey: mKey,
        updatedAt: rec.updatedAt || raw.exportedAt || new Date().toISOString(),
        profile: { ...rec.profile },
        customGoals: { ...(rec.customGoals || DEFAULT_CUSTOM_GOALS) },
        expenses: normalizeLifestyleExpenses(
          rec.expenses.filter((e) => !e.linkedGoalId)
        ),
      };
    }
  }

  const candidateSelectedKey =
    preferredMonthKey || raw?.selectedMonthKey || sysMonthKey;

  if (raw?.profile && raw?.expenses) {
    const topKey = raw.selectedMonthKey || sysMonthKey;
    const topRec: MonthDataRecord = {
      monthKey: topKey,
      updatedAt: raw.exportedAt || new Date().toISOString(),
      profile: { ...raw.profile },
      customGoals: { ...(raw.customGoals || DEFAULT_CUSTOM_GOALS) },
      expenses: normalizeLifestyleExpenses(
        raw.expenses.filter((e) => !e.linkedGoalId)
      ),
    };

    const existingTop = monthsMap[topKey];
    if (
      !existingTop ||
      (isUntouchedDefaultMonth(existingTop) && !isUntouchedDefaultMonth(topRec))
    ) {
      monthsMap[topKey] = topRec;
    }
  }

  // Hidrata automaticamente monthsData a partir do Histórico (do mais antigo para o mais recente)
  const chronologicalHistory = [...normalizedHistory].reverse();
  for (const snap of chronologicalHistory) {
    const mKey =
      snap.monthKey ||
      inferMonthKeyFromLabel(snap.monthLabel, snap.dateCreated) ||
      sysMonthKey;
    const snapRec: MonthDataRecord = {
      monthKey: mKey,
      updatedAt: snap.dateCreated || raw?.exportedAt || new Date().toISOString(),
      profile: { ...snap.profile },
      customGoals: { ...(snap.customGoals || DEFAULT_CUSTOM_GOALS) },
      expenses: normalizeLifestyleExpenses(
        snap.expenses.filter((e) => !e.linkedGoalId)
      ),
      notes: snap.notes,
    };

    const existing = monthsMap[mKey];
    const snapTime = new Date(snapRec.updatedAt || 0).getTime() || 0;
    const existingTime = new Date(existing?.updatedAt || 0).getTime() || 0;
    if (
      !existing ||
      (isUntouchedDefaultMonth(existing) && !isUntouchedDefaultMonth(snapRec)) ||
      (!isUntouchedDefaultMonth(snapRec) && snapTime > existingTime)
    ) {
      monthsMap[mKey] = snapRec;
    }
  }

  // Se o mês inicial selecionado ainda estiver com o template padrão intocado, mas o usuário já tiver
  // fechamentos reais no Histórico, seleciona o mês do fechamento mais recente sem contaminar outros meses!
  let finalSelectedKey = candidateSelectedKey;
  if (
    (!monthsMap[finalSelectedKey] ||
      isUntouchedDefaultMonth(monthsMap[finalSelectedKey])) &&
    normalizedHistory.length > 0
  ) {
    const latestSnap = normalizedHistory[0];
    const latestSnapKey =
      latestSnap.monthKey ||
      inferMonthKeyFromLabel(latestSnap.monthLabel, latestSnap.dateCreated) ||
      finalSelectedKey;

    if (!preferredMonthKey && !raw?.selectedMonthKey && monthsMap[latestSnapKey]) {
      finalSelectedKey = latestSnapKey;
    }
  }

  const activeRecord = monthsMap[finalSelectedKey] || {
    monthKey: finalSelectedKey,
    updatedAt: raw?.exportedAt || new Date().toISOString(),
    profile: { ...(raw?.profile || DEFAULT_PROFILE) },
    customGoals: { ...(raw?.customGoals || DEFAULT_CUSTOM_GOALS) },
    expenses: normalizeLifestyleExpenses(
      (raw?.expenses || INITIAL_EXPENSES).filter((e) => !e.linkedGoalId)
    ),
    notes: undefined,
  };

  monthsMap[finalSelectedKey] = activeRecord;

  const resolvedGlobalCards = extractGlobalCards(
    raw?.globalCards,
    monthsMap,
    raw?.expenses
  );

  return {
    selectedMonthKey: finalSelectedKey,
    monthsData: monthsMap,
    profile: activeRecord.profile,
    customGoals: activeRecord.customGoals,
    expenses: normalizeExpensesWithGlobalCards(activeRecord.expenses, resolvedGlobalCards),
    currentMonthNotes: activeRecord.notes || '',
    longTermGoals: raw?.customLongTermGoals || INITIAL_LONG_TERM_GOALS,
    globalCards: resolvedGlobalCards,
    history: normalizedHistory,
    exportedAt: raw?.exportedAt || new Date().toISOString(),
    restoredAt: raw?.restoredAt,
    excludedGoalIds: activeRecord.excludedGoalIds || [],
    goalContributionOverrides: activeRecord.goalContributionOverrides || {},
  };
}

function getTimeMs(iso?: string): number {
  return new Date(iso || 0).getTime() || 0;
}

function mergeHydratedStates(
  localState: HydratedAppState,
  cloudRaw: MarvitBackupData,
  preserveSelectedMonth: boolean
): HydratedAppState {
  const cloudState = hydratePayloadState(cloudRaw);
  const mergedMonths: Record<string, MonthDataRecord> = {
    ...cloudState.monthsData,
  };

  for (const [mKey, localRec] of Object.entries(localState.monthsData)) {
    const cloudRec = mergedMonths[mKey];
    if (!cloudRec) {
      mergedMonths[mKey] = localRec;
      continue;
    }

    const localIsDefault = isUntouchedDefaultMonth(localRec);
    const cloudIsDefault = isUntouchedDefaultMonth(cloudRec);

    if (localIsDefault && !cloudIsDefault) {
      mergedMonths[mKey] = cloudRec;
    } else if (!localIsDefault && cloudIsDefault) {
      mergedMonths[mKey] = localRec;
    } else {
      const localTime = new Date(localRec.updatedAt || 0).getTime() || 0;
      const cloudTime = new Date(cloudRec.updatedAt || 0).getTime() || 0;
      mergedMonths[mKey] = localTime >= cloudTime ? localRec : cloudRec;
    }
  }

  // Mesclar histórico sem perder fechamentos de nenhum dos lados
  const historyMap = new Map<string, MonthSnapshot>();
  for (const item of [...localState.history, ...cloudState.history]) {
    const existing = historyMap.get(item.id);
    if (!existing) {
      historyMap.set(item.id, item);
    } else {
      const tA = new Date(existing.dateCreated || 0).getTime() || 0;
      const tB = new Date(item.dateCreated || 0).getTime() || 0;
      if (tB > tA) historyMap.set(item.id, item);
    }
  }
  const mergedHistory = Array.from(historyMap.values()).sort(
    (a, b) =>
      (new Date(b.dateCreated || 0).getTime() || 0) -
      (new Date(a.dateCreated || 0).getTime() || 0)
  );

  const localExportTime = new Date(localState.exportedAt || 0).getTime() || 0;
  const cloudExportTime = new Date(cloudState.exportedAt || 0).getTime() || 0;
  const targetMonthKey = preserveSelectedMonth
    ? localState.selectedMonthKey
    : cloudExportTime > localExportTime
    ? cloudState.selectedMonthKey
    : localState.selectedMonthKey;

  const activeRec =
    mergedMonths[targetMonthKey] ||
    localState.monthsData[targetMonthKey] ||
    cloudState.monthsData[targetMonthKey];

  return {
    selectedMonthKey: targetMonthKey,
    monthsData: mergedMonths,
    profile: activeRec.profile,
    customGoals: activeRec.customGoals,
    expenses: normalizeLifestyleExpenses(activeRec.expenses),
    currentMonthNotes: activeRec.notes || '',
    longTermGoals:
      cloudExportTime > localExportTime
        ? cloudState.longTermGoals
        : localState.longTermGoals,
    globalCards:
      cloudExportTime > localExportTime
        ? cloudState.globalCards
        : localState.globalCards,
    history: mergedHistory,
    exportedAt:
      localExportTime >= cloudExportTime
        ? localState.exportedAt
        : cloudState.exportedAt,
    restoredAt:
      getTimeMs(localState.restoredAt) >= getTimeMs(cloudState.restoredAt)
        ? localState.restoredAt
        : cloudState.restoredAt,
    excludedGoalIds: activeRec.excludedGoalIds || [],
    goalContributionOverrides: activeRec.goalContributionOverrides || {},
  };
}

function loadInitialHydratedState(): HydratedAppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<MarvitBackupData>;
      return hydratePayloadState(parsed);
    }
  } catch {
    // ignore
  }
  return hydratePayloadState(null);
}

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const initialHydrated = useMemo(() => loadInitialHydratedState(), []);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    () => initialHydrated.selectedMonthKey
  );
  const [monthsData, setMonthsData] = useState<Record<string, MonthDataRecord>>(
    () => initialHydrated.monthsData
  );
  const [currentMonthNotes, setCurrentMonthNotes] = useState<string>(
    () => initialHydrated.currentMonthNotes
  );

  const [profile, setProfile] = useState<FinancialProfile>(
    () => initialHydrated.profile
  );

  const [customGoals, setCustomGoals] = useState<Record<ExpenseCategory, number>>(
    () => initialHydrated.customGoals
  );

  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    () => initialHydrated.expenses
  );
  const [longTermGoals, setLongTermGoals] = useState<CustomGoalItem[]>(
    () => initialHydrated.longTermGoals
  );
  const [globalCards, setGlobalCards] = useState<GlobalCreditCard[]>(
    () => initialHydrated.globalCards || INITIAL_GLOBAL_CARDS
  );
  const [history, setHistory] = useState<MonthSnapshot[]>(
    () => initialHydrated.history
  );
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(
    () => initialHydrated.exportedAt
  );
  const [restoredAt, setRestoredAt] = useState<string | undefined>(
    () => initialHydrated.restoredAt
  );
  const [excludedGoalIds, setExcludedGoalIds] = useState<string[]>(
    () => initialHydrated.excludedGoalIds || []
  );
  const [goalContributionOverrides, setGoalContributionOverrides] = useState<Record<string, number>>(
    () => initialHydrated.goalContributionOverrides || {}
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('budget');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isBentoMode, setIsBentoMode] = useState(false);
  const [budgetSubView, setBudgetSubView] = useState<'sheet' | 'charts'>('sheet');
  const [freedomSubView, setFreedomSubView] = useState<'fire' | 'compound'>('fire');
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [pendingExportFile, setPendingExportFile] =
    useState<PreparedExportFile | null>(null);
  const [vault, setVault] = useState<VaultCredentials | null>(() => {
    try {
      const savedVault = localStorage.getItem(VAULT_SESSION_KEY);
      if (savedVault) {
        const parsedVault = JSON.parse(savedVault) as VaultCredentials;
        return {
          ...parsedVault,
          vaultId: DEFAULT_VAULT_ID,
          autoSync: true,
        };
      }
    } catch {
      // ignore
    }
    return null;
  });

  // PIN obrigatório desde o primeiro acesso!
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SESSION_UNLOCKED_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const [lockPinInput, setLockPinInput] = useState('');
  const [lockError, setLockError] = useState('');
  const [lockLoading, setLockLoading] = useState(false);

  // Passo opcional após desbloquear com o PIN padrão ("2026") no primeiro acesso
  const [showFirstAccessChangePin, setShowFirstAccessChangePin] = useState(false);
  const [firstAccessNewPin, setFirstAccessNewPin] = useState('');
  const [firstAccessConfirmPin, setFirstAccessConfirmPin] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const [deferredPwaPrompt, setDeferredPwaPrompt] = useState<any>(null);
  const [singleMonthModalPayload, setSingleMonthModalPayload] = useState<MarvitBackupData | null>(null);
  const [isSingleMonthModalOpen, setIsSingleMonthModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastLocalEditTimestampRef = useRef<number>(0);
  const isPushingCloudRef = useRef<boolean>(false);
  // Trava para evitar que estados transitórios de um mês sobreponham outro durante transição ou importação
  const isSwitchingMonthRef = useRef<boolean>(false);
  // Enquanto um backup recém-importado estiver sendo gravado na nuvem, nenhum pull pode sobrescrevê-lo
  const importGuardUntilRef = useRef<number>(0);
  // Só envia dados para a nuvem depois de ter lido a nuvem ao menos 1x nesta sessão
  // (evita que um aparelho com dados antigos sobrescreva um backup restaurado em outro aparelho ao abrir o app)
  const hasPulledCloudRef = useRef<boolean>(false);

  const markUserEdit = () => {
    const nowIso = new Date().toISOString();
    lastLocalEditTimestampRef.current = Date.now();
    setLastModifiedAt(nowIso);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  // Sincronizar Modo Claro / Modo Escuro no HTML e meta theme-color
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0F1115' : '#FAF6F0');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Checar parâmetros de atalho PWA na URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as ActiveTab | null;
    if (
      tabParam &&
      ['budget', 'cards', 'goals', 'freedom', 'advice', 'history'].includes(
        tabParam
      )
    ) {
      setActiveTab(tabParam);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPwaPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // No PWA, se já houver biometria cadastrada, aciona automaticamente a leitura biométrica na tela de bloqueio!
  useEffect(() => {
    if (isAppLocked && isRunningAsPwa() && hasRegisteredBiometrics()) {
      handleUnlockAppWithBiometrics(true);
    }
  }, [isAppLocked]);

  // Sempre que os dados do mês atual mudarem (profile, customGoals, expenses, currentMonthNotes),
  // persiste automaticamente no estado monthsData[selectedMonthKey] e sincroniza eventual fechamento desse mês no Histórico!
  useEffect(() => {
    // Se estivermos em transição de mês ou importação isolada, não grava dados transitórios no mês selecionado
    if (isSwitchingMonthRef.current) {
      isSwitchingMonthRef.current = false;
      return;
    }

    const manualOnly = normalizeLifestyleExpenses(
      expenses.filter((e) => !e.linkedGoalId)
    );
    const effectiveUpdatedAt =
      lastModifiedAt ||
      monthsData[selectedMonthKey]?.updatedAt ||
      new Date().toISOString();

    setMonthsData((prev) => {
      const nextRecord: MonthDataRecord = {
        monthKey: selectedMonthKey,
        updatedAt: effectiveUpdatedAt,
        profile,
        customGoals,
        expenses: manualOnly,
        notes: currentMonthNotes.trim() || undefined,
        excludedGoalIds,
        goalContributionOverrides,
      };
      return {
        ...prev,
        [selectedMonthKey]: nextRecord,
      };
    });

    if (lastLocalEditTimestampRef.current > 0) {
      setHistory((prevHistory) => {
        const idx = prevHistory.findIndex(
          (h) =>
            (h.monthKey ||
              inferMonthKeyFromLabel(h.monthLabel, h.dateCreated)) ===
            selectedMonthKey
        );
        if (idx === -1) return prevHistory;
        const targetSnap = prevHistory[idx];
        const updatedSnap: MonthSnapshot = {
          ...targetSnap,
          monthKey: selectedMonthKey,
          dateCreated: effectiveUpdatedAt,
          profile: { ...profile },
          customGoals: { ...customGoals },
          expenses: manualOnly.map((e) => ({ ...e })),
          customLongTermGoals: longTermGoals.map((g) => ({ ...g })),
          notes: currentMonthNotes.trim() || targetSnap.notes,
          excludedGoalIds: [...excludedGoalIds],
          goalContributionOverrides: { ...goalContributionOverrides },
        };
        const nextHistory = [...prevHistory];
        nextHistory[idx] = updatedSnap;
        return nextHistory;
      });
    }
  }, [
    selectedMonthKey,
    profile,
    customGoals,
    expenses,
    currentMonthNotes,
    lastModifiedAt,
    longTermGoals,
    excludedGoalIds,
    goalContributionOverrides,
  ]);

  const syncedMonthsData = useMemo<Record<string, MonthDataRecord>>(() => {
    const manualOnly = normalizeLifestyleExpenses(
      expenses.filter((e) => !e.linkedGoalId)
    );
    return {
      ...monthsData,
      [selectedMonthKey]: {
        monthKey: selectedMonthKey,
        updatedAt:
          lastModifiedAt ||
          monthsData[selectedMonthKey]?.updatedAt ||
          new Date().toISOString(),
        profile,
        customGoals,
        expenses: manualOnly,
        notes: currentMonthNotes.trim() || undefined,
        excludedGoalIds,
        goalContributionOverrides,
      },
    };
  }, [
    monthsData,
    selectedMonthKey,
    profile,
    customGoals,
    expenses,
    currentMonthNotes,
    lastModifiedAt,
    excludedGoalIds,
    goalContributionOverrides,
  ]);

  // Transitar entre os meses do calendário persistindo automaticamente o mês anterior e carregando o destino
  const handleSelectMonth = (nextMonthKey: string) => {
    if (nextMonthKey === selectedMonthKey) return;
    isSwitchingMonthRef.current = true;

    const nowIso = new Date().toISOString();
    const currentManualOnly = normalizeLifestyleExpenses(
      expenses.filter((e) => !e.linkedGoalId)
    );
    const updatedMap: Record<string, MonthDataRecord> = {
      ...syncedMonthsData,
      [selectedMonthKey]: {
        monthKey: selectedMonthKey,
        updatedAt: lastModifiedAt || nowIso,
        profile,
        customGoals,
        expenses: currentManualOnly,
        notes: currentMonthNotes.trim() || undefined,
        excludedGoalIds,
        goalContributionOverrides,
      },
    };

    // Verifica se o mês de destino já existe em monthsData ou se possui fechamento salvo no Histórico
    let existingTarget = updatedMap[nextMonthKey];
    if (!existingTarget || isUntouchedDefaultMonth(existingTarget)) {
      const matchingSnapshot = history.find(
        (h) =>
          (h.monthKey ||
            inferMonthKeyFromLabel(h.monthLabel, h.dateCreated)) ===
          nextMonthKey
      );
      if (matchingSnapshot) {
        existingTarget = {
          monthKey: nextMonthKey,
          updatedAt: matchingSnapshot.dateCreated || nowIso,
          profile: { ...matchingSnapshot.profile },
          customGoals: { ...matchingSnapshot.customGoals },
          expenses: normalizeLifestyleExpenses(
            matchingSnapshot.expenses.filter((e) => !e.linkedGoalId)
          ),
          notes: matchingSnapshot.notes,
          excludedGoalIds: matchingSnapshot.excludedGoalIds,
          goalContributionOverrides: matchingSnapshot.goalContributionOverrides,
        };
        updatedMap[nextMonthKey] = existingTarget;
      }
    }

    if (existingTarget) {
      setMonthsData(updatedMap);
      setSelectedMonthKey(nextMonthKey);
      setProfile(existingTarget.profile);
      setCustomGoals(existingTarget.customGoals);
      setExpenses(
        normalizeExpensesWithGlobalCards(existingTarget.expenses, globalCards)
      );
      setCurrentMonthNotes(existingTarget.notes || '');
      setExcludedGoalIds(existingTarget.excludedGoalIds || []);
      setGoalContributionOverrides(existingTarget.goalContributionOverrides || {});
      showToast(`Editando ${formatMonthKeyLabel(nextMonthKey)}`);
    } else {
      // Novo mês ainda não preenchido: cria e persiste imediatamente o registro do novo mês com os cartões globais prontos
      const cleanManual = normalizeExpensesWithGlobalCards(
        currentManualOnly.map((e) => ({ ...e })),
        globalCards
      );
      const newMonthRecord: MonthDataRecord = {
        monthKey: nextMonthKey,
        updatedAt: nowIso,
        profile: { ...profile },
        customGoals: { ...customGoals },
        expenses: cleanManual,
        notes: undefined,
        excludedGoalIds: [],
        goalContributionOverrides: {},
      };
      updatedMap[nextMonthKey] = newMonthRecord;
      setMonthsData(updatedMap);
      setSelectedMonthKey(nextMonthKey);
      setExpenses(cleanManual);
      setCurrentMonthNotes('');
      setExcludedGoalIds([]);
      setGoalContributionOverrides({});
      markUserEdit();
      showToast(
        `${formatMonthKeyLabel(nextMonthKey)} aberto para preenchimento!`
      );
    }
  };

  // Copiar dados do mês imediatamente anterior para o mês atual em edição
  const handleCopyFromPreviousMonth = () => {
    const prevKey = shiftMonthKey(selectedMonthKey, -1);
    const prevRecord = syncedMonthsData[prevKey];
    if (!prevRecord) {
      showToast(
        `O mês anterior (${formatMonthKeyLabel(prevKey)}) ainda não possui dados salvos.`
      );
      return;
    }

    markUserEdit();
    setProfile({ ...prevRecord.profile });
    setCustomGoals({ ...prevRecord.customGoals });
    setExpenses(
      normalizeLifestyleExpenses(prevRecord.expenses.map((e) => ({ ...e })))
    );
    setCurrentMonthNotes(prevRecord.notes || '');
    showToast(
      `Dados copiados de ${formatMonthKeyLabel(prevKey)} para ${formatMonthKeyLabel(selectedMonthKey)}!`
    );
  };

  // Combinar despesas manuais do mês selecionado + aportes vinculados das Metas Personalizadas
  const combinedExpenses = useMemo<ExpenseItem[]>(() => {
    const manualOnly = expenses.filter((e) => !e.linkedGoalId);
    const withCards = normalizeExpensesWithGlobalCards(manualOnly, globalCards);
    const linkedFromGoals: ExpenseItem[] = longTermGoals
      .filter(
        (g) =>
          g.syncWithBudget &&
          g.monthlyContribution > 0 &&
          !excludedGoalIds.includes(g.id)
      )
      .map((g) => ({
        id: `goal-exp-${g.id}`,
        name: `🎯 Pote: ${g.title}`,
        amount:
          typeof goalContributionOverrides[g.id] === 'number'
            ? goalContributionOverrides[g.id]
            : g.monthlyContribution,
        category: g.budgetCategory,
        linkedGoalId: g.id,
      }));
    return [...withCards, ...linkedFromGoals];
  }, [expenses, globalCards, longTermGoals, excludedGoalIds, goalContributionOverrides]);

  const linkedGoalsMonthlyTotal = useMemo(
    () =>
      longTermGoals
        .filter(
          (g) =>
            g.syncWithBudget &&
            g.monthlyContribution > 0 &&
            !excludedGoalIds.includes(g.id)
        )
        .reduce((acc, g) => {
          const amt =
            typeof goalContributionOverrides[g.id] === 'number'
              ? goalContributionOverrides[g.id]
              : g.monthlyContribution;
          return acc + amt;
        }, 0),
    [longTermGoals, excludedGoalIds, goalContributionOverrides]
  );

  const excludedGoalsForCurrentMonth = useMemo(() => {
    return longTermGoals
      .filter(
        (g) =>
          g.syncWithBudget &&
          g.monthlyContribution > 0 &&
          excludedGoalIds.includes(g.id)
      )
      .map((g) => ({
        id: g.id,
        title: g.title,
        monthlyContribution: g.monthlyContribution,
        budgetCategory: g.budgetCategory,
      }));
  }, [longTermGoals, excludedGoalIds]);

  const currentBackupPayload = useMemo<MarvitBackupData>(
    () => ({
      version: '2.4.0',
      appName: 'Marvit&Finances',
      exportedAt: lastModifiedAt,
      selectedMonthKey,
      monthsData: syncedMonthsData,
      profile,
      customGoals,
      expenses: normalizeExpensesWithGlobalCards(
        expenses.filter((e) => !e.linkedGoalId),
        globalCards
      ),
      customLongTermGoals: longTermGoals,
      globalCards,
      history,
      ...(restoredAt ? { restoredAt } : {}),
    }),
    [
      lastModifiedAt,
      selectedMonthKey,
      syncedMonthsData,
      profile,
      customGoals,
      expenses,
      longTermGoals,
      globalCards,
      history,
      restoredAt,
    ]
  );

  const latestPayloadRef = useRef<MarvitBackupData>(currentBackupPayload);
  latestPayloadRef.current = currentBackupPayload;

  // Salvar imediatamente no LocalStorage em toda alteração e sincronizar na nuvem com debounce curto (600ms)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBackupPayload));
      if (vault?.pinHash) {
        saveLocalMirrorVault(vault.pinHash, currentBackupPayload);
      }
    } catch {
      // Ignora quota error
    }

    if (!isAppLocked && vault && vault.autoSync && hasPulledCloudRef.current) {
      const timer = setTimeout(() => {
        isPushingCloudRef.current = true;
        pushVaultToCloud(vault.vaultId, vault.pinHash, currentBackupPayload)
          .catch(() => {})
          .finally(() => {
            isPushingCloudRef.current = false;
          });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentBackupPayload, vault, isAppLocked]);

  // Garante envio imediato (keepalive) ao fechar/recarregar a página se houve edição recente
  useEffect(() => {
    const handleFlushOnUnload = () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(latestPayloadRef.current)
        );
        if (vault?.pinHash) {
          saveLocalMirrorVault(vault.pinHash, latestPayloadRef.current);
          if (!isAppLocked && vault.autoSync && hasPulledCloudRef.current) {
            pushVaultToCloud(
              vault.vaultId,
              vault.pinHash,
              latestPayloadRef.current,
              undefined,
              true
            ).catch(() => {});
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleFlushOnUnload);
    window.addEventListener('pagehide', handleFlushOnUnload);
    return () => {
      window.removeEventListener('beforeunload', handleFlushOnUnload);
      window.removeEventListener('pagehide', handleFlushOnUnload);
    };
  }, [vault, isAppLocked]);

  // Sincronização inteligente da Conta Geral Unificada (PC + Celular) ao abrir e ao focar a janela/aba
  // Nunca sobrescreve edições locais mais recentes nem um backup recém-importado!
  const syncFromCloudRef = useRef<() => Promise<void>>(async () => {});
  syncFromCloudRef.current = async () => {
    if (isAppLocked || !vault?.pinHash) return;
    const isBlocked = () =>
      isPushingCloudRef.current ||
      Date.now() < importGuardUntilRef.current ||
      Date.now() - lastLocalEditTimestampRef.current < 4000;
    if (isBlocked()) {
      if (!hasPulledCloudRef.current) {
        setTimeout(() => {
          syncFromCloudRef.current();
        }, 4500);
      }
      return;
    }

    const res = await pullVaultFromCloud(DEFAULT_VAULT_ID, vault.pinHash);
    if (!res.ok) return;
    if (isBlocked()) {
      // Houve edição/importação local durante a leitura: tenta novamente em instantes
      if (!hasPulledCloudRef.current) {
        setTimeout(() => {
          syncFromCloudRef.current();
        }, 4500);
      }
      return;
    }
    if (res.data) {
      handleSmartMergeCloudPayload(res.data, hasPulledCloudRef.current);
    }
    hasPulledCloudRef.current = true;
  };

  useEffect(() => {
    if (isAppLocked || !vault?.pinHash) return;

    // Leitura inicial da nuvem ao abrir o app já desbloqueado (sessão ativa)
    if (!hasPulledCloudRef.current) {
      syncFromCloudRef.current();
    }

    const syncFromCloud = () => {
      syncFromCloudRef.current();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromCloud();
      }
    };

    window.addEventListener('focus', syncFromCloud);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', syncFromCloud);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAppLocked, vault?.pinHash]);

  const handleUpdateVault = (nextVault: VaultCredentials | null) => {
    setVault(nextVault);
    if (nextVault) {
      localStorage.setItem(VAULT_SESSION_KEY, JSON.stringify(nextVault));
    } else {
      localStorage.removeItem(VAULT_SESSION_KEY);
    }
  };

  const handleChangeProfile = (nextProfile: FinancialProfile) => {
    markUserEdit();
    setProfile(nextProfile);
  };

  const handleChangeMonthNotes = (notes: string) => {
    markUserEdit();
    setCurrentMonthNotes(notes);
  };

  const totalIncome = profile.monthlyIncome + profile.additionalIncome;

  const categoryTotals = useMemo<Record<ExpenseCategory, number>>(() => {
    const totals: Record<ExpenseCategory, number> = {
      essencial: 0,
      estilo: 0,
      investimento: 0,
    };
    combinedExpenses.forEach((item) => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });
    return totals;
  }, [combinedExpenses]);

  const totalExpenses =
    categoryTotals.essencial +
    categoryTotals.estilo +
    categoryTotals.investimento;
  const balance = totalIncome - totalExpenses;

  // Handlers de Despesas
  const handleAddExpense = (newItem: Omit<ExpenseItem, 'id'>) => {
    markUserEdit();
    const newId = `exp-${Date.now()}`;
    const isCard = newItem.category === 'estilo' && newItem.subcategory === 'cartao';

    if (isCard) {
      const newGlobalCard: GlobalCreditCard = {
        id: newId,
        name: newItem.name,
        cardLimit: newItem.cardLimit || 1500,
        cardDueDay: newItem.cardDueDay || 10,
        createdAt: new Date().toISOString(),
      };
      setGlobalCards((prev) => [...prev, newGlobalCard]);
      setSelectedCardId(newId);
      showToast(`Cartão "${newItem.name}" cadastrado globalmente para todos os meses!`);
    } else {
      showToast('Item adicionado ao mês!');
    }

    setExpenses((prev) => [
      { ...newItem, id: newId, ...(isCard ? { globalCardId: newId } : {}) },
      ...prev,
    ]);
  };

  // Handlers de Cartões de Crédito Globais (persistentes e sincronizados em todos os meses)
  const handleAddGlobalCard = (card: Omit<GlobalCreditCard, 'id'>) => {
    markUserEdit();
    const newId = `card-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newGlobalCard: GlobalCreditCard = {
      ...card,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setGlobalCards((prev) => [...prev, newGlobalCard]);

    const newExpenseCard: ExpenseItem = {
      id: newId,
      globalCardId: newId,
      name: newGlobalCard.name,
      amount: 0,
      category: 'estilo',
      subcategory: 'cartao',
      cardLimit: newGlobalCard.cardLimit,
      cardDueDay: newGlobalCard.cardDueDay,
      cardClosingDay: newGlobalCard.cardClosingDay,
      cardTransactions: [],
      isCustom: true,
    };

    setExpenses((prev) => [...prev, newExpenseCard]);
    setSelectedCardId(newId);
    showToast(`Cartão "${newGlobalCard.name}" cadastrado globalmente para todos os meses!`);
  };

  const handleUpdateGlobalCard = (
    id: string,
    updated: Partial<GlobalCreditCard>
  ) => {
    markUserEdit();
    setGlobalCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id || e.globalCardId === id
          ? {
              ...e,
              ...(updated.name ? { name: updated.name } : {}),
              ...(typeof updated.cardLimit !== 'undefined'
                ? { cardLimit: updated.cardLimit }
                : {}),
              ...(typeof updated.cardDueDay !== 'undefined'
                ? { cardDueDay: updated.cardDueDay }
                : {}),
              ...(typeof updated.cardClosingDay !== 'undefined'
                ? { cardClosingDay: updated.cardClosingDay }
                : {}),
            }
          : e
      )
    );

    setMonthsData((prev) => {
      const nextMap = { ...prev };
      for (const [mKey, rec] of Object.entries(nextMap)) {
        if (!rec.expenses) continue;
        nextMap[mKey] = {
          ...rec,
          expenses: rec.expenses.map((e) =>
            e.id === id || e.globalCardId === id
              ? {
                  ...e,
                  ...(updated.name ? { name: updated.name } : {}),
                  ...(typeof updated.cardLimit !== 'undefined'
                    ? { cardLimit: updated.cardLimit }
                    : {}),
                  ...(typeof updated.cardDueDay !== 'undefined'
                    ? { cardDueDay: updated.cardDueDay }
                    : {}),
                  ...(typeof updated.cardClosingDay !== 'undefined'
                    ? { cardClosingDay: updated.cardClosingDay }
                    : {}),
                }
              : e
          ),
        };
      }
      return nextMap;
    });

    showToast('Configurações do cartão atualizadas em todos os meses!');
  };

  const handleDeleteGlobalCard = (
    id: string,
    scope: 'global' | 'current_month'
  ) => {
    markUserEdit();
    if (scope === 'global') {
      setGlobalCards((prev) => prev.filter((c) => c.id !== id));
      setExpenses((prev) =>
        prev.filter((e) => e.id !== id && e.globalCardId !== id)
      );

      setMonthsData((prev) => {
        const nextMap = { ...prev };
        for (const [mKey, rec] of Object.entries(nextMap)) {
          if (!rec.expenses) continue;
          nextMap[mKey] = {
            ...rec,
            expenses: rec.expenses.filter(
              (e) => e.id !== id && e.globalCardId !== id
            ),
          };
        }
        return nextMap;
      });

      showToast('Cartão excluído globalmente de todos os meses.');
    } else {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === id || e.globalCardId === id
            ? { ...e, amount: 0, cardTransactions: [] }
            : e
        )
      );
      showToast('Fatura do cartão zerada no mês atual.');
    }
  };

  const handleOpenCardsTab = (cardId?: string) => {
    if (cardId) setSelectedCardId(cardId);
    setIsBentoMode(false);
    setActiveTab('cards');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = (id: string) => {
    markUserEdit();
    if (id.startsWith('goal-exp-') || id.startsWith('goal-contrib-')) {
      const goalId = id.replace(/^(goal-exp-|goal-contrib-)/, '');
      setExcludedGoalIds((prev) => Array.from(new Set([...prev, goalId])));
      showToast('Aporte do Pote dos Sonhos removido do orçamento deste mês!');
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleRestoreGoalContribution = (goalId: string) => {
    markUserEdit();
    setExcludedGoalIds((prev) => prev.filter((id) => id !== goalId));
    showToast('Aporte do Pote dos Sonhos reativado para este mês!');
  };

  const handleToggleGoalMonthExclusion = (goalId: string) => {
    markUserEdit();
    setExcludedGoalIds((prev) => {
      const isAlreadyExcluded = prev.includes(goalId);
      if (isAlreadyExcluded) {
        showToast('Aporte do Pote dos Sonhos reativado para este mês!');
        return prev.filter((id) => id !== goalId);
      } else {
        showToast('Aporte do Pote dos Sonhos removido/pausado deste mês!');
        return [...prev, goalId];
      }
    });
  };

  const handleCloneBudgetFromMonth = (sourceMonthKey: string) => {
    const sourceRecord = syncedMonthsData[sourceMonthKey];
    if (!sourceRecord) {
      showToast('O mês selecionado ainda não possui dados salvos.');
      return;
    }
    markUserEdit();
    setProfile({ ...sourceRecord.profile });
    setCustomGoals({ ...sourceRecord.customGoals });
    setExpenses(
      normalizeLifestyleExpenses(sourceRecord.expenses.map((e) => ({ ...e })))
    );
    if (sourceRecord.notes) {
      setCurrentMonthNotes(sourceRecord.notes);
    }
    setExcludedGoalIds(
      sourceRecord.excludedGoalIds ? [...sourceRecord.excludedGoalIds] : []
    );
    setGoalContributionOverrides(
      sourceRecord.goalContributionOverrides
        ? { ...sourceRecord.goalContributionOverrides }
        : {}
    );
    showToast(
      `Orçamento clonado de ${formatMonthKeyLabel(sourceMonthKey)} para ${formatMonthKeyLabel(selectedMonthKey)}!`
    );
  };

  const handleApplyBudgetPreset = (presetId: string) => {
    markUserEdit();
    if (presetId === 'auvp-50-30-20') {
      setExpenses([
        { id: `exp-${Date.now()}-1`, name: 'Aluguel / Parcela Imóvel', amount: 1800, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-2`, name: 'Supermercado & Feira', amount: 950, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-3`, name: 'Contas (Água, Luz, Internet)', amount: 420, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-4`, name: 'Plano de Saúde & Farmácia', amount: 380, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-5`, name: 'Transporte / Combustível', amount: 450, category: 'essencial', isCustom: true },
        {
          id: `exp-${Date.now()}-6`,
          name: 'Cartão Nubank / Ultravioleta',
          amount: 760,
          category: 'estilo',
          subcategory: 'cartao',
          cardDueDay: 10,
          cardLimit: 1500,
          cardTransactions: [
            { id: `tx-${Date.now()}-1`, description: 'Jantar Especial & Cafeterias', amount: 340, tag: 'gastronomia', installment: 'À vista', purchaseDate: '08/11' },
            { id: `tx-${Date.now()}-2`, description: 'Streaming (Netflix, Spotify, Apple)', amount: 110, tag: 'assinaturas', installment: 'Recorrente', purchaseDate: '12/11' },
            { id: `tx-${Date.now()}-3`, description: 'Compras Online & Livros', amount: 310, tag: 'compras', installment: 'À vista', purchaseDate: '19/11' },
          ],
          isCustom: true,
        },
        { id: `exp-${Date.now()}-7`, name: 'Aportes em Renda Variável (Ações/FIIs)', amount: 1000, category: 'investimento', isCustom: true },
        { id: `exp-${Date.now()}-8`, name: 'Reserva de Emergência / Tesouro Selic', amount: 500, category: 'investimento', isCustom: true },
      ]);
      setCustomGoals({ essencial: 50, estilo: 30, investimento: 20 });
      showToast('Modelo "Padrão AUVP (50/30/20)" aplicado ao mês!');
    } else if (presetId === 'investidor-40-30-30') {
      setExpenses([
        { id: `exp-${Date.now()}-1`, name: 'Moradia & Condomínio', amount: 1600, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-2`, name: 'Mercado & Alimentação', amount: 800, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-3`, name: 'Contas Essenciais', amount: 350, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-4`, name: 'Transporte & Seguro', amount: 400, category: 'essencial', isCustom: true },
        {
          id: `exp-${Date.now()}-5`,
          name: 'Cartão de Estilo de Vida',
          amount: 900,
          category: 'estilo',
          subcategory: 'cartao',
          cardTransactions: [
            { id: `tx-${Date.now()}-1`, description: 'Restaurantes & Lazer', amount: 550, tag: 'gastronomia', installment: 'À vista', purchaseDate: '10/11' },
            { id: `tx-${Date.now()}-2`, description: 'Assinaturas & Bem-Estar', amount: 350, tag: 'assinaturas', installment: 'Recorrente', purchaseDate: '15/11' },
          ],
          isCustom: true,
        },
        { id: `exp-${Date.now()}-6`, name: 'Aportes Ações Globais & ETFs', amount: 1500, category: 'investimento', isCustom: true },
        { id: `exp-${Date.now()}-7`, name: 'Reserva de Emergência / Tesouro', amount: 700, category: 'investimento', isCustom: true },
      ]);
      setCustomGoals({ essencial: 40, estilo: 30, investimento: 30 });
      showToast('Modelo "Foco em Investimentos (40/30/30)" aplicado ao mês!');
    } else if (presetId === 'enxuto-minimalista') {
      setExpenses([
        { id: `exp-${Date.now()}-1`, name: 'Moradia Essencial', amount: 1300, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-2`, name: 'Alimentação Básica & Feira', amount: 650, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-3`, name: 'Contas Básicas', amount: 280, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-4`, name: 'Transporte Público / Básico', amount: 220, category: 'essencial', isCustom: true },
        { id: `exp-${Date.now()}-5`, name: 'Lazer Consciente & Cartão', amount: 450, category: 'estilo', subcategory: 'cartao', isCustom: true },
        { id: `exp-${Date.now()}-6`, name: 'Aportes para Independência Financeira', amount: 1800, category: 'investimento', isCustom: true },
      ]);
      setCustomGoals({ essencial: 45, estilo: 15, investimento: 40 });
      showToast('Modelo "Enxuto & Aportes Rápidos" aplicado ao mês!');
    }
  };

  const availableMonthsToClone = useMemo(() => {
    return Object.keys(syncedMonthsData)
      .filter(
        (k) =>
          k !== selectedMonthKey &&
          syncedMonthsData[k]?.expenses &&
          syncedMonthsData[k].expenses.length > 0
      )
      .map((k) => ({
        monthKey: k,
        monthLabel: formatMonthKeyLabel(k),
        itemCount: syncedMonthsData[k].expenses.length,
      }));
  }, [syncedMonthsData, selectedMonthKey]);

  const handleUpdateExpense = (id: string, updated: Partial<ExpenseItem>) => {
    markUserEdit();
    if (id.startsWith('goal-exp-') || id.startsWith('goal-contrib-')) {
      const goalId = id.replace(/^(goal-exp-|goal-contrib-)/, '');
      if (typeof updated.amount === 'number') {
        setGoalContributionOverrides((prev) => ({
          ...prev,
          [goalId]: updated.amount as number,
        }));
        showToast('Valor de aporte atualizado para este mês!');
      }
      return;
    }
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e))
    );
  };

  // Handlers de Metas de Longo Prazo
  const handleAddLongTermGoal = (goal: Omit<CustomGoalItem, 'id'>) => {
    markUserEdit();
    setLongTermGoals((prev) => [
      { ...goal, id: `goal-${Date.now()}` },
      ...prev,
    ]);
    showToast('Novo Pote dos Sonhos criado!');
  };

  const handleUpdateLongTermGoal = (
    id: string,
    updated: Partial<CustomGoalItem>
  ) => {
    markUserEdit();
    setLongTermGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updated } : g))
    );
  };

  const handleDeleteLongTermGoal = (id: string) => {
    markUserEdit();
    setLongTermGoals((prev) => prev.filter((g) => g.id !== id));
  };

  // Handlers de Histórico (vinculados diretamente à competência do Calendário)
  const handleSaveCurrentMonth = (
    monthLabel: string,
    notes?: string,
    targetMonthKey?: string
  ) => {
    const nowIso = new Date().toISOString();
    const resolvedMonthKey =
      targetMonthKey ||
      inferMonthKeyFromLabel(monthLabel, nowIso) ||
      selectedMonthKey;

    const cleanManualExpenses = normalizeLifestyleExpenses(
      expenses.filter((e) => !e.linkedGoalId).map((e) => ({ ...e }))
    );
    const resolvedNotes = (notes ?? currentMonthNotes).trim() || undefined;

    const snapshot: MonthSnapshot = {
      id: `snap-${Date.now()}`,
      monthKey: resolvedMonthKey,
      monthLabel:
        monthLabel.trim() || formatMonthKeySlashLabel(resolvedMonthKey),
      dateCreated: nowIso,
      profile: { ...profile },
      customGoals: { ...customGoals },
      expenses: combinedExpenses.map((e) => ({ ...e })),
      customLongTermGoals: longTermGoals.map((g) => ({ ...g })),
      notes: resolvedNotes,
      excludedGoalIds: [...excludedGoalIds],
      goalContributionOverrides: { ...goalContributionOverrides },
    };

    markUserEdit();
    setMonthsData((prev) => ({
      ...prev,
      [resolvedMonthKey]: {
        monthKey: resolvedMonthKey,
        updatedAt: nowIso,
        profile: { ...profile },
        customGoals: { ...customGoals },
        expenses: cleanManualExpenses,
        notes: resolvedNotes,
        excludedGoalIds: [...excludedGoalIds],
        goalContributionOverrides: { ...goalContributionOverrides },
      },
    }));
    if (resolvedMonthKey !== selectedMonthKey) {
      setSelectedMonthKey(resolvedMonthKey);
    }
    if (resolvedNotes) {
      setCurrentMonthNotes(resolvedNotes);
    }
    setHistory((prev) => {
      const filtered = prev.filter(
        (h) =>
          !(
            (h.monthKey ||
              inferMonthKeyFromLabel(h.monthLabel, h.dateCreated)) ===
              resolvedMonthKey &&
            h.monthLabel.trim().toLowerCase() ===
              snapshot.monthLabel.trim().toLowerCase()
          )
      );
      return [snapshot, ...filtered];
    });
    showToast(
      `Fechamento "${snapshot.monthLabel}" salvo e vinculado a ${formatMonthKeyLabel(resolvedMonthKey)}!`
    );
  };

  const handleLoadSnapshot = (snapshot: MonthSnapshot) => {
    const nowIso = new Date().toISOString();
    const targetMonthKey =
      snapshot.monthKey ||
      inferMonthKeyFromLabel(snapshot.monthLabel, snapshot.dateCreated) ||
      selectedMonthKey;

    const restoredExpenses = normalizeLifestyleExpenses(
      snapshot.expenses.filter((e) => !e.linkedGoalId).map((e) => ({ ...e }))
    );
    const restoredProfile = { ...snapshot.profile };
    const restoredGoals = { ...snapshot.customGoals };
    const restoredNotes = snapshot.notes || '';

    isSwitchingMonthRef.current = true;
    markUserEdit();

    const currentManual = normalizeLifestyleExpenses(
      expenses.filter((e) => !e.linkedGoalId)
    );

    setMonthsData((prev) => {
      const nextMap = { ...prev };
      if (selectedMonthKey !== targetMonthKey) {
        nextMap[selectedMonthKey] = {
          monthKey: selectedMonthKey,
          updatedAt: lastModifiedAt || nowIso,
          profile,
          customGoals,
          expenses: currentManual,
          notes: currentMonthNotes.trim() || undefined,
          excludedGoalIds,
          goalContributionOverrides,
        };
      }
      nextMap[targetMonthKey] = {
        monthKey: targetMonthKey,
        updatedAt: nowIso,
        profile: restoredProfile,
        customGoals: restoredGoals,
        expenses: restoredExpenses,
        notes: restoredNotes.trim() || undefined,
        excludedGoalIds: snapshot.excludedGoalIds || [],
        goalContributionOverrides: snapshot.goalContributionOverrides || {},
      };
      return nextMap;
    });

    setSelectedMonthKey(targetMonthKey);
    setProfile(restoredProfile);
    setCustomGoals(restoredGoals);
    setExpenses(restoredExpenses);
    setCurrentMonthNotes(restoredNotes);
    setExcludedGoalIds(snapshot.excludedGoalIds || []);
    setGoalContributionOverrides(snapshot.goalContributionOverrides || {});

    if (snapshot.customLongTermGoals) {
      setLongTermGoals(snapshot.customLongTermGoals.map((g) => ({ ...g })));
    }

    setActiveTab('budget');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(
      `Mês "${snapshot.monthLabel}" restaurado para ${formatMonthKeyLabel(targetMonthKey)}!`
    );
  };

  const handleDeleteSnapshot = (id: string) => {
    markUserEdit();
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  // Exportações (100% síncronas na criação do arquivo para preservar o gesto de toque no Mobile & PWA)
  const handleTriggerExportFile = (prepared: PreparedExportFile) => {
    setIsExportMenuOpen(false);
    const isMobile = isMobileOrTouchDevice();

    if (isMobile) {
      // No mobile, abre imediatamente o Pop-up de Salvamento e aciona em paralelo a folha nativa do sistema
      setPendingExportFile(prepared);
      saveExportedFileWithPrompt(prepared, 'auto')
        .then((res) => {
          if (res === 'shared' || res === 'picked') {
            setPendingExportFile(null);
            showToast(`Arquivo "${prepared.filename}" salvo com sucesso!`);
          }
        })
        .catch(() => {});
      return;
    }

    // No desktop, abre o seletor nativo "Salvar como..." (showSaveFilePicker) ou faz o download direto
    saveExportedFileWithPrompt(prepared, 'auto')
      .then((res) => {
        if (res !== 'cancelled') {
          showToast(`Arquivo "${prepared.filename}" salvo com sucesso!`);
        }
      })
      .catch(() => {
        setPendingExportFile(prepared);
      });
  };

  const handleExportPng = () => {
    try {
      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = `marvit-finances-relatorio-${dateTag}.png`;
      const rendered = generateReportImageSync({
        profile,
        customGoals,
        categoryTotals,
        expenses: combinedExpenses,
        customLongTermGoals: longTermGoals,
        totalIncome,
        totalExpenses,
        balance,
      });
      const prepared: PreparedExportFile = {
        filename,
        mimeType: 'image/png',
        blob: rendered.blob,
        kind: 'png',
        title: 'Relatório Gráfico (.PNG)',
        subtitle:
          'Imagem em alta resolução (1200x1680) com seus pilares, gastos e metas.',
        previewDataUrl: rendered.dataUrl,
      };
      handleTriggerExportFile(prepared);
    } catch {
      showToast('Não foi possível gerar a imagem PNG.');
    }
  };

  const handleExportMarkdown = () => {
    const prepared = prepareMarkdownReportFile({
      profile,
      customGoals,
      categoryTotals,
      expenses: combinedExpenses,
      customLongTermGoals: longTermGoals,
      totalIncome,
      totalExpenses,
      balance,
    });
    handleTriggerExportFile(prepared);
  };

  const handleExportBackupJson = () => {
    const prepared = prepareBackupJsonFile(currentBackupPayload);
    handleTriggerExportFile(prepared);
  };

  const applyHydratedState = (state: HydratedAppState) => {
    setSelectedMonthKey(state.selectedMonthKey);
    setMonthsData(state.monthsData);
    setProfile(state.profile);
    setCustomGoals(state.customGoals);
    if (state.globalCards && state.globalCards.length > 0) {
      setGlobalCards(state.globalCards);
    }
    setExpenses(state.expenses);
    setCurrentMonthNotes(state.currentMonthNotes);
    setLongTermGoals(state.longTermGoals);
    setHistory(state.history);
    setLastModifiedAt(state.exportedAt);
    setRestoredAt(state.restoredAt);
    setExcludedGoalIds(state.excludedGoalIds || []);
    setGoalContributionOverrides(state.goalContributionOverrides || {});
  };

  const pushPayloadNow = (payload: MarvitBackupData) => {
    if (!vault?.pinHash || !vault.autoSync) return Promise.resolve();
    isPushingCloudRef.current = true;
    return pushVaultToCloud(vault.vaultId, vault.pinHash, payload)
      .catch(() => undefined)
      .then(() => undefined)
      .finally(() => {
        isPushingCloudRef.current = false;
      });
  };

  const handleSmartMergeCloudPayload = (
    cloudPayload: MarvitBackupData,
    preserveCurrentMonthOnScreen = false
  ) => {
    const localPayload = latestPayloadRef.current;
    const localRestoreTime = getTimeMs(localPayload.restoredAt);
    const cloudRestoreTime = getTimeMs(cloudPayload.restoredAt);

    // 1) Um backup foi restaurado em outro aparelho depois da última restauração conhecida aqui:
    //    a restauração é autoritativa -> adota o conteúdo da nuvem por completo (sem mesclar dados antigos).
    if (cloudRestoreTime > localRestoreTime) {
      applyHydratedState(hydratePayloadState(cloudPayload));
      showToast('Backup restaurado em outro aparelho aplicado aqui!');
      return;
    }

    // 2) A nuvem ainda não contém o backup restaurado neste aparelho (leitura atrasada ou outro aparelho
    //    gravou dados antigos): ignora a nuvem e regrava o backup restaurado.
    if (localRestoreTime > cloudRestoreTime) {
      pushPayloadNow(localPayload);
      return;
    }

    const localHydrated = hydratePayloadState(
      localPayload,
      localPayload.selectedMonthKey || selectedMonthKey
    );
    const merged = mergeHydratedStates(
      localHydrated,
      cloudPayload,
      preserveCurrentMonthOnScreen
    );
    applyHydratedState(merged);
  };

  const handleRestorePayload = (payload: MarvitBackupData, silent = false) => {
    if (silent) {
      handleSmartMergeCloudPayload(payload, false);
      return;
    }
    const hydrated = hydratePayloadState(payload);
    markUserEdit();
    applyHydratedState({
      ...hydrated,
      exportedAt: new Date().toISOString(),
    });
    showToast('Backup restaurado com sucesso!');
  };

  // Importação de um arquivo de backup .JSON: substitui todos os dados e passa a valer em todos os aparelhos
  const handleImportBackupPayload = (payload: MarvitBackupData) => {
    const nowIso = new Date().toISOString();
    const hydrated = hydratePayloadState({ ...payload, restoredAt: undefined });

    // Todos os meses importados passam a ser a versão mais recente (vencem qualquer mesclagem futura)
    const stampedMonths: Record<string, MonthDataRecord> = {};
    for (const [mKey, rec] of Object.entries(hydrated.monthsData)) {
      stampedMonths[mKey] = { ...rec, updatedAt: nowIso };
    }

    const nextState: HydratedAppState = {
      ...hydrated,
      monthsData: stampedMonths,
      exportedAt: nowIso,
      restoredAt: nowIso,
    };

    // Bloqueia qualquer pull da nuvem até o backup ser gravado (e alguns segundos extras p/ leituras atrasadas)
    importGuardUntilRef.current = Date.now() + 20000;
    hasPulledCloudRef.current = true;
    markUserEdit();
    applyHydratedState(nextState);

    const payloadToPush: MarvitBackupData = {
      version: '2.3.0',
      appName: 'Marvit&Finances',
      exportedAt: nowIso,
      selectedMonthKey: nextState.selectedMonthKey,
      monthsData: stampedMonths,
      profile: nextState.profile,
      customGoals: nextState.customGoals,
      expenses: nextState.expenses,
      customLongTermGoals: nextState.longTermGoals,
      history: nextState.history,
      restoredAt: nowIso,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadToPush));
      if (vault?.pinHash) saveLocalMirrorVault(vault.pinHash, payloadToPush);
    } catch {
      // ignore
    }
    pushPayloadNow(payloadToPush).finally(() => {
      importGuardUntilRef.current = Date.now() + 6000;
    });

    const monthsCount = Object.keys(stampedMonths).length;
    showToast(
      `Backup restaurado: ${monthsCount} ${monthsCount === 1 ? 'mês' : 'meses'} aplicados e sincronizados!`
    );
  };

  // Importação isolada de apenas um mês específico do arquivo de backup (garante que nenhum outro mês seja alterado)
  const handleImportSingleMonth = (
    targetMonthKey: string,
    importedRecord: MonthDataRecord,
    importedSnapshot?: MonthSnapshot
  ) => {
    const nowIso = new Date().toISOString();
    isSwitchingMonthRef.current = true;
    importGuardUntilRef.current = Date.now() + 20000;
    hasPulledCloudRef.current = true;
    markUserEdit();

    const cleanExpenses = normalizeLifestyleExpenses(
      (importedRecord.expenses || []).filter((e) => !e.linkedGoalId).map((e) => ({ ...e }))
    );
    const cleanProfile = { ...(importedRecord.profile || DEFAULT_PROFILE) };
    const cleanGoals = { ...(importedRecord.customGoals || DEFAULT_CUSTOM_GOALS) };
    const cleanNotes = (importedRecord.notes || importedSnapshot?.notes || '').trim();
    const importedExcluded = importedRecord.excludedGoalIds || importedSnapshot?.excludedGoalIds || [];
    const importedOverrides = importedRecord.goalContributionOverrides || importedSnapshot?.goalContributionOverrides || {};

    const updatedMonthRecord: MonthDataRecord = {
      monthKey: targetMonthKey,
      updatedAt: nowIso,
      profile: cleanProfile,
      customGoals: cleanGoals,
      expenses: cleanExpenses,
      notes: cleanNotes || undefined,
      excludedGoalIds: importedExcluded,
      goalContributionOverrides: importedOverrides,
    };

    // Salva o mês atual se for diferente do mês importado
    const currentManualOnly = normalizeLifestyleExpenses(
      expenses.filter((e) => !e.linkedGoalId)
    );

    const nextMonthsData: Record<string, MonthDataRecord> = {
      ...syncedMonthsData,
      ...(selectedMonthKey !== targetMonthKey
        ? {
            [selectedMonthKey]: {
              monthKey: selectedMonthKey,
              updatedAt: lastModifiedAt || nowIso,
              profile,
              customGoals,
              expenses: currentManualOnly,
              notes: currentMonthNotes.trim() || undefined,
              excludedGoalIds,
              goalContributionOverrides,
            },
          }
        : {}),
      [targetMonthKey]: updatedMonthRecord,
    };

    // Atualiza histórico mantendo todos os outros meses
    const nextHistory = [...history];
    const snapIdx = nextHistory.findIndex(
      (h) => (h.monthKey || inferMonthKeyFromLabel(h.monthLabel, h.dateCreated)) === targetMonthKey
    );
    const snapToStore: MonthSnapshot = importedSnapshot || {
      id: `snap-import-${targetMonthKey}-${Date.now()}`,
      monthKey: targetMonthKey,
      monthLabel: formatMonthKeySlashLabel(targetMonthKey),
      dateCreated: nowIso,
      profile: cleanProfile,
      customGoals: cleanGoals,
      expenses: cleanExpenses,
      notes: cleanNotes || undefined,
      excludedGoalIds: importedExcluded,
      goalContributionOverrides: importedOverrides,
    };

    if (snapIdx >= 0) {
      nextHistory[snapIdx] = snapToStore;
    } else {
      nextHistory.unshift(snapToStore);
    }

    setMonthsData(nextMonthsData);
    setHistory(nextHistory);
    setSelectedMonthKey(targetMonthKey);
    setProfile(cleanProfile);
    setCustomGoals(cleanGoals);
    setExpenses(cleanExpenses);
    setCurrentMonthNotes(cleanNotes);
    setExcludedGoalIds(importedExcluded);
    setGoalContributionOverrides(importedOverrides);
    setRestoredAt(nowIso);
    setActiveTab('budget');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const payloadToPush: MarvitBackupData = {
      version: '2.3.0',
      appName: 'Marvit&Finances',
      exportedAt: nowIso,
      selectedMonthKey: targetMonthKey,
      monthsData: nextMonthsData,
      profile: cleanProfile,
      customGoals: cleanGoals,
      expenses: cleanExpenses,
      customLongTermGoals: longTermGoals,
      history: nextHistory,
      restoredAt: nowIso,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payloadToPush));
      if (vault?.pinHash) saveLocalMirrorVault(vault.pinHash, payloadToPush);
    } catch {
      // ignore
    }

    pushPayloadNow(payloadToPush).finally(() => {
      importGuardUntilRef.current = Date.now() + 6000;
    });

    showToast(
      `Mês "${formatMonthKeySlashLabel(targetMonthKey)}" importado com sucesso! Os outros meses continuam intactos.`
    );
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Bloqueia o pull disparado pelo foco ao voltar do seletor de arquivos enquanto o arquivo é lido
    importGuardUntilRef.current = Date.now() + 20000;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as MarvitBackupData;
        if (!parsed || typeof parsed !== 'object' || (!parsed.monthsData && !parsed.profile)) {
          throw new Error('invalid');
        }
        // Abre o modal inteligente para escolher importar apenas um mês ou todos os meses
        setSingleMonthModalPayload(parsed);
        setIsSingleMonthModalOpen(true);
      } catch {
        importGuardUntilRef.current = 0;
        showToast('Arquivo JSON inválido.');
      }
    };
    reader.onerror = () => {
      importGuardUntilRef.current = 0;
      showToast('Não foi possível ler o arquivo.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleInstallPwa = async () => {
    if (deferredPwaPrompt) {
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice;
      setDeferredPwaPrompt(null);
    } else {
      showToast(
        'No iPhone/Android: toque em Compartilhar (ou menu ⋮) > "Adicionar à Tela de Início"!'
      );
    }
  };

  // Desbloqueio via Biometria (exclusivo/automático no PWA)
  const handleUnlockAppWithBiometrics = async (silent = false) => {
    try {
      setLockLoading(true);
      setLockError('');
      const creds = await unlockWithBiometrics();
      const cloudRes = await pullVaultFromCloud(creds.vaultId, creds.pinHash);
      if (cloudRes.ok && cloudRes.data) {
        handleRestorePayload(cloudRes.data, true);
      }
      if (cloudRes.ok) hasPulledCloudRef.current = true;
      const nextVault: VaultCredentials = {
        vaultId: creds.vaultId,
        pinHash: creds.pinHash,
        autoSync: true,
        appLockEnabled: true,
        biometricEnabled: true,
        lastSyncedAt: cloudRes.updatedAt || new Date().toISOString(),
      };
      handleUpdateVault(nextVault);
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
      setIsAppLocked(false);
    } catch (err: any) {
      if (!silent) {
        setLockError(err?.message || 'Falha na leitura biométrica.');
      }
    } finally {
      setLockLoading(false);
    }
  };

  // Desbloqueio obrigatório via PIN (desde o 1º acesso)
  const handleUnlockAppWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = lockPinInput.trim();
    if (!cleanPin) {
      setLockError('Digite o PIN para acessar a aplicação.');
      return;
    }

    setLockLoading(true);
    setLockError('');

    try {
      const targetVaultId = DEFAULT_VAULT_ID;
      const candidateHash = await hashPin(targetVaultId, cleanPin);
      const defaultHash = await hashPin(targetVaultId, DEFAULT_INITIAL_PIN);

      const res = await pullVaultFromCloud(targetVaultId, candidateHash);
      if (!res.ok) {
        setLockError(res.message || 'PIN incorreto. Tente novamente.');
        setLockLoading(false);
        return;
      }

      if (res.data) {
        handleRestorePayload(res.data, true);
      }
      hasPulledCloudRef.current = true;

      // Se estiver em modo PWA, registra automaticamente a biometria no primeiro login!
      let bioRegistered = Boolean(hasRegisteredBiometrics());
      if (isRunningAsPwa() && !bioRegistered) {
        const supported = await isBiometricsSupported();
        if (supported) {
          try {
            await registerBiometricVault(targetVaultId, candidateHash);
            bioRegistered = true;
          } catch {
            // Usuário pode vincular depois se cancelar o prompt nativo
          }
        }
      }

      const nextVault: VaultCredentials = {
        vaultId: targetVaultId,
        pinHash: candidateHash,
        autoSync: true,
        appLockEnabled: true,
        biometricEnabled: bioRegistered,
        lastSyncedAt: res.updatedAt || new Date().toISOString(),
      };
      handleUpdateVault(nextVault);
      setLockPinInput('');

      // Se o usuário entrou usando o PIN padrão ("2026"), oferece a troca imediata do PIN!
      if (res.isDefaultPin || candidateHash === defaultHash) {
        setShowFirstAccessChangePin(true);
      } else {
        sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
        setIsAppLocked(false);
      }
    } finally {
      setLockLoading(false);
    }
  };

  // Salvar o novo PIN escolhido logo após o primeiro acesso
  const handleSaveFirstAccessNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = firstAccessNewPin.trim();
    const cleanConfirm = firstAccessConfirmPin.trim();

    if (!cleanNew || cleanNew.length < 4) {
      setLockError('Escolha um novo PIN com pelo menos 4 dígitos ou caracteres.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setLockError('A confirmação do novo PIN não confere.');
      return;
    }

    setLockLoading(true);
    setLockError('');

    try {
      const targetVaultId = vault?.vaultId || DEFAULT_VAULT_ID;
      const currentPinHash =
        vault?.pinHash || (await hashPin(targetVaultId, DEFAULT_INITIAL_PIN));
      const newPinHash = await hashPin(targetVaultId, cleanNew);

      const res = await pushVaultToCloud(
        targetVaultId,
        currentPinHash,
        currentBackupPayload,
        newPinHash
      );

      if (!res.ok) {
        setLockError(res.message || 'Erro ao salvar novo PIN.');
        setLockLoading(false);
        return;
      }

      let bioRegistered = Boolean(hasRegisteredBiometrics());
      if (isRunningAsPwa()) {
        const supported = await isBiometricsSupported();
        if (supported) {
          try {
            await registerBiometricVault(targetVaultId, newPinHash);
            bioRegistered = true;
          } catch {
            // ignore
          }
        }
      }

      handleUpdateVault({
        vaultId: targetVaultId,
        pinHash: newPinHash,
        autoSync: true,
        appLockEnabled: true,
        biometricEnabled: bioRegistered,
        lastSyncedAt: res.updatedAt || new Date().toISOString(),
      });

      setShowFirstAccessChangePin(false);
      setFirstAccessNewPin('');
      setFirstAccessConfirmPin('');
      sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
      setIsAppLocked(false);
      showToast('Novo PIN pessoal configurado e sincronizado com sucesso!');
    } finally {
      setLockLoading(false);
    }
  };

  const handleSkipFirstAccessPinChange = () => {
    setShowFirstAccessChangePin(false);
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
    setIsAppLocked(false);
    showToast('Você pode alterar seu PIN a qualquer momento em "Cofre & PIN".');
  };

  const creditCardsCount = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.category === 'estilo' &&
          !e.linkedGoalId &&
          e.subcategory === 'cartao'
      ).length,
    [expenses]
  );

  const lifestyleIdealAmount =
    (totalIncome * (customGoals.estilo ?? AUVP_GOALS.estilo.idealPercent)) / 100;

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: string;
    badge?: number;
  }[] = [
    {
      id: 'budget',
      label: 'Orçamento & Gráficos',
      shortLabel: 'Orçamento',
      icon: 'pie_chart',
    },
    {
      id: 'cards',
      label: 'Cartões (Estilo)',
      shortLabel: 'Cartões',
      icon: 'credit_card',
      badge: creditCardsCount || undefined,
    },
    {
      id: 'goals',
      label: 'Potes dos Sonhos',
      shortLabel: 'Metas',
      icon: 'savings',
      badge: longTermGoals.length,
    },
    {
      id: 'freedom',
      label: 'Liberdade & Juros',
      shortLabel: 'Liberdade',
      icon: 'sailing',
    },
    {
      id: 'advice',
      label: 'Diagnóstico',
      shortLabel: 'Receita',
      icon: 'psychology',
    },
    {
      id: 'history',
      label: 'Histórico',
      shortLabel: 'Histórico',
      icon: 'calendar_month',
      badge: history.length || undefined,
    },
  ];

  // Tela Obrigatória de PIN (e Biometria Automática no PWA) desde o 1º Acesso
  if (isAppLocked) {
    const pwa = isRunningAsPwa();
    const hasBio = pwa && Boolean(hasRegisteredBiometrics());

    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-oat-100 relative overflow-hidden">
        {/* Plano de Fundo Atmosférico (Vila Costeira Cozy + Lagoa Maldivas) */}
        <motion.img
          src="/assets/marvit-lock-bg.jpg"
          alt=""
          aria-hidden="true"
          initial={{ scale: 1.07, opacity: 0 }}
          animate={{ scale: 1.02, opacity: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none"
        />

        {/* Véu Atmosférico Adaptativo (Modo Claro Cozy & Modo Escuro Velvet Slate) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#FAF6F0]/30 via-[#FAF6F0]/10 to-[#FAF6F0]/35 dark:from-[#0B0D11]/75 dark:via-[#0B0D11]/40 dark:to-[#0B0D11]/80 backdrop-blur-[1px]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(250,246,240,0.24)_0%,transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(11,13,17,0.52)_0%,transparent_68%)]"
        />

        <div className="fixed top-4 right-4 z-30">
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3.5 py-2 rounded-2xl bg-oat-50/90 dark:bg-surface-elevated/85 backdrop-blur-md border border-oat-300/90 dark:border-white/[0.12] text-espresso-800 text-xs font-bold flex items-center gap-2 shadow-cozy hover:border-maldives-500/60 transition cursor-pointer"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-maldives-600">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative z-10 bg-oat-50/85 dark:bg-[#14171D]/80 backdrop-blur-xl border border-white/75 dark:border-white/[0.12] rounded-[2rem] max-w-md w-full px-6 py-7 sm:px-8 sm:py-8 shadow-[0_28px_70px_-15px_rgba(12,15,20,0.35)] dark:shadow-[0_32px_80px_-12px_rgba(0,0,0,0.78)] text-center space-y-5"
        >
          {/* Mascote / Medalhão Central Ampliado */}
          <div className="flex justify-center pt-1">
            <motion.div
              className="relative group flex items-center justify-center w-44 h-44 sm:w-52 sm:h-52 cursor-pointer"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.05, rotate: 1.2 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Halo luminoso suave atrás da moeda */}
              <div
                aria-hidden="true"
                className="absolute inset-2 rounded-full bg-gradient-to-tr from-maldives-500/35 via-[#E8BE6A]/35 to-terracotta-400/25 blur-2xl opacity-75 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              />

              {/* Aro circular translúcido em volta do medalhão */}
              <div className="relative w-full h-full rounded-full p-1.5 bg-gradient-to-b from-white/70 via-white/25 to-white/10 dark:from-[#E9BE6A]/25 dark:via-white/[0.06] dark:to-white/[0.02] ring-1 ring-white/60 dark:ring-[#E9BE6A]/30 shadow-[0_18px_42px_-12px_rgba(15,17,21,0.45)] flex items-center justify-center overflow-hidden">
                <img
                  src="/assets/marvit-logo.png"
                  alt="Marvit & Finances Mascote"
                  className="w-full h-full object-contain rounded-full select-none pointer-events-none drop-shadow-xl"
                />
              </div>

              {/* Selo discreto de proteção no canto inferior */}
              <div
                aria-hidden="true"
                className="absolute bottom-1.5 right-2 w-10 h-10 rounded-2xl bg-oat-50/95 dark:bg-surface-elevated/95 backdrop-blur-md border border-oat-300/80 dark:border-white/[0.14] shadow-md flex items-center justify-center group-hover:scale-110 transition-transform duration-200"
              >
                <span className="material-symbols-outlined text-[20px] text-maldives-600 dark:text-[#E9BE6A]">
                  lock
                </span>
              </div>
            </motion.div>
          </div>

          {showFirstAccessChangePin ? (
            <div className="space-y-4">
              <div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300/60 dark:border-maldives-300/35 mb-2">
                  Primeiro Acesso Concluído
                </span>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-espresso-900">
                  Personalize seu PIN Secreto
                </h1>
                <p className="text-xs text-espresso-600 mt-1">
                  Você entrou com o PIN padrão (<strong>2026</strong>). Escolha agora seu próprio PIN pessoal para proteger seu planejamento.
                </p>
              </div>

              <form onSubmit={handleSaveFirstAccessNewPin} className="space-y-3">
                <input
                  type="password"
                  value={firstAccessNewPin}
                  onChange={(e) => setFirstAccessNewPin(e.target.value)}
                  placeholder="Digite seu novo PIN (mín. 4 dígitos)"
                  className="w-full bg-white/80 dark:bg-surface-input/90 border border-oat-300 dark:border-white/[0.10] rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
                />
                <input
                  type="password"
                  value={firstAccessConfirmPin}
                  onChange={(e) => setFirstAccessConfirmPin(e.target.value)}
                  placeholder="Confirme seu novo PIN"
                  className="w-full bg-white/80 dark:bg-surface-input/90 border border-oat-300 dark:border-white/[0.10] rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
                />
                {lockError && (
                  <p className="text-xs text-terracotta-600 font-semibold">
                    {lockError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={lockLoading}
                  className="w-full py-3 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white text-xs sm:text-sm font-bold transition shadow-md cursor-pointer"
                >
                  {lockLoading ? 'Salvando Novo PIN...' : 'Salvar Meu Novo PIN'}
                </button>
                <button
                  type="button"
                  onClick={handleSkipFirstAccessPinChange}
                  className="w-full py-2 rounded-xl text-espresso-600 hover:text-espresso-900 text-xs font-semibold transition cursor-pointer"
                >
                  Manter PIN atual e alterar depois
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <InteractiveBrandTitle text="Marvit & Finances" isDark={isDark} />
                <p className="text-xs text-espresso-600">
                  {hasBio
                    ? 'Valide sua Biometria ou digite seu PIN para abrir seu planejamento financeiro.'
                    : 'Digite seu PIN de acesso para abrir seu planejamento financeiro.'}
                </p>
              </div>

              {hasBio && (
                <button
                  type="button"
                  disabled={lockLoading}
                  onClick={() => handleUnlockAppWithBiometrics(false)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xl">
                    fingerprint
                  </span>
                  <span>Desbloquear com FaceID / Biometria</span>
                </button>
              )}

              <form onSubmit={handleUnlockAppWithPin} className="space-y-3">
                <input
                  type="password"
                  value={lockPinInput}
                  onChange={(e) => setLockPinInput(e.target.value)}
                  placeholder="Digite seu PIN secreto..."
                  className="w-full bg-white/80 dark:bg-surface-input/90 border border-oat-300 dark:border-white/[0.10] rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold text-espresso-900 placeholder:text-espresso-400 focus:outline-none focus:border-maldives-500"
                />
                {lockError && (
                  <p className="text-xs text-terracotta-600 font-semibold">
                    {lockError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={lockLoading}
                  className="w-full py-3 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white text-xs sm:text-sm font-bold transition shadow-md cursor-pointer"
                >
                  {lockLoading ? 'Verificando PIN...' : 'Entrar com PIN'}
                </button>
              </form>

              <p className="text-[11px] text-espresso-600 pt-1">
                Primeiro acesso? Utilize o PIN padrão inicial:{' '}
                <strong className="font-mono text-maldives-700 dark:text-[#65D0E0]">2026</strong>
              </p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden flex flex-col pb-28 md:pb-12 pt-safe">
      {/* Input acessível para importar JSON (compatível com iOS/Android/PWA) */}
      <input
        id="marvit-restore-json-input"
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportJsonFile}
        className="sr-only"
      />

      {/* Toast Flutuante */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 inset-x-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-surface-ink text-white px-4 py-2.5 rounded-2xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-maldives-400/50"
          >
            <span className="material-symbols-outlined text-maldives-400 text-base shrink-0">
              check_circle
            </span>
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho Principal */}
      <header className="sticky top-0 z-30 w-full bg-oat-100/85 dark:bg-oat-100/80 backdrop-blur-xl border-b border-oat-300/80 dark:border-white/[0.06] transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <InteractiveAsset
              src="/assets/marvit-logo.png"
              alt="Marvit&Finances Logo"
              size="sm"
              tone="maldives"
              floatAnimation={false}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] sm:text-xl font-display font-extrabold text-espresso-900 tracking-tight whitespace-nowrap">
                  Marvit<span className="text-maldives-600">&</span>Finances
                </h1>
              </div>
              <p className="text-[11px] text-espresso-600 hidden sm:block truncate">
                Orçamento por pilares, Potes dos Sonhos & Liberdade Financeira
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Alternador de Tema Claro / Escuro */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-oat-50 dark:bg-oat-200/70 hover:bg-oat-200 text-espresso-800 border border-oat-300 dark:border-white/[0.08] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title={isDark ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
            >
              <span className="material-symbols-outlined text-[17px] sm:text-[18px] text-maldives-600">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
              <span className="hidden lg:inline">
                {isDark ? 'Modo Claro' : 'Modo Escuro'}
              </span>
            </button>

            {/* Botão Instalar App PWA (Visível no cabeçalho a partir de sm, e no menu mobile) */}
            <button
              onClick={handleInstallPwa}
              className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-sage-100 hover:bg-sage-200 text-sage-600 border border-sage-300/80 dark:border-sage-300/35 text-xs font-bold transition items-center gap-1.5 cursor-pointer"
              title="Instalar aplicativo no celular ou computador (PWA)"
            >
              <span className="material-symbols-outlined text-[17px]">
                install_mobile
              </span>
              <span className="hidden lg:inline">App PWA</span>
            </button>

            {/* Botão Cofre & PIN (Acesso Geral Unificado) */}
            <button
              onClick={() => setIsVaultModalOpen(true)}
              className={`w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                vault
                  ? 'bg-maldives-50 border-maldives-300/70 dark:border-maldives-300/35 text-maldives-800'
                  : 'bg-oat-50 dark:bg-oat-200/70 border-oat-300 dark:border-white/[0.08] text-espresso-800 hover:border-maldives-400/60'
              }`}
              title="Acesso Geral Unificado (PC + Celular), Troca de PIN e Biometria"
            >
              <span className="material-symbols-outlined text-[17px] sm:text-[18px] text-maldives-600">
                {vault ? 'cloud_done' : 'passkey'}
              </span>
              <span className="hidden sm:inline">Cofre & PIN</span>
            </button>

            {/* Menu de Exportação e Backup */}
            <div className="relative">
              <button
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                className="w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                title="Exportar relatórios, backup e instalar PWA"
              >
                <span className="material-symbols-outlined text-[17px] sm:text-[18px]">
                  ios_share
                </span>
                <span className="hidden sm:inline">Exportar</span>
              </button>

              <AnimatePresence>
                {isExportMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsExportMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      className="absolute right-0 mt-2 w-64 bg-surface-elevated border border-oat-300 dark:border-white/[0.09] rounded-2xl shadow-cozy-lg p-2 z-50 space-y-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          handleInstallPwa();
                        }}
                        className="sm:hidden w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-sage-600 hover:bg-sage-50 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sage-600 text-lg">
                          install_mobile
                        </span>
                        <span>Instalar Aplicativo (PWA)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportPng}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-maldives-600 text-lg">
                          image
                        </span>
                        <span>Relatório Gráfico (.PNG)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportMarkdown}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sage-600 text-lg">
                          description
                        </span>
                        <span>Resumo Executivo (.MD)</span>
                      </button>

                      <div className="border-t border-oat-200 my-1" />

                      <button
                        type="button"
                        onClick={handleExportBackupJson}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-terracotta-600 text-lg">
                          download
                        </span>
                        <span>Baixar Backup Completo (.JSON)</span>
                      </button>

                      <label
                        htmlFor="marvit-restore-json-input"
                        onClick={() => setIsExportMenuOpen(false)}
                        className="w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-espresso-600 text-lg">
                          upload_file
                        </span>
                        <span>Restaurar Backup (.JSON)</span>
                      </label>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Botão Bloquear Tela (PIN) */}
            <button
              onClick={() => {
                sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
                setIsAppLocked(true);
              }}
              className="w-8 h-8 sm:w-auto sm:h-auto sm:p-1.5 rounded-xl bg-oat-50 dark:bg-oat-200/70 hover:bg-terracotta-50 text-espresso-600 hover:text-terracotta-600 border border-oat-300 dark:border-white/[0.08] transition flex items-center justify-center cursor-pointer"
              title="Bloquear aplicação com PIN"
            >
              <span className="material-symbols-outlined text-[17px] sm:text-[18px]">
                lock
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-5 space-y-3.5 sm:space-y-5 flex-1">
        {/* Calendário Interativo de Meses para transitar e preencher/editar qualquer competência */}
        <MonthCalendarBar
          selectedMonthKey={selectedMonthKey}
          onSelectMonth={handleSelectMonth}
          monthsData={syncedMonthsData}
          currentMonthNotes={currentMonthNotes}
          onChangeMonthNotes={handleChangeMonthNotes}
          onCopyFromPreviousMonth={handleCopyFromPreviousMonth}
          linkedGoalsMonthlyTotal={linkedGoalsMonthlyTotal}
        />

        {/* Card de Renda Líquida (No mobile aparece na aba Orçamento para não empurrar as outras abas para baixo; no desktop fica sempre visível) */}
        <div className={activeTab === 'budget' || isBentoMode ? 'block' : 'hidden md:block'}>
          <IncomeCard
            profile={profile}
            onChangeProfile={handleChangeProfile}
            balance={balance}
            totalExpenses={totalExpenses}
          />
        </div>

        {/* Barra de Navegação Desktop (Sliding Pill + Toggle Modo Bento) */}
        <div className="hidden md:flex items-center justify-between gap-4 bg-oat-50/90 dark:bg-oat-50 border border-oat-300 dark:border-white/[0.07] p-1.5 rounded-2xl shadow-cozy">
          <div className="flex items-center gap-1">
            {navItems.map((tab) => {
              const isActive = !isBentoMode && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setIsBentoMode(false);
                    setActiveTab(tab.id);
                  }}
                  className={`relative px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'text-white'
                      : 'text-espresso-700 hover:text-espresso-900 hover:bg-oat-100 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="desktopActiveTab"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 bg-maldives-500 rounded-xl shadow-sm"
                    />
                  )}
                  <span className="material-symbols-outlined text-[18px] relative z-10">
                    {tab.icon}
                  </span>
                  <span className="relative z-10">{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-white/25 text-white'
                          : 'bg-oat-200 dark:bg-white/[0.08] text-espresso-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsBentoMode(!isBentoMode)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
              isBentoMode
                ? 'bg-terracotta-500 text-white border-terracotta-600 shadow-sm'
                : 'bg-oat-100 dark:bg-oat-200/80 text-espresso-700 border-oat-300 dark:border-white/[0.07] hover:bg-oat-200'
            }`}
            title="Visualizar todos os painéis juntos estilo Pinterest Bento Grid"
          >
            <span className="material-symbols-outlined text-[18px]">
              grid_view
            </span>
            <span>{isBentoMode ? 'Modo Bento Ativo' : 'Ver Tudo (Bento)'}</span>
          </button>
        </div>

        {/* Área Dinâmica de Componentes com Transições Suaves */}
        {isBentoMode ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <FinancialOverview
              totalIncome={totalIncome}
              categoryTotals={categoryTotals}
              customGoals={customGoals}
              onUpdateGoalPercent={(cat, percent) => {
                markUserEdit();
                setCustomGoals((prev) => ({ ...prev, [cat]: percent }));
              }}
              onResetGoals={() => {
                markUserEdit();
                setCustomGoals({
                  essencial: AUVP_GOALS.essencial.idealPercent,
                  estilo: AUVP_GOALS.estilo.idealPercent,
                  investimento: AUVP_GOALS.investimento.idealPercent,
                });
              }}
            />
            <ExpenseManager
              expenses={combinedExpenses}
              selectedMonthKey={selectedMonthKey}
              availableMonthsToClone={availableMonthsToClone}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateExpense={handleUpdateExpense}
              onOpenCardsTab={handleOpenCardsTab}
              excludedGoals={excludedGoalsForCurrentMonth}
              onRestoreGoalContribution={handleRestoreGoalContribution}
              onCloneFromMonth={handleCloneBudgetFromMonth}
              onApplyPreset={handleApplyBudgetPreset}
            />
            <CreditCardsManager
              expenses={combinedExpenses}
              globalCards={globalCards}
              lifestyleIdealAmount={lifestyleIdealAmount}
              lifestyleTotalSpent={categoryTotals.estilo}
              selectedCardId={selectedCardId}
              selectedMonthKey={selectedMonthKey}
              onSelectCardId={setSelectedCardId}
              onAddGlobalCard={handleAddGlobalCard}
              onUpdateGlobalCard={handleUpdateGlobalCard}
              onDeleteGlobalCard={handleDeleteGlobalCard}
              onAddCardExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
              showToast={showToast}
            />
            <GoalsManager
              goals={longTermGoals}
              selectedMonthKey={selectedMonthKey}
              excludedGoalIds={excludedGoalIds}
              onToggleMonthExclusion={handleToggleGoalMonthExclusion}
              onAddGoal={handleAddLongTermGoal}
              onUpdateGoal={handleUpdateLongTermGoal}
              onDeleteGoal={handleDeleteLongTermGoal}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FreedomSimulator
                monthlyEssentialCost={categoryTotals.essencial}
                monthlyTotalCost={
                  categoryTotals.essencial + categoryTotals.estilo
                }
                monthlyInvestment={categoryTotals.investimento}
                profile={profile}
              />
              <AdvicePanel
                totalIncome={totalIncome}
                categoryTotals={categoryTotals}
                balance={balance}
              />
            </div>
            <FinancialCharts
              monthsData={syncedMonthsData}
              history={history}
              selectedMonthKey={selectedMonthKey}
              onSelectMonth={handleSelectMonth}
              currentMonthExpenses={combinedExpenses}
              profile={profile}
              customGoals={customGoals}
            />
            <CompoundInterestCalculator
              profile={profile}
              monthlyInvestmentAmount={categoryTotals.investimento}
              longTermGoals={longTermGoals}
            />
            <HistoryManager
              history={history}
              selectedMonthKey={selectedMonthKey}
              currentMonthNotes={currentMonthNotes}
              onSaveCurrentMonth={handleSaveCurrentMonth}
              onLoadSnapshot={handleLoadSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
            />
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="space-y-6"
            >
              {activeTab === 'budget' && (
                <div className="space-y-6">
                  <FinancialOverview
                    totalIncome={totalIncome}
                    categoryTotals={categoryTotals}
                    customGoals={customGoals}
                    onUpdateGoalPercent={(cat, percent) => {
                      markUserEdit();
                      setCustomGoals((prev) => ({ ...prev, [cat]: percent }));
                    }}
                    onResetGoals={() => {
                      markUserEdit();
                      setCustomGoals({
                        essencial: AUVP_GOALS.essencial.idealPercent,
                        estilo: AUVP_GOALS.estilo.idealPercent,
                        investimento: AUVP_GOALS.investimento.idealPercent,
                      });
                    }}
                  />

                  {/* Sub-navegador da aba Orçamento: Planilha vs Gráficos */}
                  <div className="flex items-center justify-between gap-2 bg-oat-50/90 dark:bg-oat-50 border border-oat-300 dark:border-white/[0.07] p-1 rounded-2xl shadow-xs">
                    <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setBudgetSubView('sheet')}
                        className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          budgetSubView === 'sheet'
                            ? 'bg-maldives-500 text-white shadow-xs'
                            : 'text-espresso-700 hover:text-espresso-900 hover:bg-oat-200/70 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] sm:text-[17px]">
                          table_chart
                        </span>
                        <span className="sm:hidden">Planilha</span>
                        <span className="hidden sm:inline">Planilha de Gastos & Aportes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBudgetSubView('charts')}
                        className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          budgetSubView === 'charts'
                            ? 'bg-maldives-500 text-white shadow-xs'
                            : 'text-espresso-700 hover:text-espresso-900 hover:bg-oat-200/70 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] sm:text-[17px]">
                          bar_chart
                        </span>
                        <span className="sm:hidden">Gráficos</span>
                        <span className="hidden sm:inline">Gráficos & Análises</span>
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-espresso-500 hidden sm:inline pr-2">
                      {budgetSubView === 'sheet'
                        ? `${combinedExpenses.length} lançamentos no mês`
                        : 'Média de gastos e comparativos'}
                    </span>
                  </div>

                  {budgetSubView === 'sheet' ? (
                    <ExpenseManager
                      expenses={combinedExpenses}
                      selectedMonthKey={selectedMonthKey}
                      availableMonthsToClone={availableMonthsToClone}
                      onAddExpense={handleAddExpense}
                      onDeleteExpense={handleDeleteExpense}
                      onUpdateExpense={handleUpdateExpense}
                      onOpenCardsTab={handleOpenCardsTab}
                      excludedGoals={excludedGoalsForCurrentMonth}
                      onRestoreGoalContribution={handleRestoreGoalContribution}
                      onCloneFromMonth={handleCloneBudgetFromMonth}
                      onApplyPreset={handleApplyBudgetPreset}
                    />
                  ) : (
                    <FinancialCharts
                      monthsData={syncedMonthsData}
                      history={history}
                      selectedMonthKey={selectedMonthKey}
                      onSelectMonth={handleSelectMonth}
                      currentMonthExpenses={combinedExpenses}
                      profile={profile}
                      customGoals={customGoals}
                    />
                  )}
                </div>
              )}

              {activeTab === 'cards' && (
                <CreditCardsManager
                  expenses={combinedExpenses}
                  globalCards={globalCards}
                  lifestyleIdealAmount={lifestyleIdealAmount}
                  lifestyleTotalSpent={categoryTotals.estilo}
                  selectedCardId={selectedCardId}
                  selectedMonthKey={selectedMonthKey}
                  onSelectCardId={setSelectedCardId}
                  onAddGlobalCard={handleAddGlobalCard}
                  onUpdateGlobalCard={handleUpdateGlobalCard}
                  onDeleteGlobalCard={handleDeleteGlobalCard}
                  onAddCardExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onDeleteExpense={handleDeleteExpense}
                  showToast={showToast}
                />
              )}

              {activeTab === 'goals' && (
                <GoalsManager
                  goals={longTermGoals}
                  selectedMonthKey={selectedMonthKey}
                  excludedGoalIds={excludedGoalIds}
                  onToggleMonthExclusion={handleToggleGoalMonthExclusion}
                  onAddGoal={handleAddLongTermGoal}
                  onUpdateGoal={handleUpdateLongTermGoal}
                  onDeleteGoal={handleDeleteLongTermGoal}
                />
              )}

              {activeTab === 'freedom' && (
                <div className="space-y-6">
                  {/* Sub-navegador da aba Liberdade: Simulador FIRE vs Calculadora de Juros */}
                  <div className="flex items-center justify-between gap-2 bg-oat-50/90 dark:bg-oat-50 border border-oat-300 dark:border-white/[0.07] p-1 rounded-2xl shadow-xs">
                    <div className="grid grid-cols-2 sm:flex items-center gap-1 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setFreedomSubView('fire')}
                        className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          freedomSubView === 'fire'
                            ? 'bg-maldives-500 text-white shadow-xs'
                            : 'text-espresso-700 hover:text-espresso-900 hover:bg-oat-200/70 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] sm:text-[17px]">
                          sailing
                        </span>
                        <span className="sm:hidden">Simulador FIRE</span>
                        <span className="hidden sm:inline">Simulador FIRE (Independência)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFreedomSubView('compound')}
                        className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          freedomSubView === 'compound'
                            ? 'bg-maldives-500 text-white shadow-xs'
                            : 'text-espresso-700 hover:text-espresso-900 hover:bg-oat-200/70 dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] sm:text-[17px]">
                          calculate
                        </span>
                        <span className="sm:hidden">Juros Compostos</span>
                        <span className="hidden sm:inline">Calculadora de Juros Compostos</span>
                      </button>
                    </div>

                    <span className="text-[11px] font-mono text-espresso-500 hidden sm:inline pr-2">
                      {freedomSubView === 'fire'
                        ? 'Regra dos 4% & Ponto de Equilíbrio'
                        : 'Previsão de Aportes & Simulador'}
                    </span>
                  </div>

                  {freedomSubView === 'fire' ? (
                    <FreedomSimulator
                      monthlyEssentialCost={categoryTotals.essencial}
                      monthlyTotalCost={
                        categoryTotals.essencial + categoryTotals.estilo
                      }
                      monthlyInvestment={categoryTotals.investimento}
                      profile={profile}
                    />
                  ) : (
                    <CompoundInterestCalculator
                      profile={profile}
                      monthlyInvestmentAmount={categoryTotals.investimento}
                      longTermGoals={longTermGoals}
                    />
                  )}
                </div>
              )}

              {activeTab === 'advice' && (
                <AdvicePanel
                  totalIncome={totalIncome}
                  categoryTotals={categoryTotals}
                  balance={balance}
                />
              )}

              {activeTab === 'history' && (
                <HistoryManager
                  history={history}
                  selectedMonthKey={selectedMonthKey}
                  currentMonthNotes={currentMonthNotes}
                  onSaveCurrentMonth={handleSaveCurrentMonth}
                  onLoadSnapshot={handleLoadSnapshot}
                  onDeleteSnapshot={handleDeleteSnapshot}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Bottom Navigation Bar Responsiva para Mobile & PWA (iOS e Android) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-oat-50/92 dark:bg-surface-elevated/92 backdrop-blur-xl border-t border-oat-300 dark:border-white/[0.08] pb-safe shadow-cozy-lg">
        <div className="grid grid-cols-6 px-1 pt-1.5 pb-1">
          {navItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setIsBentoMode(false);
                  setActiveTab(tab.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition cursor-pointer min-w-0 ${
                  isActive
                    ? 'text-maldives-700 font-extrabold'
                    : 'text-espresso-500 hover:text-espresso-800'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 bg-maldives-100/90 rounded-xl -z-10"
                  />
                )}
                <span className="material-symbols-outlined text-[19px]">
                  {tab.icon}
                </span>
                <span className="text-[9.5px] sm:text-[10px] mt-0.5 tracking-tight truncate w-full text-center">
                  {tab.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Pop-up de Exportação & Seleção de Onde Salvar (Especialmente otimizado para Mobile & PWA) */}
      <AnimatePresence>
        {pendingExportFile && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPendingExportFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-surface-elevated border border-oat-300 dark:border-white/[0.09] rounded-3xl max-w-md w-full p-5 shadow-cozy-lg space-y-4 max-h-[88vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-oat-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-maldives-600 text-2xl">
                      {pendingExportFile.kind === 'png'
                        ? 'image'
                        : pendingExportFile.kind === 'md'
                        ? 'description'
                        : 'folder_zip'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-maldives-700 block">
                      Arquivo Pronto para Salvar
                    </span>
                    <h3 className="text-base font-display font-bold text-espresso-900 truncate">
                      {pendingExportFile.title}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingExportFile(null)}
                  className="p-1.5 rounded-xl text-espresso-500 hover:text-espresso-900 hover:bg-oat-200 transition cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-oat-100 border border-oat-300 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-espresso-900 truncate">
                    {pendingExportFile.filename}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-oat-200 text-espresso-700 shrink-0">
                    {Math.max(
                      1,
                      Math.round(pendingExportFile.blob.size / 1024)
                    )}{' '}
                    KB
                  </span>
                </div>
                <p className="text-[11px] text-espresso-600">
                  {pendingExportFile.subtitle}
                </p>
              </div>

              {pendingExportFile.previewDataUrl && (
                <div className="rounded-2xl overflow-hidden border border-oat-300 bg-oat-100 max-h-52 flex items-center justify-center p-2">
                  <img
                    src={pendingExportFile.previewDataUrl}
                    alt={pendingExportFile.filename}
                    className="max-h-48 w-auto object-contain rounded-xl shadow-xs"
                  />
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                {canUseNativeMobileShare(pendingExportFile) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await saveExportedFileWithPrompt(
                        pendingExportFile,
                        'share'
                      );
                      if (res === 'shared' || res === 'picked') {
                        setPendingExportFile(null);
                        showToast(
                          `Arquivo "${pendingExportFile.filename}" salvo com sucesso!`
                        );
                      }
                    }}
                    className="w-full py-3 px-4 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      folder_open
                    </span>
                    <span>
                      Escolher Onde Salvar (Arquivos / Drive / App)
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    await saveExportedFileWithPrompt(
                      pendingExportFile,
                      'download'
                    );
                    setPendingExportFile(null);
                    showToast(
                      `Download de "${pendingExportFile.filename}" iniciado!`
                    );
                  }}
                  className={`w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer border ${
                    canUseNativeMobileShare(pendingExportFile)
                      ? 'bg-oat-100 hover:bg-oat-200 text-espresso-900 border-oat-300'
                      : 'bg-maldives-500 hover:bg-maldives-600 text-white border-maldives-600 shadow-md'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    download
                  </span>
                  <span>Salvar na Pasta Downloads do Aparelho</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Importação Inteligente (Mês Isolado vs Todos os Meses) */}
      <SingleMonthImportModal
        isOpen={isSingleMonthModalOpen}
        onClose={() => {
          setIsSingleMonthModalOpen(false);
          setSingleMonthModalPayload(null);
          importGuardUntilRef.current = 0;
        }}
        backupPayload={singleMonthModalPayload}
        onImportSingleMonth={handleImportSingleMonth}
        onImportFullBackup={handleImportBackupPayload}
      />

      {/* Modal de Cofre na Nuvem, Troca de PIN & Biometria */}
      <VaultAuthModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        vault={vault}
        onUpdateVault={handleUpdateVault}
        currentBackupPayload={currentBackupPayload}
        onRestorePayload={handleRestorePayload}
      />
    </div>
  );
};

export default App;
