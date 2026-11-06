import { CustomGoalItem, ExpenseCategory, ExpenseItem, FinancialProfile, MarvitBackupData } from '../types';
import { calculateGoalProjection, formatCurrency, formatPercent } from './formatters';

export function downloadBase64Png(base64Data: string, filename: string): void {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64Data}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportBackupJson(data: MarvitBackupData): void {
  const jsonString = JSON.stringify(data, null, 2);
  const dateTag = new Date().toISOString().slice(0, 10);
  downloadTextFile(jsonString, `marvit-finances-backup-${dateTag}.json`, 'application/json');
}

export function exportMarkdownReport(params: {
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  categoryTotals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  customLongTermGoals: CustomGoalItem[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}): void {
  const {
    profile,
    customGoals,
    categoryTotals,
    expenses,
    customLongTermGoals,
    totalIncome,
    totalExpenses,
    balance,
  } = params;

  const lines: string[] = [
    '# 🌿 Marvit&Finances — Relatório Financeiro & Potes dos Sonhos',
    '',
    `> **Gerado em:** ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
    '',
    '## 1. Resumo de Fluxo de Caixa Mensal',
    `- **Salário / Renda Principal:** ${formatCurrency(profile.monthlyIncome)}`,
    `- **Renda Extra / Dividendos:** ${formatCurrency(profile.additionalIncome)}`,
    `- **Renda Líquida Total:** **${formatCurrency(totalIncome)}**`,
    `- **Total de Gastos & Aportes:** ${formatCurrency(totalExpenses)}`,
    `- **Sobra / Balanço Livre:** **${formatCurrency(balance)}**`,
    '',
    '## 2. Alocação por Pilares',
    `| Pilar | Meta (%) | Teto Ideal (R$) | Realizado (R$) | % da Renda |`,
    `| :--- | :---: | :---: | :---: | :---: |`,
    `| Custos Essenciais | ${customGoals.essencial}% | ${formatCurrency((totalIncome * customGoals.essencial) / 100)} | ${formatCurrency(categoryTotals.essencial)} | ${formatPercent(totalIncome > 0 ? (categoryTotals.essencial / totalIncome) * 100 : 0)} |`,
    `| Estilo de Vida | ${customGoals.estilo}% | ${formatCurrency((totalIncome * customGoals.estilo) / 100)} | ${formatCurrency(categoryTotals.estilo)} | ${formatPercent(totalIncome > 0 ? (categoryTotals.estilo / totalIncome) * 100 : 0)} |`,
    `| Investimentos & Futuro | ${customGoals.investimento}% | ${formatCurrency((totalIncome * customGoals.investimento) / 100)} | ${formatCurrency(categoryTotals.investimento)} | ${formatPercent(totalIncome > 0 ? (categoryTotals.investimento / totalIncome) * 100 : 0)} |`,
    '',
    '## 3. Potes dos Sonhos (Metas de Longo Prazo)',
  ];

  if (customLongTermGoals.length === 0) {
    lines.push('_Nenhuma meta personalizada cadastrada._');
  } else {
    customLongTermGoals.forEach((g) => {
      const proj = calculateGoalProjection(
        g.targetAmount,
        g.currentAmount,
        g.monthlyContribution,
        g.annualInterestRate
      );
      lines.push(
        `- **${g.title}**: ${formatCurrency(g.currentAmount)} de ${formatCurrency(
          g.targetAmount
        )} (${formatPercent(proj.progressPercent)}) • Aporte: ${formatCurrency(
          g.monthlyContribution
        )}/mês • Previsão: **${proj.estimatedDateLabel}** (${proj.yearsFormatted})`
      );
    });
  }

  lines.push('', '## 4. Detalhamento da Planilha Mensal');
  expenses.forEach((e) => {
    lines.push(`- **[${e.category.toUpperCase()}]** ${e.name}: ${formatCurrency(e.amount)}`);
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  downloadTextFile(
    lines.join('\n'),
    `marvit-finances-relatorio-${dateTag}.md`,
    'text/markdown;charset=utf-8'
  );
}

