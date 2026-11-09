import {
  CustomGoalItem,
  ExpenseCategory,
  ExpenseItem,
  FinancialProfile,
  MarvitBackupData,
} from '../types';
import {
  calculateGoalProjection,
  formatCurrency,
  formatPercent,
} from './formatters';

export interface PreparedExportFile {
  filename: string;
  mimeType: string;
  blob: Blob;
  kind: 'png' | 'md' | 'json';
  title: string;
  subtitle: string;
  previewDataUrl?: string;
}

export function isMobileOrTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(ua)) {
    return true;
  }
  if (
    navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 1 &&
    /Macintosh/i.test(ua)
  ) {
    return true; // iPadOS
  }
  return window.matchMedia?.('(max-width: 768px)')?.matches ?? false;
}

/**
 * Faz o download via Blob URL mantendo a URL viva por 60 segundos
 * (evita o bug no mobile onde URL.revokeObjectURL síncrono aborta o pop-up de download do navegador).
 */
export function triggerBrowserBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
  }, 1500);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
}

/**
 * Constrói um objeto File compatível com Web Share API Level 2 no Android e no iOS.
 * Alguns navegadores mobile (Chromium no Android) rejeitam application/json ou text/markdown no canShare,
 * mas aceitam text/plain mantendo a extensão original (.json / .md) intacta!
 */
function buildShareableFile(
  blob: Blob,
  filename: string,
  mimeType: string
): File | null {
  if (typeof File === 'undefined') return null;
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share !== 'function') return null;

  try {
    const primaryFile = new File([blob], filename, {
      type: mimeType,
      lastModified: Date.now(),
    });
    if (!nav.canShare || nav.canShare({ files: [primaryFile] })) {
      return primaryFile;
    }

    // Fallback de MIME type para Chromium mobile (.json e .md) preservando o nome e extensão do arquivo
    const plainBlob = new Blob([blob], { type: 'text/plain;charset=utf-8' });
    const fallbackFile = new File([plainBlob], filename, {
      type: 'text/plain',
      lastModified: Date.now(),
    });
    if (nav.canShare({ files: [fallbackFile] })) {
      return fallbackFile;
    }
  } catch {
    return null;
  }

  return null;
}

export function canUseNativeMobileShare(item: PreparedExportFile): boolean {
  return Boolean(buildShareableFile(item.blob, item.filename, item.mimeType));
}

/**
 * Abre o seletor/pop-up nativo para o usuário escolher onde salvar o arquivo:
 * - No Mobile (iOS / Android / PWA): aciona a folha nativa do sistema (`navigator.share({ files })` -> "Salvar em Arquivos", "Salvar no Drive", "Gerenciador de Pastas") ou `showSaveFilePicker`, com fallback para download Blob com revogação tardia.
 * - No Desktop: aciona `window.showSaveFilePicker` ("Salvar como...") ou download Blob.
 */
export async function saveExportedFileWithPrompt(
  item: PreparedExportFile,
  mode: 'auto' | 'share' | 'download' = 'auto'
): Promise<'shared' | 'picked' | 'downloaded' | 'cancelled'> {
  if (mode === 'download') {
    triggerBrowserBlobDownload(item.blob, item.filename);
    return 'downloaded';
  }

  const isMobile = isMobileOrTouchDevice();

  // 1. No mobile (ou quando explicitamente solicitado 'share'), prioriza a folha nativa de salvar/compartilhar arquivo
  if (mode === 'share' || isMobile) {
    const shareFile = buildShareableFile(
      item.blob,
      item.filename,
      item.mimeType
    );
    if (shareFile && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          files: [shareFile],
          title: item.filename,
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return 'cancelled';
        }
        // Se falhar por outro motivo, continua para os próximos métodos
      }
    }
  }

  // 2. File System Access API (abre a janela nativa "Salvar como..." para escolher a pasta)
  const win = window as Window & {
    showSaveFilePicker?: (options?: any) => Promise<any>;
  };
  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const ext = `.${item.kind}`;
      const handle = await win.showSaveFilePicker({
        suggestedName: item.filename,
        types: [
          {
            description: item.title,
            accept: {
              [item.mimeType.split(';')[0]]: [ext],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(item.blob);
      await writable.close();
      return 'picked';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  // 3. Fallback universal com Blob URL persistente por 60s
  triggerBrowserBlobDownload(item.blob, item.filename);
  return 'downloaded';
}

export function downloadBase64Png(base64Data: string, filename: string): void {
  const binaryStr = window.atob(base64Data);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'image/png' });
  triggerBrowserBlobDownload(blob, filename);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/plain;charset=utf-8'
): void {
  const blob = new Blob([content], { type: mimeType });
  triggerBrowserBlobDownload(blob, filename);
}

export function prepareBackupJsonFile(
  data: MarvitBackupData
): PreparedExportFile {
  const jsonString = JSON.stringify(data, null, 2);
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `marvit-finances-backup-${dateTag}.json`;
  const mimeType = 'application/json';
  const blob = new Blob([jsonString], { type: mimeType });
  return {
    filename,
    mimeType,
    blob,
    kind: 'json',
    title: 'Backup Completo (.JSON)',
    subtitle: 'Contém todos os meses do calendário, faturas de cartões, metas e histórico.',
  };
}

export function exportBackupJson(data: MarvitBackupData): PreparedExportFile {
  const prepared = prepareBackupJsonFile(data);
  triggerBrowserBlobDownload(prepared.blob, prepared.filename);
  return prepared;
}

export function prepareMarkdownReportFile(params: {
  profile: FinancialProfile;
  customGoals: Record<ExpenseCategory, number>;
  categoryTotals: Record<ExpenseCategory, number>;
  expenses: ExpenseItem[];
  customLongTermGoals: CustomGoalItem[];
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}): PreparedExportFile {
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
    lines.push(
      `- **[${e.category.toUpperCase()}]** ${e.name}: ${formatCurrency(e.amount)}`
    );
  });

  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `marvit-finances-relatorio-${dateTag}.md`;
  const mimeType = 'text/markdown;charset=utf-8';
  const blob = new Blob([lines.join('\n')], { type: mimeType });

  return {
    filename,
    mimeType,
    blob,
    kind: 'md',
    title: 'Resumo Executivo (.MD)',
    subtitle: 'Documento formatado em Markdown com resumo dos pilares, metas e gastos.',
  };
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
}): PreparedExportFile {
  const prepared = prepareMarkdownReportFile(params);
  triggerBrowserBlobDownload(prepared.blob, prepared.filename);
  return prepared;
}
