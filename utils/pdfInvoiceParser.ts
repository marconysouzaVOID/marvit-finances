import { CardPurchaseTag, CreditCardTransaction } from '../types';
import { inferCardPurchaseTag } from './formatters';

export interface InvoiceParseSummary {
  fileName: string;
  transactions: CreditCardTransaction[];
  totalAmount: number;
  ignoredPaymentsCount: number;
  ignoredPaymentsTotal: number;
  detectedBank?: string;
}

export interface PdfParseResult {
  success: boolean;
  needsPassword?: boolean;
  isWrongPassword?: boolean;
  error?: string;
  summary?: InvoiceParseSummary;
}

/** Garante que a biblioteca PDF.js esteja carregada no navegador */
export async function ensurePdfJs(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js só pode ser executado no navegador');
  }

  const win = window as any;
  if (win.pdfjsLib) {
    if (!win.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      win.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return win.pdfjsLib;
  }

  // Se ainda não carregou pelo index.html, injeta dinamicamente
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      const loadedLib = (window as any).pdfjsLib;
      if (loadedLib) {
        loadedLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(loadedLib);
      } else {
        reject(new Error('Falha ao inicializar PDF.js'));
      }
    };
    script.onerror = () =>
      reject(new Error('Erro ao carregar o script PDF.js via CDN'));
    document.head.appendChild(script);
  });
}

/** Normaliza representações de meses em português (ex: "12 out" -> "12/10") */
const PT_MONTHS: Record<string, string> = {
  jan: '01',
  fev: '02',
  mar: '03',
  abr: '04',
  mai: '05',
  jun: '06',
  jul: '07',
  ago: '08',
  set: '09',
  out: '10',
  nov: '11',
  dez: '12',
};

export function normalizeInvoiceDate(rawDate: string): string {
  const trimmed = rawDate.trim().toLowerCase();

  // Ex: "15/10/2026" ou "15/10/26" -> "15/10"
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\.](\d{1,2})(?:[\/\.]\d{2,4})?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    return `${day}/${month}`;
  }

  // Ex: "12 out" ou "12 de out" ou "12 out 2026"
  const wordMatch = trimmed.match(
    /^(\d{1,2})\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*(?:\s*\d{2,4})?$/i
  );
  if (wordMatch) {
    const day = wordMatch[1].padStart(2, '0');
    const monthCode = wordMatch[2].toLowerCase().substring(0, 3);
    const month = PT_MONTHS[monthCode] || '01';
    return `${day}/${month}`;
  }

  return rawDate;
}

/** Extrai informações de parcelamento da descrição (ex: "AMAZON 02/05" -> "Parcela 2/5") */
export function extractInstallmentInfo(rawDesc: string): {
  cleanTitle: string;
  installment: string;
} {
  let cleanTitle = rawDesc.trim();
  let installment = 'À vista';

  // 1. Padrão "Parcela X/Y" ou "- Parcela X/Y"
  const m1 = cleanTitle.match(/(?:-\s*)?Parcela\s+(\d+\/\d+)/i);
  if (m1) {
    installment = `Parcela ${m1[1]}`;
    cleanTitle = cleanTitle.replace(m1[0], '').trim();
    return { cleanTitle, installment };
  }

  // 2. Padrão "01/03" ou "2/6" no final da string
  const m2 = cleanTitle.match(/(?:\s+|-)(\d{1,2}\/\d{1,2})$/);
  if (m2) {
    installment = `Parcela ${m2[1]}`;
    cleanTitle = cleanTitle.substring(0, m2.index).trim();
    return { cleanTitle, installment };
  }

  // 3. Padrão "X de Y" (ex: "1 de 5")
  const m3 = cleanTitle.match(/(?:-\s*)?(\d{1,2})\s+de\s+(\d{1,2})$/i);
  if (m3) {
    installment = `Parcela ${m3[1]}/${m3[2]}`;
    cleanTitle = cleanTitle.substring(0, m3.index).trim();
    return { cleanTitle, installment };
  }

  return { cleanTitle, installment };
}

/** Converte texto de valor monetário brasileiro ("1.250,50", "R$ 45,90", "- 500,00") para número */
export function parseBrlAmount(rawVal: string): number {
  const isNegative = rawVal.includes('-') || /\b(estorno|crédito|credito|pgto|pagamento)\b/i.test(rawVal);
  const cleaned = rawVal.replace(/[R$\s\-+]/gi, '');
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  }
  const num = Number(normalized);
  if (!Number.isFinite(num)) return 0;
  return isNegative ? -Math.abs(num) : Math.abs(num);
}

/** Verifica se a linha indica pagamento de fatura anterior ou créditos para ignorar */
export function isPaymentOrCreditLine(desc: string, amount: number): boolean {
  if (amount < 0) return true;
  const lower = desc.toLowerCase();
  return (
    /pagamento\s+(?:de\s+fatura|recebido|efetuado|via\s+pix|por\s+debito)|quitac|credito\s+de\s+fatura|estorno\s+de\s+pagamento/i.test(
      lower
    )
  );
}

/** Expressão regular flexível para identificar linhas de transações bancárias em PDF */
const TX_LINE_REGEX =
  /^(\d{1,2}[\/\.]\d{1,2}(?:[\/\.]\d{2,4})?|\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*(?:\s*\d{2,4})?)\s+(.+?)\s+(-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*(?:R\$\s*)?\d+,\d{2}|\d{1,3}(?:\.\d{3})*,\d{2}\s*-)$/i;

