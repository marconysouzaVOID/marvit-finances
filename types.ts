export type ExpenseCategory = 'essencial' | 'estilo' | 'investimento';

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  isCustom?: boolean;
  linkedGoalId?: string;
}

export interface BudgetGoal {
  name: string;
  shortName: string;
  category: ExpenseCategory;
  idealPercent: number; // Porcentagem customizável (ex: 50%, 30%, 20%)
  color: string;
  accentBg: string;
  accentText: string;
  borderColor: string;
  badgeBg: string;
  assetPath: string;
  description: string;
}

export interface FinancialProfile {
  monthlyIncome: number;
  additionalIncome: number;
  desiredEmergencyMonths: number;
  expectedAnnualReturnRate: number; // Ex: 10.5% a.a.
}

export interface CustomGoalItem {
  id: string;
  title: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  annualInterestRate: number; // % a.a.
  syncWithBudget: boolean;
  budgetCategory: ExpenseCategory;
  notes?: string;
}

export interface MonthDataRecord {
  monthKey: string; // Formato "YYYY-MM", ex: "2026-11"
  updatedAt: string;
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  notes?: string;
}

export interface MonthSnapshot {
  id: string;
  monthLabel: string; // Ex: "Novembro / 2026"
  dateCreated: string;
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  customLongTermGoals?: CustomGoalItem[];
  notes?: string;
}

/** Formato do arquivo JSON de exportação, restauração e sincronização em nuvem */
export interface MarvitBackupData {
  version: string;
  appName: string;
  exportedAt: string;
  selectedMonthKey?: string;
  monthsData?: Record<string, MonthDataRecord>;
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  customLongTermGoals: CustomGoalItem[];
  history: MonthSnapshot[];
}

export interface VaultCredentials {
  vaultId: string;
  pinHash: string;
  autoSync: boolean;
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  lastSyncedAt?: string;
}
