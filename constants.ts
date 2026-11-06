import {
  BudgetGoal,
  CardPurchaseTag,
  CustomGoalItem,
  ExpenseItem,
} from './types';

export const CARD_PURCHASE_TAGS: Record<
  CardPurchaseTag,
  { label: string; icon: string; badgeClass: string }
> = {
  gastronomia: {
    label: 'Gastronomia & Delivery',
    icon: 'restaurant',
    badgeClass: 'bg-terracotta-100 text-terracotta-700 border-terracotta-300',
  },
  assinaturas: {
    label: 'Streaming & Assinaturas',
    icon: 'smart_display',
    badgeClass: 'bg-maldives-100 text-maldives-800 border-maldives-300',
  },
  compras: {
    label: 'Compras & Mimos',
    icon: 'shopping_bag',
    badgeClass: 'bg-oat-200 text-espresso-800 border-oat-300',
  },
  mobilidade: {
    label: 'Apps de Transporte',
    icon: 'local_taxi',
    badgeClass: 'bg-sage-100 text-sage-600 border-sage-300',
  },
  lazer: {
    label: 'Passeios & Viagens',
    icon: 'Confirmation_number',
    badgeClass: 'bg-maldives-50 text-maldives-700 border-maldives-200',
  },
  autocuidado: {
    label: 'Bem-estar & Estética',
    icon: 'spa',
    badgeClass: 'bg-terracotta-50 text-terracotta-600 border-terracotta-200',
  },
  outros: {
    label: 'Outros Gastos',
    icon: 'receipt',
    badgeClass: 'bg-oat-100 text-espresso-600 border-oat-300',
  },
};

export const AUVP_GOALS: Record<string, BudgetGoal> = {
  essencial: {
    name: 'Custos Essenciais (50%)',
    shortName: 'Essenciais',
    category: 'essencial',
    idealPercent: 50,
    color: '#658B6E', // Verde Sálvia Profundo
    accentBg: 'bg-sage-100',
    accentText: 'text-sage-600',
    borderColor: 'border-sage-300',
    badgeBg: 'bg-sage-200/70 text-sage-600 border-sage-300',
    assetPath: '/assets/marvit-essencial.png',
    description:
      'Moradia, despensa & mercado, saúde, contas de consumo e transporte essencial.',
  },
  estilo: {
    name: 'Estilo de Vida (30%)',
    shortName: 'Estilo de Vida',
    category: 'estilo',
    idealPercent: 30,
    color: '#D97757', // Terracota Aconchegante
    accentBg: 'bg-terracotta-100',
    accentText: 'text-terracotta-600',
    borderColor: 'border-terracotta-200',
    badgeBg: 'bg-terracotta-100 text-terracotta-700 border-terracotta-200',
    assetPath: '/assets/marvit-estilo.png',
    description:
      'Cafés especiais, jantares, streaming, viagens, bem-estar e mimos pessoais.',
  },
  investimento: {
    name: 'Futuro & Investimentos (20%)',
    shortName: 'Investimentos',
    category: 'investimento',
    idealPercent: 20,
    color: '#14B8A6', // Verde Maldivas Vívido
    accentBg: 'bg-maldives-50',
    accentText: 'text-maldives-700',
    borderColor: 'border-maldives-300',
    badgeBg: 'bg-maldives-100 text-maldives-800 border-maldives-300',
    assetPath: '/assets/marvit-investimento.png',
    description:
      'Construção de patrimônio, reserva de segurança e independência financeira.',
  },
};