/** Palavras ou frases que indicam que a linha NÃO é uma compra comum */
const IGNORED_HEADER_FOOTER_PATTERNS = [
  /total\s+da\s+fatura/i,
  /vencimento/i,
  /pagamento\s+m[íi]nimo/i,
  /saldo\s+anterior/i,
  /limite\s+(?:total|utilizado|dispon[íi]vel)/i,
  /encargos\s+financeiros/i,
  /taxas\s+e\s+tarifas/i,
  /cet\s+anual/i,
  /central\s+de\s+atendimento/i,
  /ouvidoria/i,
  /p[áa]gina\s+\d+/i,
  /banco\s+inter\s+s\.?a\.?/i,
  /autentica[çc][ãa]o\s+mec[âa]nica/i,
  /resumo\s+da\s+fatura/i,
];

/**
 * Faz a leitura de uma fatura de cartão em PDF (Banco Inter, Nubank, C6, Itaú, etc.)
 * Suporta descriptografia de PDFs protegidos por senha (ex: dígitos do CPF do Inter).
 */
export async function parsePdfInvoice(
  pdfBuffer: ArrayBuffer,
  fileName = 'fatura.pdf',
  password?: string
): Promise<PdfParseResult> {
  try {
    const pdfjs = await ensurePdfJs();

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      password: password || undefined,
    });

    const pdfDoc = await loadingTask.promise;
    const transactions: CreditCardTransaction[] = [];
    let ignoredPaymentsCount = 0;
    let ignoredPaymentsTotal = 0;
    let detectedBank = 'Banco Inter';

    // Varre todas as páginas do PDF
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Agrupa os itens de texto espacialmente por coordenada vertical Y
      interface TextChunk {
        str: string;
        x: number;
        y: number;
      }
      const linesMap: { y: number; items: TextChunk[] }[] = [];

      for (const item of textContent.items as any[]) {
        const str = (item.str || '').trim();
        if (!str) continue;

        // Detectar menções a bancos conhecidos
        if (/banco\s+inter|inter\s+dtvm/i.test(str)) detectedBank = 'Banco Inter';
        else if (/nubank|nu\s+pagamentos/i.test(str)) detectedBank = 'Nubank';
        else if (/c6\s+bank/i.test(str)) detectedBank = 'C6 Bank';
        else if (/ita[úu]/i.test(str)) detectedBank = 'Itaú';

        const x = item.transform ? item.transform[4] : 0;
        const y = item.transform ? item.transform[5] : 0;

        let existingLine = linesMap.find((line) => Math.abs(line.y - y) <= 3.8);
        if (!existingLine) {
          existingLine = { y, items: [] };
          linesMap.push(existingLine);
        }
        existingLine.items.push({ str, x, y });
      }

      // Ordenar do topo para a base da página (Y decrescente)
      linesMap.sort((a, b) => b.y - a.y);

      // Em cada linha, ordenar da esquerda para a direita (X crescente)
      for (const line of linesMap) {
        line.items.sort((a, b) => a.x - b.x);
        const lineText = line.items.map((i) => i.str).join(' ').trim();

        // Verificar se deve ser ignorada (cabeçalho, rodapé ou resumo geral)
        if (IGNORED_HEADER_FOOTER_PATTERNS.some((p) => p.test(lineText))) {
          continue;
        }

        const match = lineText.match(TX_LINE_REGEX);
        if (match) {
          const rawDate = match[1];
          const rawDesc = match[2];
          const rawVal = match[3];

          const amount = parseBrlAmount(rawVal);
          if (amount === 0) continue;

          // Se for pagamento da fatura ou crédito de estorno
          if (isPaymentOrCreditLine(rawDesc, amount)) {
            ignoredPaymentsCount += 1;
            ignoredPaymentsTotal += Math.abs(amount);
            continue;
          }

          const { cleanTitle, installment } = extractInstallmentInfo(rawDesc);
          const formattedDate = normalizeInvoiceDate(rawDate);

          transactions.push({
            id: `pdf-tx-${Date.now()}-${transactions.length + 1}`,
            description: cleanTitle,
            amount: Math.round(amount * 100) / 100,
            tag: inferCardPurchaseTag(cleanTitle),
            installment,
            purchaseDate: formattedDate,
            notes: `Fatura ${detectedBank} (${fileName})`,
          });
        }
      }
    }

    const totalAmount =
      Math.round(transactions.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

    return {
      success: true,
      summary: {
        fileName,
        transactions,
        totalAmount,
        ignoredPaymentsCount,
        ignoredPaymentsTotal: Math.round(ignoredPaymentsTotal * 100) / 100,
        detectedBank,
      },
    };
  } catch (err: any) {
    const isPasswordError =
      err?.name === 'PasswordException' ||
      err?.code === 1 ||
      err?.code === 2 ||
      /password/i.test(err?.message || '');

    if (isPasswordError) {
      const isWrong = Boolean(password && password.trim().length > 0);
      return {
        success: false,
        needsPassword: true,
        isWrongPassword: isWrong,
        error: isWrong
          ? 'Senha incorreta. No Banco Inter, tente os 5 ou 6 primeiros dígitos do seu CPF.'
          : 'Esta fatura em PDF está protegida por senha.',
      };
    }

    return {
      success: false,
      error:
        err?.message ||
        'Não foi possível extrair as informações da fatura em PDF. Verifique se o arquivo não está corrompido.',
    };
  }
}

/** Verifica se um arquivo é PDF pela extensão ou tipo MIME */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}
