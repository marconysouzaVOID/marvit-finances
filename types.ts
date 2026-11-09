export type ExpenseCategory = 'essencial' | 'estilo' | 'investimento';

/** Subcategoria dentro do pilar Estilo de Vida */
export type LifestyleSubcategory = 'direto' | 'cartao';

/** Categoria temática de cada compra individualizada dentro de um Cartão de Crédito */
export type CardPurchaseTag =
  | 'gastronomia'
  | 'assinaturas'
  | 'compras'
  | 'mobilidade'
  | 'lazer'
  | 'autocuidado'
  | 'outros';

/** Gasto individualizado lançado na fatura de um Cartão de Crédito de Estilo de Vida */
export interface CreditCardTransaction {
  id: string;
  description: string;
  amount: number;
  tag: CardPurchaseTag;
  purchaseDate?: string; // Ex: "12/11" ou "2026-11-12"
  installment?: string; // Ex: "À vista", "2/6", "1/3"
  notes?: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  isCustom?: boolean;
  linkedGoalId?: string;
  /** Subcategoria para itens do pilar 'estilo': 'cartao' (Cartão de Crédito) ou 'direto' (Gasto Direto/Pix) */
  subcategory?: LifestyleSubcategory;
  /** Lista de gastos individualizados quando subcategory === 'cartao' */
  cardTransactions?: CreditCardTransaction[];
  /** Dia de vencimento opcional do cartão */
  cardDueDay?: number;
  /** Limite ou teto planejado para este cartão no mês */
  cardLimit?: number;
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
  monthKey?: string; // Formato "YYYY-MM", ex: "2026-11"
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
  /**
   * Marca de quando um backup .JSON foi restaurado (importado) explicitamente pelo usuário.
   * Uma restauração é autoritativa: os outros aparelhos (PC/Celular) adotam o conteúdo restaurado
   * por completo em vez de mesclar mês a mês com os dados antigos que tinham.
   */
  restoredAt?: string;
}

export interface VaultCredentials {
  vaultId: string;
  pinHash: string;
  autoSync: boolean;
  appLockEnabled: boolean;
  biometricEnabled: boolean;
  lastSyncedAt?: string;
}
