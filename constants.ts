import {
  BudgetGoal,
  CardPurchaseTag,
  CustomGoalItem,
  ExpenseItem,
  GlobalCreditCard,
} from './types';

export const CARD_PURCHASE_TAGS: Record<
  CardPurchaseTag,
  { label: string; icon: string; badgeClass: string }
> = {
  gastronomia: {
    label: 'Gastronomia & Delivery',
    icon: 'restaurant',
    badgeClass: 'bg-terracotta-100 text-terracotta-700 border-terracotta-300/70 dark:border-terracotta-300/40',
  },
  assinaturas: {
    label: 'Streaming & Assinaturas',
    icon: 'smart_display',
    badgeClass: 'bg-maldives-100 text-maldives-800 border-maldives-300/70 dark:border-maldives-300/40',
  },
  compras: {
    label: 'Compras & Mimos',
    icon: 'shopping_bag',
    badgeClass: 'bg-oat-200 text-espresso-800 border-oat-300 dark:border-white/[0.08]',
  },
  mobilidade: {
    label: 'Apps de Transporte',
    icon: 'local_taxi',
    badgeClass: 'bg-sage-100 text-sage-600 border-sage-300/70 dark:border-sage-300/40',
  },
  lazer: {
    label: 'Passeios & Viagens',
    icon: 'Confirmation_number',
    badgeClass: 'bg-maldives-50 text-maldives-700 border-maldives-200/80 dark:border-maldives-300/35',
  },
  autocuidado: {
    label: 'Bem-estar & Estética',
    icon: 'spa',
    badgeClass: 'bg-terracotta-50 text-terracotta-600 border-terracotta-200/80 dark:border-terracotta-300/35',
  },
  outros: {
    label: 'Outros Gastos',
    icon: 'receipt',
    badgeClass: 'bg-oat-100 text-espresso-600 border-oat-300 dark:border-white/[0.08]',
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
    borderColor: 'border-sage-300/85 dark:border-sage-300/50',
    badgeBg: 'bg-sage-200/70 dark:bg-sage-100 text-sage-600 border-sage-300/80 dark:border-sage-300/40',
    assetPath: '/assets/marvit-essencial.png',
    description:
      'Moradia, alimentação & mercado, saúde, contas de consumo e transporte essencial.',
  },
  estilo: {
    name: 'Estilo de Vida (30%)',
    shortName: 'Estilo de Vida',
    category: 'estilo',
    idealPercent: 30,
    color: '#D97757', // Terracota Aconchegante
    accentBg: 'bg-terracotta-100',
    accentText: 'text-terracotta-600',
    borderColor: 'border-terracotta-200/90 dark:border-terracotta-200/55',
    badgeBg: 'bg-terracotta-100 text-terracotta-700 border-terracotta-200 dark:border-terracotta-300/40',
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
    borderColor: 'border-maldives-300/85 dark:border-maldives-300/50',
    badgeBg: 'bg-maldives-100 text-maldives-800 border-maldives-300/80 dark:border-maldives-300/40',
    assetPath: '/assets/marvit-investimento.png',
    description:
      'Construção de patrimônio, reserva de segurança e independência financeira.',
  },
};

export const INITIAL_GLOBAL_CARDS: GlobalCreditCard[] = [
  {
    id: '6',
    name: 'Cartão Nubank / Ultravioleta',
    cardLimit: 1500,
    cardDueDay: 10,
    cardClosingDay: 25,
    color: '#820ad1',
    brand: 'nubank',
  },
  {
    id: '7',
    name: 'Cartão Inter / Pontos',
    cardLimit: 1000,
    cardDueDay: 15,
    cardClosingDay: 5,
    color: '#ff7a00',
    brand: 'inter',
  },
];