export const INITIAL_EXPENSES: ExpenseItem[] = [
  // Essenciais
  { id: '1', name: 'Aluguel / Parcela Imóvel', amount: 1800, category: 'essencial' },
  { id: '2', name: 'Supermercado, Feira & Despensa', amount: 950, category: 'essencial' },
  { id: '3', name: 'Contas (Água, Luz, Internet)', amount: 420, category: 'essencial' },
  { id: '4', name: 'Plano de Saúde & Farmácia', amount: 380, category: 'essencial' },
  { id: '5', name: 'Transporte / Combustível', amount: 450, category: 'essencial' },

  // Estilo de Vida
  {
    id: '6',
    name: 'Cartão Nubank / Ultravioleta',
    amount: 760,
    category: 'estilo',
    subcategory: 'cartao',
    cardDueDay: 10,
    cardLimit: 1500,
    cardTransactions: [
      {
        id: 'tx-1',
        description: 'Jantar Especial & Cafeterias',
        amount: 340,
        tag: 'gastronomia',
        installment: 'À vista',
      },
      {
        id: 'tx-2',
        description: 'Streaming (Netflix, Spotify, Apple)',
        amount: 110,
        tag: 'assinaturas',
        installment: 'Recorrente',
      },
      {
        id: 'tx-3',
        description: 'Compras Online & Livros',
        amount: 310,
        tag: 'compras',
        installment: '1/2',
      },
    ],
  },
  {
    id: '7',
    name: 'Cartão Inter / Pontos',
    amount: 480,
    category: 'estilo',
    subcategory: 'cartao',
    cardDueDay: 15,
    cardLimit: 1000,
    cardTransactions: [
      {
        id: 'tx-4',
        description: 'iFood & Delivery Fim de Semana',
        amount: 260,
        tag: 'gastronomia',
        installment: 'À vista',
      },
      {
        id: 'tx-5',
        description: 'Passeios, Cinema & Lazer',
        amount: 220,
        tag: 'lazer',
        installment: 'À vista',
      },
    ],
  },
  {
    id: '8',
    name: 'Academia & Autocuidado (Pix/Direto)',
    amount: 160,
    category: 'estilo',
    subcategory: 'direto',
  },

  // Investimentos
  { id: '10', name: 'Aportes em Renda Variável (Ações/FIIs)', amount: 1000, category: 'investimento' },
  { id: '11', name: 'Reserva de Emergência / Tesouro Selic', amount: 500, category: 'investimento' },
];

export const INITIAL_LONG_TERM_GOALS: CustomGoalItem[] = [
  {
    id: 'goal-1',
    title: 'Férias nas Maldivas',
    icon: 'beach_access',
    targetAmount: 24000,
    currentAmount: 6500,
    monthlyContribution: 600,
    annualInterestRate: 10.5,
    syncWithBudget: false,
    budgetCategory: 'estilo',
    notes: 'Viagem dos sonhos com bangalô sobre as águas cristalinas.',
  },
  {
    id: 'goal-2',
    title: 'Reforma da Cozinha Comfy',
    icon: 'countertops',
    targetAmount: 35000,
    currentAmount: 12000,
    monthlyContribution: 850,
    annualInterestRate: 11.0,
    syncWithBudget: true,
    budgetCategory: 'investimento',
    notes: 'Marcenaria verde sálvia, bancada de quartzo creme e ilha gourmet.',
  },
  {
    id: 'goal-3',
    title: 'Entrada do Imóvel Próprio',
    icon: 'cottage',
    targetAmount: 120000,
    currentAmount: 38000,
    monthlyContribution: 1500,
    annualInterestRate: 11.5,
    syncWithBudget: false,
    budgetCategory: 'investimento',
    notes: 'Fundo dedicado em Tesouro IPCA+ e CDBs de liquidez.',
  },
];

export const GOAL_ICONS: { id: string; label: string }[] = [
  { id: 'beach_access', label: 'Viagem' },
  { id: 'countertops', label: 'Cozinha / Casa' },
  { id: 'cottage', label: 'Imóvel' },
  { id: 'directions_car', label: 'Veículo' },
  { id: 'school', label: 'Estudos' },
  { id: 'favorite', label: 'Casamento / Família' },
  { id: 'laptop_mac', label: 'Equipamento' },
  { id: 'savings', label: 'Pote Extra' },
];
