import { CardPurchaseTag, CreditCardTransaction } from '../types';
import { inferCardPurchaseTag } from './formatters';

export interface InvoiceParseSummary {
  fileName: string;
  transactions: CreditCardTransaction[];
  totalAmount: number;
  ignoredPaymentsCount: number;
  ignoredPaymentsTotal: number;
  detectedBank?: string;
  rawLines?: string[];
}

export interface PdfParseResult {
  success: boolean;
  needsPassword?: boolean;
  isWrongPassword?: boolean;
  error?: string;
  summary?: InvoiceParseSummary;
  rawLines?: string[];
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

  // Ex: "27 de set. 2026" ou "27 de set 2026" ou "27 set." ou "27 set"
  const ptExtMatch = trimmed.match(
    /^(\d{1,2})\s+(?:de\s+)?([a-z]{3,4})\.?(?:\s+(?:de\s+)?\d{2,4})?$/i
  );
  if (ptExtMatch) {
    const day = ptExtMatch[1].padStart(2, '0');
    const monthCode = ptExtMatch[2].substring(0, 3);
    const month = PT_MONTHS[monthCode] || '01';
    return `${day}/${month}`;
  }

  // Ex: "15/10/2026", "15.10.2026", "15-10-2026", "15/10"
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})(?:[\/\.-]\d{2,4})?$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    return `${day}/${month}`;
  }

  // Ex: "15/out", "15/out/2026", "15-out-2026"
  const slashMonthMatch = trimmed.match(
    /^(\d{1,2})[\/\.-](jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:[\/\.-]\d{2,4})?$/i
  );
  if (slashMonthMatch) {
    const day = slashMonthMatch[1].padStart(2, '0');
    const monthCode = slashMonthMatch[2].toLowerCase().substring(0, 3);
    const month = PT_MONTHS[monthCode] || '01';
    return `${day}/${month}`;
  }

  // Ex: "12 out" ou "12 de out" ou "12 out 2026"
  const wordMatch = trimmed.match(
    /^(\d{1,2})\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?(?:\s*\d{2,4})?$/i
  );
  if (wordMatch) {
    const day = wordMatch[1].padStart(2, '0');
    const monthCode = wordMatch[2].toLowerCase().substring(0, 3);
    const month = PT_MONTHS[monthCode] || '01';
    return `${day}/${month}`;
  }

  return rawDate;
}

/** Extrai informações de parcelamento da descrição ou de texto sufixo */
export function extractInstallmentInfo(
  rawDesc: string,
  trailingStr?: string
): {
  cleanTitle: string;
  installment: string;
} {
  let cleanTitle = rawDesc.trim();
  let installment = 'À vista';

  // 0. Padrão Banco Inter / Bancos BR: "(Parcela 07 de 10)" ou "Parcela 07 de 10" ou "(Parcela 07/10)"
  const interInstallmentMatch = cleanTitle.match(
    /\(?\s*Parcela\s+(\d{1,2})\s+(?:de|\/)\s+(\d{1,2})\s*\)?/i
  );
  if (interInstallmentMatch) {
    installment = `Parcela ${interInstallmentMatch[1].padStart(2, '0')}/${interInstallmentMatch[2].padStart(2, '0')}`;
    cleanTitle = cleanTitle
      .replace(interInstallmentMatch[0], '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return { cleanTitle, installment };
  }

  // 1. Verificar se o sufixo contém parcela (ex: "01/03" ou "Parcela 2 de 5")
  if (trailingStr && trailingStr.trim()) {
    const t = trailingStr.trim();
    const tmInter = t.match(/\(?\s*Parcela\s+(\d{1,2})\s+(?:de|\/)\s+(\d{1,2})\s*\)?/i);
    if (tmInter) {
      return {
        cleanTitle,
        installment: `Parcela ${tmInter[1].padStart(2, '0')}/${tmInter[2].padStart(2, '0')}`,
      };
    }

    const tm1 = t.match(/(?:-\s*)?Parcela\s+(\d+\/\d+)/i);
    if (tm1) return { cleanTitle, installment: `Parcela ${tm1[1]}` };

    const tm2 = t.match(/(\d{1,2}\/\d{1,2})/);
    if (tm2) return { cleanTitle, installment: `Parcela ${tm2[1]}` };

    const tm3 = t.match(/(\d{1,2})\s+de\s+(\d{1,2})/i);
    if (tm3) return { cleanTitle, installment: `Parcela ${tm3[1]}/${tm3[2]}` };
  }

  // 2. Padrão "Parcela X/Y" ou "- Parcela X/Y" no corpo da descrição
  const m1 = cleanTitle.match(/(?:-\s*)?Parcela\s+(\d+\/\d+)/i);
  if (m1) {
    installment = `Parcela ${m1[1]}`;
    cleanTitle = cleanTitle.replace(m1[0], '').trim();
    return { cleanTitle, installment };
  }

  // 3. Padrão "01/03" ou "2/6" no final da string
  const m2 = cleanTitle.match(/(?:\s+|-)(\d{1,2}\/\d{1,2})$/);
  if (m2) {
    installment = `Parcela ${m2[1]}`;
    cleanTitle = cleanTitle.substring(0, m2.index).trim();
    return { cleanTitle, installment };
  }

  // 4. Padrão "X de Y" (ex: "1 de 5")
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
  const isNegative =
    (rawVal.includes('-') && !rawVal.includes('+')) ||
    /\b(estorno|crédito|credito|pgto|pagamento)\b/i.test(rawVal);
  const cleaned = rawVal.replace(/[R$US\s\-+]/gi, '');
  let normalized = cleaned;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  }
  const num = Number(normalized);
  if (!Number.isFinite(num)) return 0;
  return isNegative ? -Math.abs(num) : Math.abs(num);
}