export const INITIAL_EXPENSES: ExpenseItem[] = [
  // Essenciais
  { id: '1', name: 'Aluguel / Parcela Imóvel', amount: 1800, category: 'essencial' },
  { id: '2', name: 'Supermercado, Feira & Alimentação', amount: 950, category: 'essencial' },
  { id: '3', name: 'Contas (Água, Luz, Internet)', amount: 420, category: 'essencial' },
  { id: '4', name: 'Plano de Saúde & Farmácia', amount: 380, category: 'essencial' },
  { id: '5', name: 'Transporte / Combustível', amount: 450, category: 'essencial' },

  // Estilo de Vida
  {
    id: '6',
    globalCardId: '6',
    name: 'Cartão Nubank / Ultravioleta',
    amount: 760,
    category: 'estilo',
    subcategory: 'cartao',
    cardDueDay: 10,
    cardClosingDay: 25,
    cardLimit: 1500,
    cardTransactions: [
      {
        id: 'tx-1',
        description: 'Jantar Especial & Cafeterias',
        amount: 340,
        tag: 'gastronomia',
        installment: 'À vista',
        purchaseDate: '08/11',
      },
      {
        id: 'tx-2',
        description: 'Streaming (Netflix, Spotify, Apple)',
        amount: 110,
        tag: 'assinaturas',
        installment: 'Recorrente',
        purchaseDate: '12/11',
      },
      {
        id: 'tx-3',
        description: 'Compras Online & Livros',
        amount: 310,
        tag: 'compras',
        installment: '1/2',
        purchaseDate: '19/11',
      },
    ],
  },
  {
    id: '7',
    globalCardId: '7',
    name: 'Cartão Inter / Pontos',
    amount: 480,
    category: 'estilo',
    subcategory: 'cartao',
    cardDueDay: 15,
    cardClosingDay: 5,
    cardLimit: 1000,
    cardTransactions: [
      {
        id: 'tx-4',
        description: 'iFood & Delivery Fim de Semana',
        amount: 260,
        tag: 'gastronomia',
        installment: 'À vista',
        purchaseDate: '14/11',
      },
      {
        id: 'tx-5',
        description: 'Passeios, Cinema & Lazer',
        amount: 220,
        tag: 'lazer',
        installment: 'À vista',
        purchaseDate: '22/11',
      },
    ],
  },
  {
    id: '8',
    name: 'Academia & Autocuidado (Pix/Direto)',
    amount: 160,
    category: 'estilo',
    subcategory: 'direto',
    expenseDate: '05/11',
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

/** Conteúdo original da fatura exemplo Nubank_2026-11-01.csv para importação rápida ou teste */
export const SAMPLE_NUBANK_CSV_RAW = `date,title,amount
2026-10-24,Hna*Oboticario - Parcela 1/5,"87,86"
2026-10-24,Apple.Com/Bill,"14,99"
2026-10-24,Doceria Fabricia Bolos,"181,00"
2026-10-24,Ifd*Novos Habitos,"38,92"
2026-10-24,Mp *Joseeduardoan,"16,00"
2026-10-22,Carolyne Melo,"125,00"
2026-10-22,Petrox Comercial,"4,43"
2026-10-22,Doceria e Buffet Fabri,"181,00"
2026-10-20,Elisandra de Vargas Sc,"51,90"
2026-10-20,Rek Parking Empreend,"1,80"
2026-10-20,Ifd*Ifood Club,"5,95"
2026-10-19,Esh Comercio de Chocol,"75,00"
2026-10-19,Adegacutelaria,"35,00"
2026-10-19,Florybal,"46,00"
2026-10-18,Supermercado Mombach,"25,16"
2026-10-18,Metz Backerei,"28,00"
2026-10-16,Shein *Mariana Caroli,"119,90"
2026-10-16,Farmacia Mottin,"53,84"
2026-10-15,Dl*Spotify P4804,"23,90"
2026-10-15,Dl Pelotas,"50,00"
2026-10-15,Delicatessen Banca,"253,38"
2026-10-15,Imperatriz Doces Finos,"58,00"
2026-10-12,"IOF de ""Openai *Chatgpt Subscr""","3,63"
2026-10-12,Openai *Chatgpt Subscr,"103,90"
2026-10-11,L A Tomasi e Cia,"9,00"
2026-10-10,Atacadaotimbauva,"126,43"
2026-10-09,Salchpao,"5,00"
2026-10-09,Ranulfo Laticinios,"135,62"
2026-10-09,Mulvi I*Rosivaldo Anto,"25,00"
2026-10-08,Paulo Jorge da Silva,"80,00"
2026-10-08,Petrox Comercial,"29,99"
2026-10-08,Escovarias Life,"256,20"
2026-10-07,Ifd*Vs Servicos de Ali,"63,96"
2026-10-07,Wellhub Vitoria Cezimb,"174,10"
2026-10-07,Petrox Comercial,"21,53"
2026-10-07,Casa do Bolo,"27,90"
2026-10-06,Petrox Comercial,"15,97"
2026-10-06,Point do Sucao,"24,00"
2026-10-05,Mp *Acaiteria,"37,31"
2026-10-03,Apple.Com/Bill,"66,90"
2026-09-29,Ifd*Novos Habitos,"32,89"
2026-09-29,Conta Vivo,"59,00"
2026-09-28,Pagamento recebido,"- 3.120,62"
2026-09-28,Redemed,"29,99"
2026-09-27,Eventoscantoverde,"10,00"
2026-09-27,111 - Riachuelo - Barr - Parcela 1/3,"113,66"
2026-09-26,Conta Vivo,"61,92"
2026-09-25,Petrox Comercial,"22,58"
2026-09-24,Pague Menos - Parcela 2/2,"177,12"
2026-09-24,Porto Seguro Cia Seg G - Parcela 2/10,"25,72"
2026-09-24,Ajubeautyconcept - Parcela 3/3,"259,33"
2026-09-24,Amazon - Parcela 2/2,"29,46"
2026-09-24,Dl*Uberrides,"14,95"
2026-09-24,N S Modas - Parcela 3/3,"77,00"
2026-09-24,Decathlon - Parcela 3/5,"51,99"
2026-09-24,Apple.Com/Bill,"14,99"
2026-09-24,Uber Uber *Trip Help.U,"16,93"
2026-09-24,Baga Baga Home Outlet - Parcela 2/2,"71,87"`;
