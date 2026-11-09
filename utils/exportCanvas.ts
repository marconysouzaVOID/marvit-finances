import { CustomGoalItem, ExpenseCategory, ExpenseItem, FinancialProfile } from '../types';
import { formatCurrency, formatPercent } from './formatters';

export interface ExportReportData {
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  categoryTotals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  customLongTermGoals?: CustomGoalItem[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface GeneratedReportImage {
  base64: string;
  dataUrl: string;
  blob: Blob;
}

function base64ToPngBlob(base64: string): Blob {
  const binaryStr = window.atob(base64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/png' });
}

/** Renderiza de forma 100% síncrona (preservando o gesto de toque no mobile) um relatório gráfico estilizado em alta resolução (1200x1680) */
export function generateReportImageSync(data: ExportReportData): GeneratedReportImage {
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 1680;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Falha ao obter contexto 2D');

  // Fundo Creme de Aveia & Bege Quente (Cozy Kitchen)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#FAF6F0');
  bgGrad.addColorStop(0.5, '#FFFDF9');
  bgGrad.addColorStop(1, '#F2ECE1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Halo decorativo Verde Maldivas & Terracota Suave no topo
  const topGlow = ctx.createRadialGradient(width / 2, 0, 20, width / 2, 0, 720);
  topGlow.addColorStop(0, 'rgba(20, 184, 166, 0.16)');
  topGlow.addColorStop(0.6, 'rgba(217, 119, 87, 0.06)');
  topGlow.addColorStop(1, 'rgba(250, 246, 240, 0)');
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, 500);

  // Moldura estilo caderno/receituário aconchegante
  ctx.strokeStyle = '#E6DEC8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(32, 32, width - 64, height - 64, 28);
  ctx.stroke();

  // Cabeçalho - Emblema Verde Maldivas
  ctx.fillStyle = '#14B8A6';
  ctx.beginPath();
  ctx.roundRect(70, 68, 60, 60, 18);
  ctx.fill();

  ctx.fillStyle = '#FFFDF9';
  ctx.font = '800 34px "Fraunces", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('M', 100, 110);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#2C2523';
  ctx.font = 'bold 34px "Fraunces", Georgia, serif';
  ctx.fillText('Marvit&Finances', 150, 96);

  ctx.fillStyle = '#6E6259';
  ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `Caderno Orçamentário & Metas • Emitido em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    150,
    122
  );

  // Linha divisória
  ctx.strokeStyle = '#E6DEC8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(70, 152);
  ctx.lineTo(width - 70, 152);
  ctx.stroke();

  // Cards de Renda & Saldo
  const drawCard = (
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    value: string,
    color: string,
    bgColor: string,
    borderColor: string
  ) => {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 20);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#6E6259';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(title.toUpperCase(), x + 24, y + 36);

    ctx.fillStyle = color;
    ctx.font = 'bold 28px "JetBrains Mono", monospace';
    ctx.fillText(value, x + 24, y + 78);
  };

  drawCard(
    70,
    176,
    330,
    106,
    'Renda Total Líquida',
    formatCurrency(data.totalIncome),
    '#0D9488',
    '#ECFDF9',
    '#A7F3DF'
  );
  drawCard(
    435,
    176,
    330,
    106,
    'Total de Gastos & Aportes',
    formatCurrency(data.totalExpenses),
    '#2C2523',
    '#FFFDF9',
    '#E6DEC8'
  );
  drawCard(
    800,
    176,
    330,
    106,
    'Sobra / Balanço Mensal',
    formatCurrency(data.balance),
    data.balance >= 0 ? '#0D9488' : '#BF5B3D',
    data.balance >= 0 ? '#F4F8F6' : '#FDF4F0',
    data.balance >= 0 ? '#CFE7E2' : '#F5D0C2'
  );

  // Seção 1: Pilares e Porcentagens
  ctx.fillStyle = '#2C2523';
  ctx.font = 'bold 24px "Fraunces", Georgia, serif';
  ctx.fillText('1. Pilares da Casa (Metas vs. Realizado)', 70, 328);

  const pillars = [
    {
      name: 'Custos Essenciais & Despensa',
      cat: 'essencial' as ExpenseCategory,
      target: data.customGoals.essencial,
      spent: data.categoryTotals.essencial,
      color: '#658B6E',
      track: '#E6F0EC',
    },
    {
      name: 'Estilo de Vida & Conforto',
      cat: 'estilo' as ExpenseCategory,
      target: data.customGoals.estilo,
      spent: data.categoryTotals.estilo,
      color: '#D97757',
      track: '#FBECE6',
    },
    {
      name: 'Investimentos & Liberdade',
      cat: 'investimento' as ExpenseCategory,
      target: data.customGoals.investimento,
      spent: data.categoryTotals.investimento,
      color: '#14B8A6',
      track: '#D1FAEE',
    },
  ];

  pillars.forEach((p, index) => {
    const cardY = 348 + index * 120;
    const currentPercent = data.totalIncome > 0 ? (p.spent / data.totalIncome) * 100 : 0;
    const targetAmount = (data.totalIncome * p.target) / 100;

    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.roundRect(70, cardY, width - 140, 106, 18);
    ctx.fill();
    ctx.strokeStyle = '#E6DEC8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(98, cardY + 34, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2C2523';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${p.name} (Meta: ${p.target}%)`, 118, cardY + 41);

    ctx.fillStyle = '#2C2523';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(p.spent), width - 95, cardY + 41);

    ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#6E6259';
    ctx.fillText(
      `Teto: ${formatCurrency(targetAmount)} • ${formatPercent(currentPercent)} da renda`,
      width - 95,
      cardY + 65
    );
    ctx.textAlign = 'left';

    const barWidth = width - 190;
    ctx.fillStyle = p.track;
    ctx.beginPath();
    ctx.roundRect(95, cardY + 78, barWidth, 12, 6);
    ctx.fill();

    const fillWidth = Math.min(barWidth, (barWidth * currentPercent) / 100);
    if (fillWidth > 0) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(95, cardY + 78, fillWidth, 12, 6);
      ctx.fill();
    }
  });

  // Seção 2: Detalhamento de Gastos
  const listStartY = 742;
  ctx.fillStyle = '#2C2523';
  ctx.font = 'bold 24px "Fraunces", Georgia, serif';
  ctx.fillText('2. Principais Gastos & Aportes Mensais', 70, listStartY);

  const sortedExpenses = [...data.expenses].sort((a, b) => b.amount - a.amount).slice(0, 9);

  ctx.fillStyle = '#F2ECE1';
  ctx.beginPath();
  ctx.roundRect(70, listStartY + 14, width - 140, 38, 10);
  ctx.fill();

  ctx.fillStyle = '#5C4F4B';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ITEM / DESCRIÇÃO', 92, listStartY + 38);
  ctx.fillText('PILAR', 640, listStartY + 38);
  ctx.textAlign = 'right';
  ctx.fillText('VALOR MENSAL (R$)', width - 95, listStartY + 38);
  ctx.textAlign = 'left';

  sortedExpenses.forEach((item, idx) => {
    const rowY = listStartY + 56 + idx * 42;
    ctx.fillStyle = idx % 2 === 0 ? '#FFFDF9' : '#FAF6F0';
    ctx.fillRect(70, rowY, width - 140, 40);

    ctx.fillStyle = '#2C2523';
    ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(item.name, 92, rowY + 25);

    const catLabel =
      item.category === 'essencial'
        ? 'Essencial'
        : item.category === 'estilo'
        ? 'Estilo de Vida'
        : 'Investimentos';

    const catColor =
      item.category === 'essencial'
        ? '#4F6F57'
        : item.category === 'estilo'
        ? '#BF5B3D'
        : '#0D9488';

    ctx.fillStyle = catColor;
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(catLabel, 640, rowY + 25);

    ctx.fillStyle = '#2C2523';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatCurrency(item.amount), width - 95, rowY + 25);
    ctx.textAlign = 'left';
  });

  // Seção 3: Liberdade Financeira & Potes dos Sonhos
  const fireStartY = 1200;
  ctx.fillStyle = '#ECFDF9';
  ctx.beginPath();
  ctx.roundRect(70, fireStartY, width - 140, 210, 22);
  ctx.fill();
  ctx.strokeStyle = '#14B8A6';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 22px "Fraunces", Georgia, serif';
  ctx.fillText('★ Planejamento de Liberdade Financeira & Potes dos Sonhos', 98, fireStartY + 42);

  const monthlyInvestment = data.categoryTotals.investimento;
  const annualCost = (data.categoryTotals.essencial + data.categoryTotals.estilo) * 12;
  const firePatrimony = annualCost / 0.06;
  const goalsCount = data.customLongTermGoals?.length || 0;
  const goalsAccumulated =
    data.customLongTermGoals?.reduce((acc, g) => acc + g.currentAmount, 0) || 0;

  ctx.fillStyle = '#2C2523';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`• Custo Anual de Vida: ${formatCurrency(annualCost)}`, 98, fireStartY + 80);
  ctx.fillText(
    `• Patrimônio para Liberdade Plena (Regra 6% a.a. real): ${formatCurrency(firePatrimony)}`,
    98,
    fireStartY + 112
  );
  ctx.fillText(
    `• Aporte Mensal Atual: ${formatCurrency(monthlyInvestment)} (${formatPercent(
      data.totalIncome > 0 ? (monthlyInvestment / data.totalIncome) * 100 : 0
    )} da renda)`,
    98,
    fireStartY + 144
  );
  ctx.fillText(
    `• Reserva de Segurança (${data.profile.desiredEmergencyMonths}m): ${formatCurrency(
      data.categoryTotals.essencial * data.profile.desiredEmergencyMonths
    )}  |  Potes dos Sonhos (${goalsCount}): ${formatCurrency(goalsAccumulated)} acumulados`,
    98,
    fireStartY + 176
  );

  // Rodapé
  ctx.fillStyle = '#6E6259';
  ctx.font = 'italic 15px "Fraunces", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    '“Marvit&Finances: Clareza orçamentária, aportes constantes e uma vida leve com sabor de conquista.”',
    width / 2,
    height - 56
  );

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const blob = base64ToPngBlob(base64);
  return { base64, dataUrl, blob };
}

export async function generateReportImageBase64(data: ExportReportData): Promise<string> {
  return generateReportImageSync(data).base64;
}

