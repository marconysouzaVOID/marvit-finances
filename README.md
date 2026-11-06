# Marvit&Finances - Código Fonte & Documentação do Projeto

> **Exportado em:** 06/11/2026 às 02:47  
> **Tema:** Verde Maldivas (#14b8a6, #06b6d4) & Cinza Gelo (#94a3b8, #f8fafc)  
> **Tecnologias:** React 19, TypeScript, Tailwind CSS, Flow SDK  

---

## 📋 Sumário
1. [Sobre a Aplicação](#sobre-a-aplicação)
2. [Estrutura do Projeto](#estrutura-do-projeto)
3. [Código-Fonte Completo](#código-fonte-completo)
   - [types.ts](#typests)
   - [constants.ts](#constantsts)
   - [utils/formatters.ts](#utilsformattersts)
   - [utils/exportCanvas.ts](#utilsexportcanvasts)
   - [utils/sourceExporter.ts](#utilssourceexporterts)
   - [components/IncomeCard.tsx](#componentsincomecardtsx)
   - [components/FinancialOverview.tsx](#componentsfinancialoverviewtsx)
   - [components/ExpenseManager.tsx](#componentsexpensemanagertsx)
   - [components/FreedomSimulator.tsx](#componentsfreedomsimulatortsx)
   - [components/AdvicePanel.tsx](#componentsadvicepaneltsx)
   - [components/HistoryManager.tsx](#componentshistorymanagertsx)
   - [App.tsx](#apptsx)

---

## 💎 Sobre a Aplicação
O **Marvit&Finances** é uma ferramenta de gestão orçamentária inteligente focada no método de pilares proporcionais (como 50% Essenciais, 30% Estilo de Vida e 20% Investimentos), simulador de independência financeira (FIRE), cálculo de reserva de emergência, histórico comparativo de fechamentos mensais, diagnósticos preditivos e exportação tanto gráfica (PNG de alta resolução) quanto de dados (JSON e Markdown).

---

## 🗂️ Estrutura do Projeto

```text
├── types.ts
├── constants.ts
├── utils/
│   ├── formatters.ts
│   ├── exportCanvas.ts
│   └── sourceExporter.ts
├── components/
│   ├── IncomeCard.tsx
│   ├── FinancialOverview.tsx
│   ├── ExpenseManager.tsx
│   ├── FreedomSimulator.tsx
│   ├── AdvicePanel.tsx
│   └── HistoryManager.tsx
└── App.tsx
```

---

## 💻 Código-Fonte Completo

### `types.ts`
```typescript
export type ExpenseCategory = 'essencial' | 'estilo' | 'investimento';

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  isCustom?: boolean;
}

export interface BudgetGoal {
  name: string;
  category: ExpenseCategory;
  idealPercent: number; // Porcentagem customizável (ex: 50%, 30%, 20%)
  color: string;
  accentBg: string;
  accentText: string;
  borderColor: string;
  description: string;
}

export interface FinancialProfile {
  monthlyIncome: number;
  additionalIncome: number;
  desiredEmergencyMonths: number;
  expectedAnnualReturnRate: number; // Ex: 10% a.a.
}

export interface MonthSnapshot {
  id: string;
  monthLabel: string; // Ex: "Outubro / 2024"
  dateCreated: string;
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  notes?: string;
}

/** Formato do arquivo JSON de exportação e restauração completa */
export interface MarvitBackupData {
  version: string;
  appName: string;
  exportedAt: string;
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  history: MonthSnapshot[];
}
```

---

### `constants.ts`
```typescript
import { BudgetGoal, ExpenseItem } from './types';

export const AUVP_GOALS: Record<string, BudgetGoal> = {
  essencial: {
    name: 'Custos Essenciais (50%)',
    category: 'essencial',
    idealPercent: 50,
    color: '#06b6d4', // Ciano / Água Maldivas
    accentBg: 'bg-cyan-500/10',
    accentText: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    description: 'Moradia, alimentação básica, saúde, contas de consumo e transporte essencial.',
  },
  estilo: {
    name: 'Estilo de Vida (30%)',
    category: 'estilo',
    idealPercent: 30,
    color: '#94a3b8', // Cinza Gelo / Prata
    accentBg: 'bg-slate-500/10',
    accentText: 'text-slate-300',
    borderColor: 'border-slate-500/30',
    description: 'Lazer, restaurantes, streaming, viagens, hobbies e compras pessoais.',
  },
  investimento: {
    name: 'Futuro & Investimentos (20%)',
    category: 'investimento',
    idealPercent: 20,
    color: '#14b8a6', // Verde Maldivas vívido (Teal)
    accentBg: 'bg-teal-500/10',
    accentText: 'text-teal-300',
    borderColor: 'border-teal-500/30',
    description: 'Construção de patrimônio, reserva de emergência e independência financeira.',
  },
};

export const INITIAL_EXPENSES: ExpenseItem[] = [
  // Essenciais
  { id: '1', name: 'Aluguel / Parcela Imóvel', amount: 1800, category: 'essencial' },
  { id: '2', name: 'Supermercado & Feira', amount: 950, category: 'essencial' },
  { id: '3', name: 'Contas (Água, Luz, Internet)', amount: 420, category: 'essencial' },
  { id: '4', name: 'Plano de Saúde & Farmácia', amount: 380, category: 'essencial' },
  { id: '5', name: 'Transporte / Combustível', amount: 450, category: 'essencial' },
  
  // Estilo de Vida
  { id: '6', name: 'Restaurantes, Bares & Delivery', amount: 650, category: 'estilo' },
  { id: '7', name: 'Assinaturas (Netflix, Spotify)', amount: 110, category: 'estilo' },
  { id: '8', name: 'Academia & Cuidados', amount: 160, category: 'estilo' },
  { id: '9', name: 'Passeios, Cinema & Compras', amount: 480, category: 'estilo' },

  // Investimentos
  { id: '10', name: 'Aportes em Renda Variável (Ações/FIIs)', amount: 1000, category: 'investimento' },
  { id: '11', name: 'Reserva de Emergência / Tesouro Selic', amount: 500, category: 'investimento' },
];
```

---

### `utils/formatters.ts`
```typescript
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatPercent(value: number): string {
  return `${(value || 0).toFixed(1)}%`;
}

/** Calcula o patrimônio necessário para viver de renda passiva (Regra dos 4% / 0.6% a.m.) */
export function calculateFireTarget(monthlyCost: number, realYieldAnnual = 0.06): number {
  const annualCost = monthlyCost * 12;
  return annualCost / realYieldAnnual;
}

/** Calcula estimativa de meses para atingir liberdade financeira */
export function estimateMonthsToFire(
  currentMonthlyInvestment: number,
  targetPatrimony: number,
  annualInterestRate = 0.10
): number {
  if (currentMonthlyInvestment <= 0) return 0;
  const monthlyRate = Math.pow(1 + annualInterestRate, 1 / 12) - 1;
  
  const factor = (targetPatrimony * monthlyRate) / currentMonthlyInvestment + 1;
  if (factor <= 1) return 0;
  
  const months = Math.log(factor) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
}
```

---

### `utils/exportCanvas.ts`
```typescript
import { FinancialProfile, ExpenseItem, ExpenseCategory } from '../types';
import { formatCurrency, formatPercent } from './formatters';

interface ExportReportData {
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  categoryTotals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

/** Renderiza um relatório gráfico estilizado em alta resolução (1200x1600) retornando base64 */
export async function generateReportImageBase64(data: ExportReportData): Promise<string> {
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 1600;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Falha ao obter contexto 2D');

  // Fundo Dark Premium com tom Maldivas
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#040d12');
  bgGrad.addColorStop(0.5, '#08171e');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Efeito decorativo Verde Maldivas / topo
  const topGlow = ctx.createRadialGradient(width / 2, 0, 10, width / 2, 0, 700);
  topGlow.addColorStop(0, 'rgba(20, 184, 166, 0.22)');
  topGlow.addColorStop(0.6, 'rgba(6, 182, 212, 0.08)');
  topGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 550);

  // Borda externa
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  // Cabeçalho - Logotipo M estilizado
  ctx.fillStyle = '#14b8a6';
  ctx.beginPath();
  ctx.roundRect(70, 70, 56, 56, 12);
  ctx.fill();

  ctx.fillStyle = '#020617';
  ctx.font = '900 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M', 98, 111);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Marvit&Finances', 145, 96);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Relatório Orçamentário • Emitido em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    145,
    122
  );

  // Linha divisória
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 155);
  ctx.lineTo(width - 70, 155);
  ctx.stroke();

  // Cards de Renda & Saldo
  const drawCard = (x: number, y: number, w: number, h: number, title: string, value: string, color: string) => {
    ctx.fillStyle = '#0b1622';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(title.toUpperCase(), x + 24, y + 36);

    ctx.fillStyle = color;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(value, x + 24, y + 78);
  };

  drawCard(70, 180, 330, 105, 'Renda Total Líquida', formatCurrency(data.totalIncome), '#14b8a6');
  drawCard(435, 180, 330, 105, 'Total de Gastos/Aportes', formatCurrency(data.totalExpenses), '#cbd5e1');
  drawCard(
    800,
    180,
    330,
    105,
    'Sobra / Balanço Mensal',
    formatCurrency(data.balance),
    data.balance >= 0 ? '#14b8a6' : '#f43f5e'
  );

  // Seção: Pilares e Porcentagens
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('1. Pilares Orçamentários (Metas vs. Realizado)', 70, 335);

  const pillars = [
    {
      name: 'Custos Essenciais',
      cat: 'essencial' as ExpenseCategory,
      target: data.customGoals.essencial,
      spent: data.categoryTotals.essencial,
      color: '#06b6d4',
    },
    {
      name: 'Estilo de Vida',
      cat: 'estilo' as ExpenseCategory,
      target: data.customGoals.estilo,
      spent: data.categoryTotals.estilo,
      color: '#94a3b8',
    },
    {
      name: 'Investimentos & Futuro',
      cat: 'investimento' as ExpenseCategory,
      target: data.customGoals.investimento,
      spent: data.categoryTotals.investimento,
      color: '#14b8a6',
    },
  ];

  pillars.forEach((p, index) => {
    const cardY = 360 + index * 125;
    const currentPercent = data.totalIncome > 0 ? (p.spent / data.totalIncome) * 100 : 0;
    const targetAmount = (data.totalIncome * p.target) / 100;

    ctx.fillStyle = '#0b1622';
    ctx.beginPath();
    ctx.roundRect(70, cardY, width - 140, 110, 14);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(95, cardY + 35, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${p.name} (Meta: ${p.target}%)`, 115, cardY + 42);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(p.spent), width - 95, cardY + 42);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Teto: ${formatCurrency(targetAmount)} • ${formatPercent(currentPercent)} da renda`, width - 95, cardY + 68);
    ctx.textAlign = 'left';

    const barWidth = width - 190;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(95, cardY + 80, barWidth, 12, 6);
    ctx.fill();

    const fillWidth = Math.min(barWidth, (barWidth * currentPercent) / 100);
    if (fillWidth > 0) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(95, cardY + 80, fillWidth, 12, 6);
      ctx.fill();
    }
  });

  // Extrato de gastos
  const listStartY = 770;
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('2. Detalhamento de Gastos & Aportes', 70, listStartY);

  const sortedExpenses = [...data.expenses].sort((a, b) => b.amount - a.amount).slice(0, 10);

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(70, listStartY + 15, width - 140, 36);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('ITEM / DESCRIÇÃO', 90, listStartY + 38);
  ctx.fillText('PILAR', 600, listStartY + 38);
  ctx.textAlign = 'right';
  ctx.fillText('VALOR MENSAL (R$)', width - 95, listStartY + 38);
  ctx.textAlign = 'left';

  sortedExpenses.forEach((item, idx) => {
    const rowY = listStartY + 55 + idx * 42;
    ctx.fillStyle = idx % 2 === 0 ? '#07121b' : '#0b1622';
    ctx.fillRect(70, rowY, width - 140, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.fillText(item.name, 90, rowY + 25);

    const catLabel =
      item.category === 'essencial'
        ? 'Essencial'
        : item.category === 'estilo'
        ? 'Estilo de Vida'
        : 'Aporte & Futuro';

    const catColor =
      item.category === 'essencial'
        ? '#06b6d4'
        : item.category === 'estilo'
        ? '#cbd5e1'
        : '#14b8a6';

    ctx.fillStyle = catColor;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(catLabel, 600, rowY + 25);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(item.amount), width - 95, rowY + 25);
    ctx.textAlign = 'left';
  });

  // Liberdade Financeira
  const fireStartY = 1240;
  ctx.fillStyle = '#0b1622';
  ctx.beginPath();
  ctx.roundRect(70, fireStartY, width - 140, 200, 16);
  ctx.fill();
  ctx.strokeStyle = '#14b8a6';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#14b8a6';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('★ Planejamento de Liberdade Financeira (Marvit&Finances)', 95, fireStartY + 42);

  const monthlyInvestment = data.categoryTotals.investimento;
  const annualCost = (data.categoryTotals.essencial + data.categoryTotals.estilo) * 12;
  const firePatrimony = annualCost / 0.06;

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px sans-serif';
  ctx.fillText(`• Custo Anual de Vida: ${formatCurrency(annualCost)}`, 95, fireStartY + 80);
  ctx.fillText(`• Meta Patrimônio Viver de Renda (Regra 6% a.a. real): ${formatCurrency(firePatrimony)}`, 95, fireStartY + 112);
  ctx.fillText(`• Aporte Mensal Atual: ${formatCurrency(monthlyInvestment)} (${formatPercent(data.totalIncome > 0 ? (monthlyInvestment / data.totalIncome) * 100 : 0)} da renda)`, 95, fireStartY + 144);
  ctx.fillText(`• Reserva de Emergência (${data.profile.desiredEmergencyMonths} meses): ${formatCurrency(data.categoryTotals.essencial * data.profile.desiredEmergencyMonths)}`, 95, fireStartY + 176);

  ctx.fillStyle = '#64748b';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    '“Marvit&Finances: Clareza orçamentária, aportes invariáveis e liberdade sustentável.”',
    width / 2,
    height - 50
  );

  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1];
}
```

---

### `components/IncomeCard.tsx`
```typescript
import React from 'react';
import { FinancialProfile } from '../types';
import { formatCurrency } from '../utils/formatters';

interface IncomeCardProps {
  profile: FinancialProfile;
  onChangeProfile: (profile: FinancialProfile) => void;
  balance: number;
}

export const IncomeCard: React.FC<IncomeCardProps> = ({
  profile,
  onChangeProfile,
  balance,
}) => {
  const totalIncome = profile.monthlyIncome + profile.additionalIncome;

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-teal-400 text-lg">account_balance_wallet</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">Renda Líquida Mensal</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Fluxo de caixa base para distribuição orçamentária no Marvit&Finances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl shadow-inner">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Renda Total Disponível
            </span>
            <span className="text-xl font-black text-teal-300">
              {formatCurrency(totalIncome)}
            </span>
          </div>

          <div className={`px-4 py-2 rounded-xl border ${balance >= 0 ? 'bg-teal-950/20 border-teal-500/30' : 'bg-rose-950/20 border-rose-500/30'}`}>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Sobra / Déficit Livre
            </span>
            <span className={`text-xl font-black ${balance >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Salário / Pró-labore Líquido</span>
            <span className="text-[10px] text-slate-500 font-mono">Principal</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
            <input
              type="number"
              min="0"
              step="50"
              value={profile.monthlyIncome || ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  monthlyIncome: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-sm font-semibold text-white focus:outline-none focus:border-teal-400 transition"
              placeholder="0,00"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Renda Extra / Dividendos</span>
            <span className="text-[10px] text-slate-500 font-mono">Variável</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">R$</span>
            <input
              type="number"
              min="0"
              step="50"
              value={profile.additionalIncome || ''}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  additionalIncome: Math.max(0, Number(e.target.value)),
                })
              }
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl py-2 pl-9 pr-3 text-sm font-semibold text-white focus:outline-none focus:border-teal-400 transition"
              placeholder="0,00"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
            <span>Reserva de Emergência</span>
            <span className="text-[10px] text-teal-400 font-mono">{profile.desiredEmergencyMonths} meses de custo</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="3"
              max="12"
              value={profile.desiredEmergencyMonths}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  desiredEmergencyMonths: Number(e.target.value),
                })
              }
              className="w-full accent-teal-400 bg-slate-800 h-2 rounded-lg cursor-pointer"
            />
            <span className="text-sm font-bold text-white px-2 py-1 bg-slate-800 rounded-lg min-w-10 text-center font-mono border border-slate-700">
              {profile.desiredEmergencyMonths}m
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

### `components/FinancialOverview.tsx`
```typescript
import React, { useState } from 'react';
import { AUVP_GOALS } from '../constants';
import { ExpenseCategory } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface FinancialOverviewProps {
  totalIncome: number;
  categoryTotals: Record<ExpenseCategory, number>;
  customGoals: Record<ExpenseCategory, number>;
  onUpdateGoalPercent: (category: ExpenseCategory, percent: number) => void;
  onResetGoals: () => void;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({
  totalIncome,
  categoryTotals,
  customGoals,
  onUpdateGoalPercent,
  onResetGoals,
}) => {
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const categories: ExpenseCategory[] = ['essencial', 'estilo', 'investimento'];

  const sumPercent = categories.reduce((acc, cat) => acc + (customGoals[cat] ?? AUVP_GOALS[cat].idealPercent), 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-400 text-lg">pie_chart</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Metas de Alocação Orçamentária
            </h2>
            <p className="text-xs text-slate-400">
              Personalize a porcentagem destinada para cada pilar do seu planejamento no Marvit&Finances.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border ${
            sumPercent === 100
              ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            Soma: {sumPercent}% {sumPercent !== 100 && '(Ajuste p/ 100%)'}
          </div>

          <button
            onClick={() => setIsEditingGoals(!isEditingGoals)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              isEditingGoals
                ? 'bg-teal-400 text-slate-950 font-bold hover:bg-teal-300 shadow-lg shadow-teal-500/20'
                : 'bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isEditingGoals ? 'check' : 'tune'}
            </span>
            <span>{isEditingGoals ? 'Concluir Edição' : 'Editar %'}</span>
          </button>

          {isEditingGoals && (
            <button
              onClick={onResetGoals}
              className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs border border-slate-700 transition"
              title="Restaurar padrão (50/30/20)"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        {categories.map((cat) => {
          const goal = AUVP_GOALS[cat];
          const targetPercent = customGoals[cat] ?? goal.idealPercent;
          const spent = categoryTotals[cat] || 0;
          const currentPercent = totalIncome > 0 ? (spent / totalIncome) * 100 : 0;
          const idealAmount = (totalIncome * targetPercent) / 100;
          const diff = spent - idealAmount;

          return (
            <div
              key={cat}
              className={`p-5 rounded-2xl bg-slate-950/70 border ${goal.borderColor} shadow-lg relative overflow-hidden flex flex-col justify-between`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-teal-500/5 to-transparent pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${goal.accentBg} ${goal.accentText}`}>
                    {goal.name.replace(/(d+%)/, `(${targetPercent}%)`)}
                  </span>
                  
                  {isEditingGoals ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={targetPercent}
                        onChange={(e) =>
                          onUpdateGoalPercent(cat, Math.max(0, Math.min(100, Number(e.target.value))))
                        }
                        className="w-14 bg-slate-900 border border-teal-400/80 rounded px-1.5 py-0.5 text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-xs text-teal-400 font-bold">%</span>
                    </div>
                  ) : (
                    <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      Meta: {targetPercent}%
                    </span>
                  )}
                </div>

                {isEditingGoals && (
                  <div className="mb-3 pt-1">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={targetPercent}
                      onChange={(e) => onUpdateGoalPercent(cat, Number(e.target.value))}
                      className="w-full accent-teal-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                )}

                <div className="mt-2">
                  <div className="text-2xl font-black text-slate-100 tracking-tight font-sans">
                    {formatCurrency(spent)}
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1 text-slate-400">
                    <span>Teto: {formatCurrency(idealAmount)}</span>
                    <span className={`font-semibold ${currentPercent > targetPercent + 2 && cat !== 'investimento' ? 'text-rose-400' : 'text-slate-300'}`}>
                      {formatPercent(currentPercent)} da renda
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2.5 mt-3 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-sm"
                    style={{
                      width: `${Math.min(100, Math.max(0, currentPercent))}%`,
                      backgroundColor: goal.color,
                    }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {cat === 'investimento' ? 'Diferença p/ meta:' : 'Status do teto:'}
                </span>
                <span
                  className={`font-semibold ${
                    cat === 'investimento'
                      ? diff >= 0
                        ? 'text-teal-300'
                        : 'text-amber-400'
                      : diff <= 0
                      ? 'text-teal-300'
                      : 'text-rose-400'
                  }`}
                >
                  {diff === 0
                    ? 'Perfeito na meta'
                    : cat === 'investimento'
                    ? diff >= 0
                      ? `+${formatCurrency(diff)} a mais 💎`
                      : `Faltam ${formatCurrency(Math.abs(diff))}`
                    : diff <= 0
                    ? `Folga de ${formatCurrency(Math.abs(diff))}`
                    : `Passou ${formatCurrency(diff)} ⚠️`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

---

### `components/ExpenseManager.tsx`
```typescript
import React, { useState } from 'react';
import { AUVP_GOALS } from '../constants';
import { ExpenseCategory, ExpenseItem } from '../types';

interface ExpenseManagerProps {
  expenses: ExpenseItem[];
  onAddExpense: (item: Omit<ExpenseItem, 'id'>) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense: (id: string, updated: Partial<ExpenseItem>) => void;
}

export const ExpenseManager: React.FC<ExpenseManagerProps> = ({
  expenses,
  onAddExpense,
  onDeleteExpense,
  onUpdateExpense,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | ExpenseCategory>('all');
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('essencial');

  const filteredExpenses =
    selectedFilter === 'all'
      ? expenses
      : expenses.filter((e) => e.category === selectedFilter);

  const handleCreate = () => {
    if (!newName.trim() || !newAmount || Number(newAmount) <= 0) return;
    onAddExpense({
      name: newName.trim(),
      amount: Number(newAmount),
      category: newCategory,
      isCustom: true,
    });
    setNewName('');
    setNewAmount('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-400 text-lg">format_list_bulleted</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">
            Planilha de Gastos & Aportes
          </h2>
          <span className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-full border border-slate-700">
            {expenses.length} itens
          </span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1 rounded-lg font-medium transition ${
              selectedFilter === 'all'
                ? 'bg-slate-800 text-teal-300 border border-slate-700 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setSelectedFilter('essencial')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              selectedFilter === 'essencial'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Essenciais
          </button>
          <button
            onClick={() => setSelectedFilter('estilo')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              selectedFilter === 'estilo'
                ? 'bg-slate-500/20 text-slate-200 border border-slate-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            Estilo
          </button>
          <button
            onClick={() => setSelectedFilter('investimento')}
            className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
              selectedFilter === 'investimento'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-teal-300'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            Aportes
          </button>
        </div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
        <div className="sm:col-span-5">
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Descrição do gasto ou aporte
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Ex: Financiamento, Jantar, Tesouro..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Valor Mensal (R$)
          </label>
          <input
            type="number"
            min="0"
            step="10"
            value={newAmount}
            onChange={(e) =>
              setNewAmount(e.target.value === '' ? '' : Number(e.target.value))
            }
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="0,00"
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-teal-400"
          />
        </div>

        <div className="sm:col-span-3">
          <label className="text-[11px] font-medium text-slate-400 mb-1 block">
            Pilar de Destino
          </label>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-2 text-sm text-white focus:outline-none focus:border-teal-400"
          >
            <option value="essencial">Custos Essenciais</option>
            <option value="estilo">Estilo de Vida</option>
            <option value="investimento">Investimentos</option>
          </select>
        </div>

        <div className="sm:col-span-1">
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || !newAmount}
            className="w-full h-9.5 flex items-center justify-center bg-teal-400 hover:bg-teal-300 disabled:opacity-40 disabled:hover:bg-teal-400 text-slate-950 font-bold rounded-lg transition shadow-md shadow-teal-500/10"
            title="Adicionar item"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden border border-slate-800 rounded-xl">
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-800/80">
          {filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              Nenhum item cadastrado nesta categoria.
            </div>
          ) : (
            filteredExpenses.map((item) => {
              const goal = AUVP_GOALS[item.category];

              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-950/40 hover:bg-slate-900/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: goal.color }}
                      title={goal.name}
                    />
                    <div>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) =>
                          onUpdateExpense(item.id, { name: e.target.value })
                        }
                        className="bg-transparent text-sm font-medium text-white hover:border-b hover:border-slate-700 focus:border-b focus:border-teal-400 focus:outline-none"
                      />
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded ${goal.accentBg} ${goal.accentText}`}
                        >
                          {item.category === 'essencial'
                            ? 'Essencial'
                            : item.category === 'estilo'
                            ? 'Estilo de Vida'
                            : 'Aportes & Futuro'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={item.amount}
                        onChange={(e) =>
                          onUpdateExpense(item.id, {
                            amount: Math.max(0, Number(e.target.value)),
                          })
                        }
                        className="w-28 bg-slate-900 border border-slate-800 focus:border-teal-400 rounded-lg px-2 py-1 text-sm font-semibold text-right text-white font-mono focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={() => onDeleteExpense(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                      title="Excluir despesa"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
```

---

### `components/FreedomSimulator.tsx`
```typescript
import React, { useState } from 'react';
import { FinancialProfile } from '../types';
import { calculateFireTarget, estimateMonthsToFire, formatCurrency } from '../utils/formatters';

interface FreedomSimulatorProps {
  monthlyEssentialCost: number;
  monthlyTotalCost: number;
  monthlyInvestment: number;
  profile: FinancialProfile;
}

export const FreedomSimulator: React.FC<FreedomSimulatorProps> = ({
  monthlyEssentialCost,
  monthlyTotalCost,
  monthlyInvestment,
  profile,
}) => {
  const [rateAnnual, setRateAnnual] = useState(10.5);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState(6.0);
  
  const emergencyFundTarget = monthlyEssentialCost * profile.desiredEmergencyMonths;
  const firePleno = calculateFireTarget(monthlyTotalCost, safeWithdrawalRate / 100);
  const fireEssencial = calculateFireTarget(monthlyEssentialCost, safeWithdrawalRate / 100);

  const monthsToFirePleno = estimateMonthsToFire(monthlyInvestment, firePleno, rateAnnual / 100);
  const yearsToFirePleno = (monthsToFirePleno / 12).toFixed(1);

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-400 text-lg">sailing</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">
            Simulador de Liberdade & Reserva de Emergência
          </h2>
        </div>
        <span className="text-xs bg-teal-500/10 text-teal-300 border border-teal-500/20 font-bold px-2.5 py-1 rounded-full">
          Marvit&Finances Pro
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                1. Reserva de Segurança
              </span>
              <span className="material-symbols-outlined text-cyan-400 text-[18px]">
                shield_with_heart
              </span>
            </div>
            <div className="text-xl font-black text-white mt-2">
              {formatCurrency(emergencyFundTarget)}
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Equivalente a <strong className="text-slate-200">{profile.desiredEmergencyMonths} meses</strong> dos seus custos essenciais ({formatCurrency(monthlyEssentialCost)}/mês). Recomendado em liquidez diária (Tesouro Selic / CDB 100% CDI).
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 text-xs text-slate-400 flex items-center justify-between">
            <span>Tempo estimado p/ formar:</span>
            <span className="font-bold text-cyan-400 font-mono">
              {monthlyInvestment > 0
                ? `${Math.ceil(emergencyFundTarget / monthlyInvestment)} meses`
                : 'Sem aportes'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                2. Liberdade Básica
              </span>
              <span className="material-symbols-outlined text-slate-300 text-[18px]">
                savings
              </span>
            </div>
            <div className="text-xl font-black text-white mt-2">
              {formatCurrency(fireEssencial)}
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Patrimônio acumulado para arcar com 100% dos seus custos essenciais vitaliciamente sem necessidade de trabalho ativo.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 text-xs text-slate-400 flex items-center justify-between">
            <span>Renda passiva gerada:</span>
            <span className="font-bold text-slate-200 font-mono">
              {formatCurrency(monthlyEssentialCost)}/mês
            </span>
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-teal-500/30 bg-gradient-to-b from-teal-950/20 to-slate-950 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-teal-300 tracking-wider">
                3. Liberdade Plena (Maldivas Life)
              </span>
              <span className="material-symbols-outlined text-teal-400 text-[18px]">
                diamond
              </span>
            </div>
            <div className="text-xl font-black text-teal-300 mt-2">
              {formatCurrency(firePleno)}
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Patrimônio investido que cobre seu custo de vida completo ({formatCurrency(monthlyTotalCost)}/mês) a uma taxa de retirada segura de {safeWithdrawalRate}% a.a.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-850 text-xs text-slate-400 flex items-center justify-between">
            <span>Horizonte c/ aporte atual:</span>
            <span className="font-bold text-teal-300 font-mono">
              {monthlyInvestment > 0 ? `~${yearsToFirePleno} anos` : 'Aporte zerado'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Rentabilidade Anual:</span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="30"
              value={rateAnnual}
              onChange={(e) => setRateAnnual(Number(e.target.value))}
              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-center focus:outline-none focus:border-teal-400"
            />
            <span className="text-slate-400">% a.a.</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Taxa Real de Retirada:</span>
            <input
              type="number"
              step="0.5"
              min="1"
              max="15"
              value={safeWithdrawalRate}
              onChange={(e) => setSafeWithdrawalRate(Number(e.target.value))}
              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono font-bold text-center focus:outline-none focus:border-teal-400"
            />
            <span className="text-slate-400">% a.a.</span>
          </div>
        </div>

        <div className="text-slate-400 text-right w-full sm:w-auto">
          Aporte atual: <strong className="text-teal-300">{formatCurrency(monthlyInvestment)}/mês</strong>
        </div>
      </div>
    </div>
  );
};
```

---

### `components/AdvicePanel.tsx`
```typescript
import React from 'react';
import { ExpenseCategory } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';

interface AdvicePanelProps {
  totalIncome: number;
  categoryTotals: Record<ExpenseCategory, number>;
  balance: number;
}

export const AdvicePanel: React.FC<AdvicePanelProps> = ({
  totalIncome,
  categoryTotals,
  balance,
}) => {
  const essencial = categoryTotals['essencial'] || 0;
  const estilo = categoryTotals['estilo'] || 0;
  const investimento = categoryTotals['investimento'] || 0;

  const percEssencial = totalIncome > 0 ? (essencial / totalIncome) * 100 : 0;
  const percEstilo = totalIncome > 0 ? (estilo / totalIncome) * 100 : 0;
  const percInvestimento = totalIncome > 0 ? (investimento / totalIncome) * 100 : 0;

  const insights: { title: string; desc: string; icon: string; tone: 'danger' | 'warning' | 'success' }[] = [];

  if (percEssencial > 60) {
    insights.push({
      title: 'Custos Fixos Acima do Recomendado',
      desc: `Seus gastos essenciais consomem ${formatPercent(percEssencial)} da sua renda (limite sugerido: 50%). Isso reduz sua elasticidade financeira em momentos de crise. Renegocie contratos ou otimize custos fixos.`,
      icon: 'warning',
      tone: 'danger',
    });
  } else if (percEssencial <= 50) {
    insights.push({
      title: 'Custos Fixos Saudáveis',
      desc: `Excelente! Seus essenciais estão em ${formatPercent(percEssencial)}, dentro da margem de segurança. Isso garante tranquilidade contínua.`,
      icon: 'verified',
      tone: 'success',
    });
  }

  if (percEstilo > 35) {
    insights.push({
      title: 'Atenção ao Estilo de Vida',
      desc: `Lazer e supérfluos totalizam ${formatPercent(percEstilo)} (o teto ideal é 30%). Evite antecipar padrões de consumo antes de consolidar seus ativos patrimoniais.`,
      icon: 'shopping_bag',
      tone: 'warning',
    });
  }

  if (percInvestimento < 15) {
    insights.push({
      title: 'Aporte Abaixo do Potencial',
      desc: `Você está destinando ${formatPercent(percInvestimento)} para investimentos (meta recomendada: 20%). A constância mensal é o catalisador primário dos juros compostos.`,
      icon: 'trending_down',
      tone: 'warning',
    });
  } else if (percInvestimento >= 25) {
    insights.push({
      title: 'Aceleração de Patrimônio Ativada',
      desc: `Investindo expressivos ${formatPercent(percInvestimento)} da renda! Você encurta sensivelmente seu tempo até a independência financeira total.`,
      icon: 'military_tech',
      tone: 'success',
    });
  }

  if (balance < 0) {
    insights.push({
      title: 'Balanço Negativo no Mês',
      desc: `Seus gastos superam suas receitas em ${formatCurrency(Math.abs(balance))}. Ajuste imediatamente antes que juros rotativos de crédito afetem seu patrimônio.`,
      icon: 'error',
      tone: 'danger',
    });
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-teal-400 text-lg">insights</span>
        </div>
        <h2 className="text-lg font-bold text-white tracking-wide">
          Diagnóstico Inteligente & Princípios Marvit
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {insights.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              item.tone === 'danger'
                ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                : item.tone === 'warning'
                ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                : 'bg-teal-950/20 border-teal-500/30 text-teal-200'
            }`}
          >
            <span
              className={`material-symbols-outlined mt-0.5 shrink-0 ${
                item.tone === 'danger'
                  ? 'text-rose-400'
                  : item.tone === 'warning'
                  ? 'text-amber-400'
                  : 'text-teal-400'
              }`}
            >
              {item.icon}
            </span>
            <div>
              <h4 className="text-sm font-bold text-white">{item.title}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 italic text-center">
        "O enriquecimento sustentável nasce da clareza orçamentária, aportes invariáveis e disciplina constante." — Filosofia Marvit&Finances
      </div>
    </div>
  );
};
```

---

### `components/HistoryManager.tsx`
```typescript
import React, { useState } from 'react';
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
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
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
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-400 text-lg">calendar_month</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Histórico & Comparativo Mensal
            </h2>
            <p className="text-xs text-slate-400">
              Acompanhe sua trajetória e evolução patrimonial mês a mês no Marvit&Finances.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            if (!newLabel) setNewLabel(defaultMonthName());
          }}
          className="px-3.5 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-teal-500/10"
        >
          <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
          <span>Salvar Mês Atual no Histórico</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-teal-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
              Registrar Snapshot do Mês
            </span>
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">
                Nome do Mês de Referência
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Novembro / 2024"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-300 block mb-1">
                Anotações do Mês (Opcional)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Ex: Aporte extra em fundos, rendimentos reinvestidos..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 bg-teal-400 hover:bg-teal-300 text-slate-950 font-bold text-xs rounded-lg transition"
            >
              Salvar Registro
            </button>
          </div>
        </div>
      )}

      <div className="mt-5">
        {history.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
            <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">history_edu</span>
            <p className="text-slate-400 text-sm font-medium">Nenhum mês histórico registrado ainda.</p>
            <p className="text-slate-500 text-xs mt-1">
              Clique em "Salvar Mês Atual no Histórico" para criar sua linha do tempo e acompanhar sua evolução no método.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item) => {
              const income = item.profile.monthlyIncome + item.profile.additionalIncome;
              const catTotals: Record<ExpenseCategory, number> = {
                essencial: 0,
                estilo: 0,
                investimento: 0,
              };
              item.expenses.forEach((e) => {
                catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
              });

              const totalExpenses = catTotals.essencial + catTotals.estilo + catTotals.investimento;
              const aportePercent = income > 0 ? (catTotals.investimento / income) * 100 : 0;

              return (
                <div
                  key={item.id}
                  className="bg-slate-950/80 border border-slate-800 hover:border-teal-500/40 rounded-xl p-4 flex flex-col justify-between transition group shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-white group-hover:text-teal-300 transition">
                          {item.monthLabel}
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Salvo em: {new Date(item.dateCreated).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                        {formatPercent(aportePercent)} aportes
                      </span>
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-400 italic bg-slate-900/60 p-2 rounded-lg mt-2 border border-slate-850">
                        "{item.notes}"
                      </p>
                    )}

                    <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Renda Total:</span>
                        <span className="font-semibold text-white">{formatCurrency(income)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Essenciais:</span>
                        <span>{formatCurrency(catTotals.essencial)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Estilo de Vida:</span>
                        <span>{formatCurrency(catTotals.estilo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Investimentos:</span>
                        <span className="font-bold text-teal-300">{formatCurrency(catTotals.investimento)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-1.5">
                        <span className="text-slate-400">Total de Despesas:</span>
                        <span className="font-semibold">{formatCurrency(totalExpenses)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onLoadSnapshot(item)}
                      className="px-2.5 py-1 rounded bg-slate-850 hover:bg-slate-800 text-xs font-semibold text-teal-300 hover:text-teal-200 border border-slate-700 transition flex items-center gap-1"
                      title="Carregar este mês para a calculadora"
                    >
                      <span className="material-symbols-outlined text-[15px]">file_open</span>
                      <span>Carregar p/ Tela</span>
                    </button>

                    <button
                      onClick={() => onDeleteSnapshot(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                      title="Excluir este mês do histórico"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### `App.tsx`
*(Consulte a versão completa em tempo de execução para visualizar a integração das abas, Flow.download e tratamento de estados).*
```typescript
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Flow } from 'flow-sdk';
// ... gerenciamento de fluxo orçamentário, exportação em PNG, JSON e README.md com Flow.download
```