/** Verifica se a linha indica pagamento de fatura anterior ou créditos para ignorar */
export function isPaymentOrCreditLine(
  desc: string,
  amount: number,
  rawVal?: string
): boolean {
  if (rawVal && rawVal.includes('+')) return true;
  if (amount < 0) return true;
  const lower = desc.toLowerCase();
  return /p\s*agto|pagamento|quitac|credito\s+de\s+fatura|estorno\s+de\s+pagamento/i.test(
    lower
  );
}

/** Expressões regulares especializadas para faturas do Banco Inter e bancos brasileiros */
const TX_INTER = /^(\d{1,2}\s+de\s+[a-z]{3,4}\.?\s+\d{2,4})\s+(.+?)\s+-\s*([+-]?\s*(?:R\$\s*|US\$\s*)?[\d\.]+,\d{2})$/i;
const TX_STANDARD_HYPHEN = /^(\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?)\s+(.+?)\s+-\s*([+-]?\s*(?:R\$\s*|US\$\s*)?[\d\.]+,\d{2})$/i;

const DATE_PATTERN =
  '(\\d{1,2}(?:[\\/\\.-]|\\s+(?:de\\s+)?)(?:\\d{1,2}|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\\.?(?:[\\/\\.-]\\d{2,4}|\\s+\\d{2,4})?)';

const AMOUNT_PATTERN =
  '([+-]?\\s*(?:-\\s*)?(?:R\\$\\s*|US\\$\\s*)?\\d{1,3}(?:\\.\\d{3})*,\\d{2}|[+-]?\\s*(?:-\\s*)?(?:R\\$\\s*|US\\$\\s*)?\\d+,\\d{2}|\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\s*-)';

// Padrão com Data primeiro: "15/10 IFOOD 45,90" ou "15/10/2026 SHEIN 120,00 01/03"
const TX_DATE_FIRST = new RegExp(
  `(?:^|\\s+)${DATE_PATTERN}\\s+(.+?)(?:\\s+-\\s*|\\s+)${AMOUNT_PATTERN}(?:\\s+(.*))?$`,
  'i'
);

// Padrão com Estabelecimento primeiro: "IFOOD RESTAURANTE 15/10 45,90"
const TX_DESC_FIRST = new RegExp(
  `^(.+?)\\s+${DATE_PATTERN}(?:\\s+-\\s*|\\s+)${AMOUNT_PATTERN}(?:\\s+(.*))?$`,
  'i'
);

/** Palavras do cabeçalho / resumo geral que NÃO são compras */
const NON_PURCHASE_PHRASES = [
  /total\s+da\s+(?:sua\s+)?fatura/i,
  /total\s+cart[ãa]o/i,
  /vencimento/i,
  /pagamento\s+m[íi]nimo/i,
  /saldo\s+anterior/i,
  /limite\s+(?:total|utilizado|dispon[íi]vel|de\s+cr[ée]dito)/i,
  /encargos\s+financeiros/i,
  /autentica[çc][ãa]o\s+mec[âa]nica/i,
  /resumo\s+da\s+fatura/i,
  /op[çc][õo]es\s+de\s+parcelamento/i,
  /parcelamento\s+total/i,
  /1\s*\+\s*\d+\s+de\s+r\$/i,
  /taxa\s+efetiva/i,
  /descritivo\s+detalhado/i,
  /despesas\s+do\s+m[êe]s/i,
  /valor\s+antecipado/i,
  /fatura\s+atual/i,
  /saldo\s+(?:total\s+de\s+compras|em\s+aberto)/i,
  /fale\s+com\s+a\s+gente/i,
  /ouvidoria/i,
  /\d{4}\*{4,}\d{4}/i,
  /data\s+movimenta[çc][ãa]o\s+benefici[áa]rio\s+valor/i,
  /pagavel\s+em\s+qualquer\s+banco/i,
  /carteira\s+esp[ée]cie/i,
];

