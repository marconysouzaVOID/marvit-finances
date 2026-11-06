import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AUVP_GOALS,
  INITIAL_EXPENSES,
  INITIAL_LONG_TERM_GOALS,
} from './constants';
import {
  CustomGoalItem,
  ExpenseCategory,
  ExpenseItem,
  FinancialProfile,
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
import {
  formatMonthKeyLabel,
  getCurrentMonthKey,
  MonthCalendarBar,
  shiftMonthKey,
} from './components/MonthCalendarBar';
import { VaultAuthModal } from './components/VaultAuthModal';
import { generateReportImageBase64 } from './utils/exportCanvas';
import {
  downloadBase64Png,
  exportBackupJson,
  exportMarkdownReport,
} from './utils/sourceExporter';
import {
  DEFAULT_INITIAL_PIN,
  DEFAULT_VAULT_ID,
  hashPin,
  pullVaultFromCloud,
  pushVaultToCloud,
} from './utils/cloudSync';
import {
  hasRegisteredBiometrics,
  isBiometricsSupported,
  isRunningAsPwa,
  registerBiometricVault,
  unlockWithBiometrics,
} from './utils/biometricAuth';

type ActiveTab =
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

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getCurrentMonthKey()
  );
  const [monthsData, setMonthsData] = useState<Record<string, MonthDataRecord>>(
    {}
  );
  const [currentMonthNotes, setCurrentMonthNotes] = useState<string>('');

  const [profile, setProfile] = useState<FinancialProfile>({
    monthlyIncome: 7500,
    additionalIncome: 500,
    desiredEmergencyMonths: 6,
    expectedAnnualReturnRate: 10.5,
  });

  const [customGoals, setCustomGoals] = useState<Record<ExpenseCategory, number>>({
    essencial: 50,
    estilo: 30,
    investimento: 20,
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>(INITIAL_EXPENSES);
  const [longTermGoals, setLongTermGoals] = useState<CustomGoalItem[]>(
    INITIAL_LONG_TERM_GOALS
  );
  const [history, setHistory] = useState<MonthSnapshot[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('budget');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isBentoMode, setIsBentoMode] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [vault, setVault] = useState<VaultCredentials | null>(null);

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isInitialLoad = useRef(true);

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
      metaTheme.setAttribute('content', isDark ? '#071217' : '#FAF6F0');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Carregar estado salvo no LocalStorage e checar parâmetros de atalho PWA
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<MarvitBackupData>;
        const initialKey = parsed.selectedMonthKey || getCurrentMonthKey();
        setSelectedMonthKey(initialKey);

        if (parsed.monthsData && parsed.monthsData[initialKey]) {
          const monthRec = parsed.monthsData[initialKey];
          setMonthsData(parsed.monthsData);
          setProfile(monthRec.profile);
          setCustomGoals(monthRec.customGoals);
          setExpenses(monthRec.expenses);
          setCurrentMonthNotes(monthRec.notes || '');
        } else {
          if (parsed.monthsData) setMonthsData(parsed.monthsData);
          if (parsed.profile) setProfile(parsed.profile);
          if (parsed.customGoals) setCustomGoals(parsed.customGoals);
          if (parsed.expenses) setExpenses(parsed.expenses);
        }

        if (parsed.customLongTermGoals) {
          setLongTermGoals(parsed.customLongTermGoals);
        }
        if (parsed.history) setHistory(parsed.history);
      }

      const savedVault = localStorage.getItem(VAULT_SESSION_KEY);
      if (savedVault) {
        const parsedVault = JSON.parse(savedVault) as VaultCredentials;
        setVault({
          ...parsedVault,
          vaultId: DEFAULT_VAULT_ID,
          autoSync: true,
        });
      }
    } catch {
      // Ignora erro de parse
    }

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

  // Sincronização automática da Conta Geral Unificada (PC + Celular) ao focar a janela/aba
  useEffect(() => {
    if (isAppLocked || !vault?.pinHash) return;

    const syncFromCloud = async () => {
      const res = await pullVaultFromCloud(DEFAULT_VAULT_ID, vault.pinHash);
      if (res.ok && res.data) {
        handleRestorePayload(res.data, true);
      }
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

  // Sempre que os dados do mês atual mudarem (profile, customGoals, expenses, currentMonthNotes), sincroniza em monthsData[selectedMonthKey]
  const syncedMonthsData = useMemo<Record<string, MonthDataRecord>>(() => {
    const manualOnly = expenses.filter((e) => !e.linkedGoalId);
    return {
      ...monthsData,
      [selectedMonthKey]: {
        monthKey: selectedMonthKey,
        updatedAt: new Date().toISOString(),
        profile,
        customGoals,
        expenses: manualOnly,
        notes: currentMonthNotes.trim() || undefined,
      },
    };
  }, [
    monthsData,
    selectedMonthKey,
    profile,
    customGoals,
    expenses,
    currentMonthNotes,
  ]);

  // Transitar entre os meses do calendário
  const handleSelectMonth = (nextMonthKey: string) => {
    if (nextMonthKey === selectedMonthKey) return;

    // Salva o estado do mês atual no dicionário antes de trocar
    const updatedMap = { ...syncedMonthsData };
    setMonthsData(updatedMap);
    setSelectedMonthKey(nextMonthKey);

    const existingTarget = updatedMap[nextMonthKey];
    if (existingTarget) {
      setProfile(existingTarget.profile);
      setCustomGoals(existingTarget.customGoals);
      setExpenses(existingTarget.expenses);
      setCurrentMonthNotes(existingTarget.notes || '');
      showToast(`Editando ${formatMonthKeyLabel(nextMonthKey)}`);
    } else {
      // Novo mês ainda não preenchido: mantém a renda/metas base e despesas recorrentes para edição
      const cleanManual = expenses
        .filter((e) => !e.linkedGoalId)
        .map((e) => ({ ...e }));
      setExpenses(cleanManual);
      setCurrentMonthNotes('');
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

    setProfile({ ...prevRecord.profile });
    setCustomGoals({ ...prevRecord.customGoals });
    setExpenses(prevRecord.expenses.map((e) => ({ ...e })));
    setCurrentMonthNotes(prevRecord.notes || '');
    showToast(
      `Dados copiados de ${formatMonthKeyLabel(prevKey)} para ${formatMonthKeyLabel(selectedMonthKey)}!`
    );
  };

  // Combinar despesas manuais do mês selecionado + aportes vinculados das Metas Personalizadas
  const combinedExpenses = useMemo<ExpenseItem[]>(() => {
    const manualOnly = expenses.filter((e) => !e.linkedGoalId);
    const linkedFromGoals: ExpenseItem[] = longTermGoals
      .filter((g) => g.syncWithBudget && g.monthlyContribution > 0)
      .map((g) => ({
        id: `goal-exp-${g.id}`,
        name: `🎯 Pote: ${g.title}`,
        amount: g.monthlyContribution,
        category: g.budgetCategory,
        linkedGoalId: g.id,
      }));
    return [...manualOnly, ...linkedFromGoals];
  }, [expenses, longTermGoals]);

  const linkedGoalsMonthlyTotal = useMemo(
    () =>
      longTermGoals
        .filter((g) => g.syncWithBudget && g.monthlyContribution > 0)
        .reduce((acc, g) => acc + g.monthlyContribution, 0),
    [longTermGoals]
  );

  const currentBackupPayload = useMemo<MarvitBackupData>(
    () => ({
      version: '2.2.0',
      appName: 'Marvit&Finances',
      exportedAt: new Date().toISOString(),
      selectedMonthKey,
      monthsData: syncedMonthsData,
      profile,
      customGoals,
      expenses: expenses.filter((e) => !e.linkedGoalId),
      customLongTermGoals: longTermGoals,
      history,
    }),
    [
      selectedMonthKey,
      syncedMonthsData,
      profile,
      customGoals,
      expenses,
      longTermGoals,
      history,
    ]
  );

  // Salvar automaticamente no LocalStorage e sincronizar na nuvem com debounce se ativo
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBackupPayload));
    } catch {
      // Ignora quota error
    }

    if (!isAppLocked && vault && vault.autoSync) {
      const timer = setTimeout(() => {
        pushVaultToCloud(vault.vaultId, vault.pinHash, currentBackupPayload).catch(
          () => {}
        );
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentBackupPayload, vault, isAppLocked]);

  const handleUpdateVault = (nextVault: VaultCredentials | null) => {
    setVault(nextVault);
    if (nextVault) {
      localStorage.setItem(VAULT_SESSION_KEY, JSON.stringify(nextVault));
    } else {
      localStorage.removeItem(VAULT_SESSION_KEY);
    }
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
    const newId = `exp-${Date.now()}`;
    setExpenses((prev) => [
      { ...newItem, id: newId },
      ...prev,
    ]);
    if (newItem.category === 'estilo' && newItem.subcategory === 'cartao') {
      setSelectedCardId(newId);
      showToast('Cartão de Crédito adicionado ao Estilo de Vida!');
    } else {
      showToast('Item adicionado ao mês!');
    }
  };

  const handleOpenCardsTab = (cardId?: string) => {
    if (cardId) setSelectedCardId(cardId);
    setIsBentoMode(false);
    setActiveTab('cards');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateExpense = (id: string, updated: Partial<ExpenseItem>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updated } : e))
    );
  };

  // Handlers de Metas de Longo Prazo
  const handleAddLongTermGoal = (goal: Omit<CustomGoalItem, 'id'>) => {
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
    setLongTermGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...updated } : g))
    );
  };

  const handleDeleteLongTermGoal = (id: string) => {
    setLongTermGoals((prev) => prev.filter((g) => g.id !== id));
  };

  // Handlers de Histórico
  const handleSaveCurrentMonth = (monthLabel: string, notes?: string) => {
    const snapshot: MonthSnapshot = {
      id: `snap-${Date.now()}`,
      monthLabel,
      dateCreated: new Date().toISOString(),
      profile: { ...profile },
      customGoals: { ...customGoals },
      expenses: combinedExpenses.map((e) => ({ ...e })),
      customLongTermGoals: longTermGoals.map((g) => ({ ...g })),
      notes: notes || currentMonthNotes || undefined,
    };
    setHistory((prev) => [snapshot, ...prev]);
    showToast(`Mês "${monthLabel}" salvo no histórico!`);
  };

  const handleLoadSnapshot = (snapshot: MonthSnapshot) => {
    setProfile(snapshot.profile);
    setCustomGoals(snapshot.customGoals);
    setExpenses(snapshot.expenses.filter((e) => !e.linkedGoalId));
    if (snapshot.customLongTermGoals) {
      setLongTermGoals(snapshot.customLongTermGoals);
    }
    if (snapshot.notes) {
      setCurrentMonthNotes(snapshot.notes);
    }
    showToast(`Mês "${snapshot.monthLabel}" restaurado para a tela!`);
  };

  const handleDeleteSnapshot = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  // Exportações
  const handleExportPng = async () => {
    try {
      setIsExportMenuOpen(false);
      showToast('Gerando relatório gráfico em alta resolução...');
      const base64 = await generateReportImageBase64({
        profile,
        customGoals,
        categoryTotals,
        expenses: combinedExpenses,
        customLongTermGoals: longTermGoals,
        totalIncome,
        totalExpenses,
        balance,
      });
      const dateTag = new Date().toISOString().slice(0, 10);
      downloadBase64Png(base64, `marvit-finances-relatorio-${dateTag}.png`);
      showToast('Relatório PNG baixado com sucesso!');
    } catch {
      showToast('Não foi possível gerar a imagem PNG.');
    }
  };

  const handleRestorePayload = (payload: MarvitBackupData, silent = false) => {
    const targetMonth = payload.selectedMonthKey || selectedMonthKey;
    setSelectedMonthKey(targetMonth);

    if (payload.monthsData) {
      setMonthsData(payload.monthsData);
      const activeRec = payload.monthsData[targetMonth];
      if (activeRec) {
        setProfile(activeRec.profile);
        setCustomGoals(activeRec.customGoals);
        setExpenses(activeRec.expenses);
        setCurrentMonthNotes(activeRec.notes || '');
      } else {
        if (payload.profile) setProfile(payload.profile);
        if (payload.customGoals) setCustomGoals(payload.customGoals);
        if (payload.expenses) setExpenses(payload.expenses);
      }
    } else {
      if (payload.profile) setProfile(payload.profile);
      if (payload.customGoals) setCustomGoals(payload.customGoals);
      if (payload.expenses) setExpenses(payload.expenses);
    }

    if (payload.customLongTermGoals) {
      setLongTermGoals(payload.customLongTermGoals);
    }
    if (payload.history) setHistory(payload.history);
    if (!silent) {
      showToast('Backup restaurado com sucesso!');
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as MarvitBackupData;
        handleRestorePayload(parsed);
      } catch {
        showToast('Arquivo JSON inválido.');
      }
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
      label: 'Orçamento & Planilha',
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
      label: 'Simulador FIRE',
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-oat-100 relative">
        <div className="fixed top-4 right-4 z-30">
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3.5 py-2 rounded-2xl bg-oat-50 border border-oat-300 text-espresso-800 text-xs font-bold flex items-center gap-2 shadow-cozy hover:border-maldives-500 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-maldives-600">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-oat-50 border-2 border-oat-300 rounded-3xl max-w-md w-full p-7 shadow-cozy-lg text-center space-y-5"
        >
          <div className="flex justify-center">
            <InteractiveAsset
              src="/assets/marvit-logo.png"
              alt="Marvit&Finances Mascote"
              size="xl"
              tone="maldives"
              badgeIcon="lock"
            />
          </div>

          {showFirstAccessChangePin ? (
            <div className="space-y-4">
              <div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300 mb-2">
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
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
                <input
                  type="password"
                  value={firstAccessConfirmPin}
                  onChange={(e) => setFirstAccessConfirmPin(e.target.value)}
                  placeholder="Confirme seu novo PIN"
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
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
              <div>
                <h1 className="text-2xl font-display font-bold text-espresso-900">
                  Cofre Marvit Protegido
                </h1>
                <p className="text-xs text-espresso-600 mt-1">
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
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-4 py-2.5 text-center text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
                {lockError && (
                  <p className="text-xs text-terracotta-600 font-semibold">
                    {lockError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={lockLoading}
                  className="w-full py-3 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer"
                >
                  {lockLoading ? 'Verificando PIN...' : 'Entrar com PIN'}
                </button>
              </form>

              <p className="text-[11px] text-espresso-500 pt-1">
                Primeiro acesso? Utilize o PIN padrão inicial:{' '}
                <strong className="font-mono text-maldives-700">2026</strong>
              </p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden flex flex-col pb-28 md:pb-12 pt-safe">
      {/* Input oculto para importar JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportJsonFile}
        className="hidden"
      />

      {/* Toast Flutuante */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 inset-x-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 bg-espresso-900 text-oat-50 px-4 py-2.5 rounded-2xl shadow-lg text-xs font-semibold flex items-center gap-2 border border-maldives-400"
          >
            <span className="material-symbols-outlined text-maldives-400 text-base shrink-0">
              check_circle
            </span>
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabeçalho Principal */}
      <header className="sticky top-0 z-30 w-full bg-oat-100/85 backdrop-blur-md border-b border-oat-300/80 transition-colors">
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
              className="w-8 h-8 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-oat-50 hover:bg-oat-200 text-espresso-800 border border-oat-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
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
              className="hidden sm:flex px-2.5 py-1.5 rounded-xl bg-sage-100 hover:bg-sage-200 text-sage-600 border border-sage-300 text-xs font-bold transition items-center gap-1.5 cursor-pointer"
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
                  ? 'bg-maldives-50 border-maldives-300 text-maldives-800'
                  : 'bg-oat-50 border-oat-300 text-espresso-800 hover:border-maldives-400'
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
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 mt-2 w-60 bg-oat-50 border-2 border-oat-300 rounded-2xl shadow-cozy-lg p-2 z-50 space-y-1"
                  >
                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        handleInstallPwa();
                      }}
                      className="sm:hidden w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-sage-600 hover:bg-sage-50 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sage-600 text-lg">
                        install_mobile
                      </span>
                      <span>Instalar Aplicativo (PWA)</span>
                    </button>

                    <button
                      onClick={handleExportPng}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-maldives-600 text-lg">
                        image
                      </span>
                      <span>Relatório Gráfico (.PNG)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        exportMarkdownReport({
                          profile,
                          customGoals,
                          categoryTotals,
                          expenses: combinedExpenses,
                          customLongTermGoals: longTermGoals,
                          totalIncome,
                          totalExpenses,
                          balance,
                        });
                        showToast('Relatório Markdown exportado!');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sage-600 text-lg">
                        description
                      </span>
                      <span>Resumo Executivo (.MD)</span>
                    </button>

                    <div className="border-t border-oat-200 my-1" />

                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        exportBackupJson(currentBackupPayload);
                        showToast('Arquivo de Backup JSON salvo!');
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-terracotta-600 text-lg">
                        download
                      </span>
                      <span>Baixar Backup Completo (.JSON)</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3 py-2 rounded-xl text-left text-xs font-bold text-espresso-800 hover:bg-maldives-50 hover:text-maldives-800 flex items-center gap-2.5 transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-espresso-600 text-lg">
                        upload_file
                      </span>
                      <span>Restaurar Backup (.JSON)</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Botão Bloquear Tela (PIN) */}
            <button
              onClick={() => {
                sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
                setIsAppLocked(true);
              }}
              className="w-8 h-8 sm:w-auto sm:h-auto sm:p-1.5 rounded-xl bg-oat-50 hover:bg-terracotta-50 text-espresso-600 hover:text-terracotta-600 border border-oat-300 transition flex items-center justify-center cursor-pointer"
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
      <main className="max-w-7xl w-full mx-auto px-3.5 sm:px-6 pt-4 sm:pt-5 space-y-4 sm:space-y-5 flex-1">
        {/* Calendário Interativo de Meses para transitar e preencher/editar qualquer competência */}
        <MonthCalendarBar
          selectedMonthKey={selectedMonthKey}
          onSelectMonth={handleSelectMonth}
          monthsData={syncedMonthsData}
          currentMonthNotes={currentMonthNotes}
          onChangeMonthNotes={setCurrentMonthNotes}
          onCopyFromPreviousMonth={handleCopyFromPreviousMonth}
          linkedGoalsMonthlyTotal={linkedGoalsMonthlyTotal}
        />

        {/* Card de Renda Líquida (No mobile aparece na aba Orçamento para não empurrar as outras abas para baixo; no desktop fica sempre visível) */}
        <div className={activeTab === 'budget' || isBentoMode ? 'block' : 'hidden md:block'}>
          <IncomeCard
            profile={profile}
            onChangeProfile={setProfile}
            balance={balance}
            totalExpenses={totalExpenses}
          />
        </div>

        {/* Barra de Navegação Desktop (Sliding Pill + Toggle Modo Bento) */}
        <div className="hidden md:flex items-center justify-between gap-4 bg-oat-50/90 border border-oat-300 p-1.5 rounded-2xl shadow-sm">
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
                      : 'text-espresso-700 hover:text-espresso-900 hover:bg-oat-100'
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
                          : 'bg-oat-200 text-espresso-700'
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
                : 'bg-oat-100 text-espresso-700 border-oat-300 hover:bg-oat-200'
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
              onUpdateGoalPercent={(cat, percent) =>
                setCustomGoals((prev) => ({ ...prev, [cat]: percent }))
              }
              onResetGoals={() =>
                setCustomGoals({
                  essencial: AUVP_GOALS.essencial.idealPercent,
                  estilo: AUVP_GOALS.estilo.idealPercent,
                  investimento: AUVP_GOALS.investimento.idealPercent,
                })
              }
            />
            <ExpenseManager
              expenses={combinedExpenses}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onUpdateExpense={handleUpdateExpense}
              onOpenCardsTab={handleOpenCardsTab}
            />
            <CreditCardsManager
              expenses={combinedExpenses}
              lifestyleIdealAmount={lifestyleIdealAmount}
              lifestyleTotalSpent={categoryTotals.estilo}
              selectedCardId={selectedCardId}
              onSelectCardId={setSelectedCardId}
              onAddCardExpense={handleAddExpense}
              onUpdateExpense={handleUpdateExpense}
              onDeleteExpense={handleDeleteExpense}
            />
            <GoalsManager
              goals={longTermGoals}
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
            <HistoryManager
              history={history}
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
                <>
                  <FinancialOverview
                    totalIncome={totalIncome}
                    categoryTotals={categoryTotals}
                    customGoals={customGoals}
                    onUpdateGoalPercent={(cat, percent) =>
                      setCustomGoals((prev) => ({ ...prev, [cat]: percent }))
                    }
                    onResetGoals={() =>
                      setCustomGoals({
                        essencial: AUVP_GOALS.essencial.idealPercent,
                        estilo: AUVP_GOALS.estilo.idealPercent,
                        investimento: AUVP_GOALS.investimento.idealPercent,
                      })
                    }
                  />
                  <ExpenseManager
                    expenses={combinedExpenses}
                    onAddExpense={handleAddExpense}
                    onDeleteExpense={handleDeleteExpense}
                    onUpdateExpense={handleUpdateExpense}
                    onOpenCardsTab={handleOpenCardsTab}
                  />
                </>
              )}

              {activeTab === 'cards' && (
                <CreditCardsManager
                  expenses={combinedExpenses}
                  lifestyleIdealAmount={lifestyleIdealAmount}
                  lifestyleTotalSpent={categoryTotals.estilo}
                  selectedCardId={selectedCardId}
                  onSelectCardId={setSelectedCardId}
                  onAddCardExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}

              {activeTab === 'goals' && (
                <GoalsManager
                  goals={longTermGoals}
                  onAddGoal={handleAddLongTermGoal}
                  onUpdateGoal={handleUpdateLongTermGoal}
                  onDeleteGoal={handleDeleteLongTermGoal}
                />
              )}

              {activeTab === 'freedom' && (
                <FreedomSimulator
                  monthlyEssentialCost={categoryTotals.essencial}
                  monthlyTotalCost={
                    categoryTotals.essencial + categoryTotals.estilo
                  }
                  monthlyInvestment={categoryTotals.investimento}
                  profile={profile}
                />
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-oat-50/95 backdrop-blur-lg border-t border-oat-300 pb-safe shadow-cozy-lg">
        <div className="grid grid-cols-6 px-1 pt-1.5">
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
                className={`relative flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition cursor-pointer min-w-0 ${
                  isActive ? 'text-maldives-700 font-extrabold' : 'text-espresso-500'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileActiveTab"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-x-1 top-0.5 h-8 bg-maldives-100/90 rounded-xl -z-10"
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