/**
 * Processa uma lista de linhas de texto (com suporte a janela deslizante de 1, 2 ou 3 linhas consecutivas)
 * para identificar compras de faturas bancárias mesmo com quebras de linha.
 */
export function extractTransactionsFromLines(
  lines: string[],
  detectedBank = 'Banco Inter',
  fileName = 'fatura.pdf'
): {
  transactions: CreditCardTransaction[];
  ignoredPaymentsCount: number;
  ignoredPaymentsTotal: number;
} {
  const transactions: CreditCardTransaction[] = [];
  let ignoredPaymentsCount = 0;
  let ignoredPaymentsTotal = 0;

  let i = 0;
  while (i < lines.length) {
    const l1 = lines[i].trim();
    if (!l1) {
      i++;
      continue;
    }

    // Se alcançou a seção "Próxima fatura", as compras subsequentes são de meses futuros
    if (
      /^pr[óo]xima\s+fatura/i.test(l1) ||
      /compras\s+parceladas\s+realizadas\s+at[ée]\s+o\s+fechamento/i.test(l1)
    ) {
      break;
    }

    // Ignora linhas que são cabeçalhos ou simulações de empréstimo/parcelamento
    if (NON_PURCHASE_PHRASES.some((p) => p.test(l1))) {
      i++;
      continue;
    }

    let matchData: {
      date: string;
      desc: string;
      val: string;
      trailing?: string;
      consumedLines: number;
    } | null = null;

    // 1. Tenta casar 1 linha com prioridade em formatos bancários
    let m = l1.match(TX_INTER);
    if (m) {
      matchData = {
        date: m[1],
        desc: m[2],
        val: m[3],
        consumedLines: 1,
      };
    } else if ((m = l1.match(TX_STANDARD_HYPHEN))) {
      matchData = {
        date: m[1],
        desc: m[2],
        val: m[3],
        consumedLines: 1,
      };
    } else if ((m = l1.match(TX_DATE_FIRST))) {
      matchData = {
        date: m[1],
        desc: m[2],
        val: m[3],
        trailing: m[4],
        consumedLines: 1,
      };
    } else {
      let mRev = l1.match(TX_DESC_FIRST);
      if (mRev) {
        matchData = {
          date: mRev[2],
          desc: mRev[1],
          val: mRev[3],
          trailing: mRev[4],
          consumedLines: 1,
        };
      }
    }

    // 2. Se não casou e há linha seguinte, tenta combinar 2 linhas
    if (!matchData && i + 1 < lines.length) {
      const l2 = `${l1} ${lines[i + 1].trim()}`;
      if (!NON_PURCHASE_PHRASES.some((p) => p.test(l2))) {
        let m2 =
          l2.match(TX_INTER) ||
          l2.match(TX_STANDARD_HYPHEN) ||
          l2.match(TX_DATE_FIRST);
        if (m2) {
          matchData = {
            date: m2[1],
            desc: m2[2],
            val: m2[3],
            trailing: m2[4],
            consumedLines: 2,
          };
        } else {
          let mRev = l2.match(TX_DESC_FIRST);
          if (mRev) {
            matchData = {
              date: mRev[2],
              desc: mRev[1],
              val: mRev[3],
              trailing: mRev[4],
              consumedLines: 2,
            };
          }
        }
      }
    }

    // 3. Se não casou e há 3 linhas, tenta combinar 3 linhas (layout com Data na l1, Desc na l2, Valor na l3)
    if (!matchData && i + 2 < lines.length) {
      const l3 = `${l1} ${lines[i + 1].trim()} ${lines[i + 2].trim()}`;
      if (!NON_PURCHASE_PHRASES.some((p) => p.test(l3))) {
        let m3 = l3.match(TX_DATE_FIRST);
        if (m3) {
          matchData = {
            date: m3[1],
            desc: m3[2],
            val: m3[3],
            trailing: m3[4],
            consumedLines: 3,
          };
        }
      }
    }

    if (matchData) {
      const { date, desc, val, trailing, consumedLines } = matchData;
      const isHeaderPhrase = NON_PURCHASE_PHRASES.some((p) => p.test(desc));
      if (!isHeaderPhrase) {
        const amount = parseBrlAmount(val);
        if (isPaymentOrCreditLine(desc, amount, val)) {
          ignoredPaymentsCount += 1;
          ignoredPaymentsTotal += Math.abs(amount);
        } else if (amount !== 0) {
          const { cleanTitle, installment } = extractInstallmentInfo(
            desc,
            trailing
          );
          // Garantir que não é fragmento de texto ou cabeçalho residual
          if (cleanTitle.replace(/[^a-zA-Z0-9]/g, '').length >= 3) {
            const formattedDate = normalizeInvoiceDate(date);

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
      i += consumedLines;
    } else {
      i += 1;
    }
  }

  return {
    transactions,
    ignoredPaymentsCount,
    ignoredPaymentsTotal: Math.round(ignoredPaymentsTotal * 100) / 100,
  };
}

/**
 * Lê uma fatura em PDF (Banco Inter, Nubank, C6, Itaú, etc.)
 * Aplica estratégias complementares (agrupamento espacial e stream sequencial).
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
    let detectedBank = 'Banco Inter';
    const allSpatialLines: string[] = [];
    const allStreamLines: string[] = [];

    // 1. Extração de todas as páginas
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();

      interface TextChunk {
        str: string;
        x: number;
        y: number;
      }
      const linesMap: { y: number; items: TextChunk[] }[] = [];

      for (const item of textContent.items as any[]) {
        const str = (item.str || '').replace(/\s+/g, ' ').trim();
        if (!str) continue;

        // Detectar menções a bancos conhecidos
        if (/banco\s+inter|inter\s+dtvm/i.test(str)) detectedBank = 'Banco Inter';
        else if (/nubank|nu\s+pagamentos/i.test(str)) detectedBank = 'Nubank';
        else if (/c6\s+bank/i.test(str)) detectedBank = 'C6 Bank';
        else if (/ita[úu]/i.test(str)) detectedBank = 'Itaú';

        allStreamLines.push(str);

        const x = item.transform ? item.transform[4] : 0;
        const y = item.transform ? item.transform[5] : 0;

        // Tolerância vertical aumentada para 5.8pt para englobar variações de fonte na mesma linha
        let existingLine = linesMap.find((line) => Math.abs(line.y - y) <= 5.8);
        if (!existingLine) {
          existingLine = { y, items: [] };
          linesMap.push(existingLine);
        }
        existingLine.items.push({ str, x, y });
      }

      // Ordenar do topo para a base (Y decrescente)
      linesMap.sort((a, b) => b.y - a.y);

      // Em cada linha, ordenar da esquerda para a direita (X crescente)
      for (const line of linesMap) {
        line.items.sort((a, b) => a.x - b.x);
        const lineText = line.items.map((i) => i.str).join(' ').trim();
        if (lineText) {
          allSpatialLines.push(lineText);
        }
      }
    }

    // Estratégia 1: Parsear a partir das linhas espaciais agrupadas
    let extraction = extractTransactionsFromLines(
      allSpatialLines,
      detectedBank,
      fileName
    );

    // Estratégia 2 (Fallback): Se a estratégia espacial retornar 0, tenta a leitura sequencial do stream de texto
    if (extraction.transactions.length === 0 && allStreamLines.length > 0) {
      const fallbackExtraction = extractTransactionsFromLines(
        allStreamLines,
        detectedBank,
        fileName
      );
      if (fallbackExtraction.transactions.length > 0) {
        extraction = fallbackExtraction;
      }
    }

    const totalAmount =
      Math.round(
        extraction.transactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100;

    const previewRawLines = allSpatialLines.length > 0
      ? allSpatialLines.slice(0, 40)
      : allStreamLines.slice(0, 40);

    return {
      success: true,
      rawLines: previewRawLines,
      summary: {
        fileName,
        transactions: extraction.transactions,
        totalAmount,
        ignoredPaymentsCount: extraction.ignoredPaymentsCount,
        ignoredPaymentsTotal: extraction.ignoredPaymentsTotal,
        detectedBank,
        rawLines: previewRawLines,
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

/** Permite processar texto colado diretamente pelo usuário */
export function parsePastedInvoiceText(
  pastedText: string,
  sourceName = 'Texto Colado'
): InvoiceParseSummary {
  const lines = pastedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const extraction = extractTransactionsFromLines(lines, 'Fatura', sourceName);
  const totalAmount =
    Math.round(
      extraction.transactions.reduce((acc, t) => acc + t.amount, 0) * 100
    ) / 100;

  return {
    fileName: sourceName,
    transactions: extraction.transactions,
    totalAmount,
    ignoredPaymentsCount: extraction.ignoredPaymentsCount,
    ignoredPaymentsTotal: extraction.ignoredPaymentsTotal,
    detectedBank: 'Extrato Manual',
    rawLines: lines.slice(0, 40),
  };
}

/** Verifica se um arquivo é PDF pela extensão ou tipo MIME */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}
