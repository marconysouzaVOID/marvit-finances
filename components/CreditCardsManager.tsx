import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_PURCHASE_TAGS, SAMPLE_NUBANK_CSV_RAW } from '../constants';
import {
  CardPurchaseTag,
  CreditCardTransaction,
  ExpenseItem,
  GlobalCreditCard,
} from '../types';
import { formatCurrency, formatMonthKeyLabel, formatPercent, inferCardPurchaseTag } from '../utils/formatters';
import { parsePdfInvoice, isPdfFile, parsePastedInvoiceText } from '../utils/pdfInvoiceParser';
import { InteractiveAsset } from './InteractiveAsset';
import { LifestyleDailyCalendar } from './LifestyleDailyCalendar';

interface CreditCardsManagerProps {
  expenses: ExpenseItem[];
  globalCards?: GlobalCreditCard[];
  lifestyleIdealAmount: number;
  lifestyleTotalSpent: number;
  selectedCardId?: string | null;
  selectedMonthKey?: string;
  initialSubView?: 'invoices' | 'calendar';
  onSelectCardId?: (id: string | null) => void;
  onAddGlobalCard?: (card: Omit<GlobalCreditCard, 'id'>) => void;
  onUpdateGlobalCard?: (id: string, updated: Partial<GlobalCreditCard>) => void;
  onDeleteGlobalCard?: (id: string, scope: 'global' | 'current_month') => void;
  onAddCardExpense: (card: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense: (id: string, updated: Partial<ExpenseItem>) => void;
  onDeleteExpense: (id: string) => void;
  showToast?: (msg: string) => void;
}

export interface BankPreset {
  name: string;
  label: string;
  brand: string;
  dueDay: number;
  closingDay: number;
  limit: number;
  badgeClass: string;
}

export const BANK_PRESETS: BankPreset[] = [
  {
    name: 'Cartão Nubank / Ultravioleta',
    label: '💜 Nubank',
    brand: 'nubank',
    dueDay: 10,
    closingDay: 25,
    limit: 2500,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  },
  {
    name: 'Cartão Inter / Black',
    label: '🧡 Inter',
    brand: 'inter',
    dueDay: 15,
    closingDay: 5,
    limit: 2000,
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  },
  {
    name: 'Cartão Itaú Personnalité',
    label: '💙 Itaú',
    brand: 'itau',
    dueDay: 20,
    closingDay: 10,
    limit: 5000,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  {
    name: 'Cartão C6 Carbon Black',
    label: '🖤 C6 Bank',
    brand: 'c6',
    dueDay: 25,
    closingDay: 18,
    limit: 6000,
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300 hover:bg-zinc-200',
  },
  {
    name: 'Cartão XP Visa Infinite',
    label: '💛 XP',
    brand: 'xp',
    dueDay: 22,
    closingDay: 15,
    limit: 10000,
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100',
  },
  {
    name: 'Cartão Santander Unlimited',
    label: '🔴 Santander',
    brand: 'santander',
    dueDay: 12,
    closingDay: 2,
    limit: 4000,
    badgeClass: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  },
];

export interface CsvParseSummary {
  fileName: string;
  transactions: CreditCardTransaction[];
  totalAmount: number;
  ignoredPaymentsCount: number;
  ignoredPaymentsTotal: number;
  detectedBank?: string;
  cycleInfo?: {
    hasPreviousMonthPurchases: boolean;
    previousMonthCount: number;
    dateRange?: string;
  };
}

export { inferCardPurchaseTag };

/**
 * Faz o parse completo de um arquivo CSV de fatura de cartão (ex: Nubank_2026-11-01.csv `date,title,amount` ou `;`)
 * separando compras da fatura e pagamentos recebidos / créditos.
 */
export function parseCreditCardCsvDetailed(
  csvText: string,
  fileName = 'fatura.csv'
): CsvParseSummary {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return {
      fileName,
      transactions: [],
      totalAmount: 0,
      ignoredPaymentsCount: 0,
      ignoredPaymentsTotal: 0,
    };
  }

  // Detectar delimitador (vírgula padrão Nubank ou ponto-e-vírgula)
  const headerLine = lines[0];
  const delimiter =
    headerLine.includes(';') && !headerLine.includes(',') ? ';' : ',';

  const transactions: CreditCardTransaction[] = [];
  let ignoredPaymentsCount = 0;
  let ignoredPaymentsTotal = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        if (inQuotes && line[c + 1] === '"') {
          current += '"';
          c++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());

    if (cols.length < 3) continue;

    const rawDate = cols[0];
    let rawTitle = cols.slice(1, cols.length - 1).join(', ').trim();
    const rawAmountStr = cols[cols.length - 1];

    // Normalizar número no formato brasileiro ("- 3.120,62", "87,86") ou internacional ("87.86")
    const cleanedStr = rawAmountStr.replace(/[R$\s]/g, '');
    let normalizedNum = cleanedStr;
    if (cleanedStr.includes(',')) {
      normalizedNum = cleanedStr.replace(/\./g, '').replace(',', '.');
    }
    const numericAmount = Number(normalizedNum);

    if (!Number.isFinite(numericAmount) || numericAmount === 0) continue;

    // Ignorar linhas de "Pagamento recebido" ou valores negativos (crédito de pagamento da fatura anterior)
    if (numericAmount < 0 || /pagamento recebido/i.test(rawTitle)) {
      ignoredPaymentsCount += 1;
      ignoredPaymentsTotal += Math.abs(numericAmount);
      continue;
    }

    // Extrair "Parcela X/Y" se presente no título (ex: "Hna*Oboticario - Parcela 1/5")
    let installment = 'À vista';
    const parcelaMatch = rawTitle.match(/(?:-\s*)?Parcela\s+(\d+\/\d+)/i);
    if (parcelaMatch) {
      installment = `Parcela ${parcelaMatch[1]}`;
      rawTitle = rawTitle.replace(parcelaMatch[0], '').trim();
    }

    // Formatar data YYYY-MM-DD -> DD/MM
    let formattedDate = rawDate;
    const dateParts = rawDate.split('-');
    if (dateParts.length === 3) {
      formattedDate = `${dateParts[2]}/${dateParts[1]}`;
    }

    transactions.push({
      id: `csv-tx-${Date.now()}-${i}`,
      description: rawTitle,
      amount: Math.round(numericAmount * 100) / 100,
      tag: inferCardPurchaseTag(rawTitle),
      installment,
      purchaseDate: formattedDate,
    });
  }

  const totalAmount =
    Math.round(transactions.reduce((acc, t) => acc + t.amount, 0) * 100) / 100;

  // Identificar ciclo de datas (ex: se há compras do mês de fechamento anterior como 26/09 a 29/09)
  const monthCountMap = new Map<number, number>();
  transactions.forEach((t) => {
    if (t.purchaseDate && t.purchaseDate.includes('/')) {
      const parts = t.purchaseDate.split('/');
      const m = parseInt(parts[1], 10);
      if (!isNaN(m)) {
        monthCountMap.set(m, (monthCountMap.get(m) || 0) + 1);
      }
    }
  });

  let hasPreviousMonthPurchases = false;
  let previousMonthCount = 0;
  if (monthCountMap.size > 1) {
    const sortedMonths = Array.from(monthCountMap.keys()).sort((a, b) => a - b);
    const earlierMonth = sortedMonths[0];
    previousMonthCount = monthCountMap.get(earlierMonth) || 0;
    hasPreviousMonthPurchases = true;
  }

  return {
    fileName,
    transactions,
    totalAmount,
    ignoredPaymentsCount,
    ignoredPaymentsTotal: Math.round(ignoredPaymentsTotal * 100) / 100,
    cycleInfo: {
      hasPreviousMonthPurchases,
      previousMonthCount,
      dateRange:
        transactions.length > 0
          ? `${transactions[transactions.length - 1].purchaseDate} a ${transactions[0].purchaseDate}`
          : undefined,
    },
  };
}

export const CreditCardsManager: React.FC<CreditCardsManagerProps> = ({
  expenses,
  globalCards,
  lifestyleIdealAmount,
  lifestyleTotalSpent,
  selectedCardId,
  selectedMonthKey,
  initialSubView = 'invoices',
  onSelectCardId,
  onAddGlobalCard,
  onUpdateGlobalCard,
  onDeleteGlobalCard,
  onAddCardExpense,
  onUpdateExpense,
  onDeleteExpense,
  showToast,
}) => {
  const [cardsSubView, setCardsSubView] = useState<'invoices' | 'calendar'>(
    initialSubView
  );
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDeleteCardModalOpen, setIsDeleteCardModalOpen] = useState(false);

  // Todos os itens do pilar Estilo de Vida que pertencem à subcategoria 'cartao'
  const creditCards = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.category === 'estilo' &&
          !e.linkedGoalId &&
          e.subcategory === 'cartao'
      ),
    [expenses]
  );

  // Outros itens do pilar Estilo de Vida que estão na subcategoria 'direto'
  const directLifestyleItems = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.category === 'estilo' &&
          !e.linkedGoalId &&
          e.subcategory !== 'cartao'
      ),
    [expenses]
  );

  const [activeCardId, setActiveCardId] = useState<string>(
    selectedCardId || creditCards[0]?.id || ''
  );

  useEffect(() => {
    if (selectedCardId && creditCards.some((c) => c.id === selectedCardId)) {
      setActiveCardId(selectedCardId);
    } else if (
      creditCards.length > 0 &&
      !creditCards.some((c) => c.id === activeCardId)
    ) {
      setActiveCardId(creditCards[0].id);
    } else if (creditCards.length === 0) {
      setActiveCardId('');
    }
  }, [creditCards, selectedCardId, activeCardId]);

  const activeCard = useMemo(
    () => creditCards.find((c) => c.id === activeCardId) || creditCards[0] || null,
    [creditCards, activeCardId]
  );

  // Estado do formulário de criação de novo Cartão de Crédito
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState<number | ''>(1500);
  const [newCardDueDay, setNewCardDueDay] = useState<number | ''>(10);
  const [newCardClosingDay, setNewCardClosingDay] = useState<number | ''>(25);

  // Estado de edição de configurações do cartão ativo
  const [isEditingCardMeta, setIsEditingCardMeta] = useState(false);
  const [editCardName, setEditCardName] = useState('');
  const [editCardLimit, setEditCardLimit] = useState<number | ''>('');
  const [editCardDueDay, setEditCardDueDay] = useState<number | ''>('');
  const [editCardClosingDay, setEditCardClosingDay] = useState<number | ''>('');

  // Estado do Importador de Fatura CSV / PDF (Pré-visualização e modo Substituir vs Somar)
  const [csvPreview, setCsvPreview] = useState<CsvParseSummary | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<'replace' | 'append'>(
    'replace'
  );

  // Estados para importação de fatura em PDF (Banco Inter com suporte a senha, etc.)
  const [pdfPasswordModalOpen, setPdfPasswordModalOpen] = useState(false);
  const [pdfPasswordInput, setPdfPasswordInput] = useState('');
  const [showPdfPassword, setShowPdfPassword] = useState(false);
  const [pdfPasswordError, setPdfPasswordError] = useState<string | null>(null);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfDebugLines, setPdfDebugLines] = useState<string[]>([]);
  const [showDebugLines, setShowDebugLines] = useState(false);
  const [isCopiedDebug, setIsCopiedDebug] = useState(false);

  // Modal para colar texto de fatura diretamente
  const [pastedInvoiceModalOpen, setPastedInvoiceModalOpen] = useState(false);
  const [pastedInvoiceText, setPastedInvoiceText] = useState('');

  // Estado para adicionar gasto individualizado na fatura do cartão selecionado
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txTag, setTxTag] = useState<CardPurchaseTag>('gastronomia');
  const [txInstallment, setTxInstallment] = useState('À vista');
  const [txDate, setTxDate] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<
    'all' | CardPurchaseTag
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const totalCardsInvoice = useMemo(
    () => creditCards.reduce((acc, c) => acc + c.amount, 0),
    [creditCards]
  );

  const totalIndividualTransactions = useMemo(
    () =>
      creditCards.reduce(
        (acc, c) => acc + (c.cardTransactions?.length || 0),
        0
      ),
    [creditCards]
  );

  const cardsShareOfLifestyleCap =
    lifestyleIdealAmount > 0
      ? (totalCardsInvoice / lifestyleIdealAmount) * 100
      : 0;

  const handleSelectCard = (id: string) => {
    setActiveCardId(id);
    setIsEditingCardMeta(false);
    setCsvPreview(null);
    if (onSelectCardId) onSelectCardId(id);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim()) return;

    if (onAddGlobalCard) {
      onAddGlobalCard({
        name: newCardName.trim(),
        cardLimit: Number(newCardLimit) > 0 ? Number(newCardLimit) : undefined,
        cardDueDay:
          Number(newCardDueDay) >= 1 && Number(newCardDueDay) <= 31
            ? Number(newCardDueDay)
            : undefined,
        cardClosingDay:
          Number(newCardClosingDay) >= 1 && Number(newCardClosingDay) <= 31
            ? Number(newCardClosingDay)
            : undefined,
      });
    } else {
      onAddCardExpense({
        name: newCardName.trim(),
        amount: 0,
        category: 'estilo',
        subcategory: 'cartao',
        cardTransactions: [],
        cardLimit: Number(newCardLimit) > 0 ? Number(newCardLimit) : undefined,
        cardDueDay:
          Number(newCardDueDay) >= 1 && Number(newCardDueDay) <= 31
            ? Number(newCardDueDay)
            : undefined,
        cardClosingDay:
          Number(newCardClosingDay) >= 1 && Number(newCardClosingDay) <= 31
            ? Number(newCardClosingDay)
            : undefined,
        isCustom: true,
      });
    }

    setNewCardName('');
    setIsCreatingCard(false);
  };

  const startEditingActiveCard = () => {
    if (!activeCard) return;
    setEditCardName(activeCard.name);
    setEditCardLimit(activeCard.cardLimit || '');
    setEditCardDueDay(activeCard.cardDueDay || '');
    setEditCardClosingDay(activeCard.cardClosingDay || 25);
    setIsEditingCardMeta(true);
  };

  const handleSaveCardMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !editCardName.trim()) return;

    if (onUpdateGlobalCard) {
      onUpdateGlobalCard(activeCard.globalCardId || activeCard.id, {
        name: editCardName.trim(),
        cardLimit: Number(editCardLimit) > 0 ? Number(editCardLimit) : undefined,
        cardDueDay:
          Number(editCardDueDay) >= 1 && Number(editCardDueDay) <= 31
            ? Number(editCardDueDay)
            : undefined,
        cardClosingDay:
          Number(editCardClosingDay) >= 1 && Number(editCardClosingDay) <= 31
            ? Number(editCardClosingDay)
            : undefined,
      });
    } else {
      onUpdateExpense(activeCard.id, {
        name: editCardName.trim(),
        cardLimit: Number(editCardLimit) > 0 ? Number(editCardLimit) : undefined,
        cardDueDay:
          Number(editCardDueDay) >= 1 && Number(editCardDueDay) <= 31
            ? Number(editCardDueDay)
            : undefined,
        cardClosingDay:
          Number(editCardClosingDay) >= 1 && Number(editCardClosingDay) <= 31
            ? Number(editCardClosingDay)
            : undefined,
      });
    }
    setIsEditingCardMeta(false);
  };

  const handleDeleteCardChoice = (scope: 'global' | 'current_month') => {
    if (!activeCard) return;
    if (onDeleteGlobalCard) {
      onDeleteGlobalCard(activeCard.globalCardId || activeCard.id, scope);
    } else if (scope === 'global') {
      onDeleteExpense(activeCard.id);
    } else {
      onUpdateExpense(activeCard.id, {
        amount: 0,
        cardTransactions: [],
      });
    }
    setIsDeleteCardModalOpen(false);
  };

  // Adicionar compra individualizada ao cartão ativo e sincronizar o total da fatura no pilar Estilo de Vida
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !txDesc.trim() || !txAmount || Number(txAmount) <= 0)
      return;

    const currentList = activeCard.cardTransactions || [];
    const newTx: CreditCardTransaction = {
      id: `tx-${Date.now()}`,
      description: txDesc.trim(),
      amount: Math.round(Math.max(0, Number(txAmount)) * 100) / 100,
      tag: txTag,
      installment: txInstallment.trim() || 'À vista',
      purchaseDate: txDate.trim() || undefined,
    };

    const nextTransactions = [newTx, ...currentList];
    const nextTotal =
      Math.round(
        nextTransactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100;

    onUpdateExpense(activeCard.id, {
      cardTransactions: nextTransactions,
      amount: nextTotal,
    });

    setTxDesc('');
    setTxAmount('');
    setTxDate('');
  };

  const handleUpdateTransaction = (
    txId: string,
    updated: Partial<CreditCardTransaction>
  ) => {
    if (!activeCard) return;
    const currentList = activeCard.cardTransactions || [];
    const nextTransactions = currentList.map((t) =>
      t.id === txId ? { ...t, ...updated } : t
    );
    const nextTotal =
      Math.round(
        nextTransactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100;

    onUpdateExpense(activeCard.id, {
      cardTransactions: nextTransactions,
      amount: nextTotal,
    });
  };

  const handleDeleteTransaction = (txId: string) => {
    if (!activeCard) return;
    const currentList = activeCard.cardTransactions || [];
    const nextTransactions = currentList.filter((t) => t.id !== txId);
    const nextTotal =
      Math.round(
        nextTransactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100;

    onUpdateExpense(activeCard.id, {
      cardTransactions: nextTransactions,
      amount: nextTotal,
    });
  };

  // Clonar/duplicar um lançamento da fatura com 1 clique
  const handleCloneTransaction = (tx: CreditCardTransaction) => {
    if (!activeCard) return;
    const currentList = activeCard.cardTransactions || [];
    const clonedTx: CreditCardTransaction = {
      id: `tx-clone-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      description: `${tx.description} (Cópia)`,
      amount: tx.amount,
      tag: tx.tag,
      installment: tx.installment || 'À vista',
      purchaseDate: tx.purchaseDate,
      notes: tx.notes,
    };
    const nextTransactions = [clonedTx, ...currentList];
    const nextTotal =
      Math.round(
        nextTransactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100;

    onUpdateExpense(activeCard.id, {
      cardTransactions: nextTransactions,
      amount: nextTotal,
    });
  };

  // Ler arquivo CSV ou PDF selecionado pelo usuário e abrir o painel de confirmação da fatura
  const handleImportInvoiceFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !activeCard) return;

    if (isPdfFile(file)) {
      setIsParsingPdf(true);
      setPdfPasswordError(null);
      setPendingPdfFile(file);

      try {
        const buffer = await file.arrayBuffer();
        const res = await parsePdfInvoice(buffer, file.name);
        if (res.success && res.summary) {
          if (res.summary.transactions.length === 0) {
            alert(
              'Fatura em PDF processada com sucesso, mas nenhuma compra foi identificada no padrão tabular de faturas bancárias.'
            );
            setPendingPdfFile(null);
          } else {
            setCsvImportMode('replace');
            setCsvPreview(res.summary);
            setPendingPdfFile(null);
          }
        } else if (res.needsPassword) {
          // Fatura criptografada (padrão Banco Inter com CPF)
          setPdfPasswordModalOpen(true);
          setPdfPasswordInput('');
          setPdfPasswordError(null);
        } else {
          alert(
            res.error ||
              'Não foi possível extrair as informações da fatura em PDF.'
          );
          setPendingPdfFile(null);
        }
      } catch (err: any) {
        alert('Erro ao carregar o arquivo PDF da fatura.');
        setPendingPdfFile(null);
      } finally {
        setIsParsingPdf(false);
      }
    } else {
      // Processamento CSV padrão
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = String(ev.target?.result || '');
        const summary = parseCreditCardCsvDetailed(content, file.name);
        if (summary.transactions.length > 0) {
          setCsvImportMode('replace');
          setCsvPreview(summary);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  // Desbloquear fatura PDF protegida com a senha fornecida pelo usuário
  const handleUnlockPdfWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pendingPdfFile || !pdfPasswordInput.trim()) return;

    setIsParsingPdf(true);
    setPdfPasswordError(null);

    try {
      const buffer = await pendingPdfFile.arrayBuffer();
      const res = await parsePdfInvoice(
        buffer,
        pendingPdfFile.name,
        pdfPasswordInput.trim()
      );
      if (res.success && res.summary) {
        if (res.summary.transactions.length === 0) {
          setPdfDebugLines(res.rawLines || []);
          setPdfPasswordError(
            'Fatura descriptografada com sucesso, mas nenhuma compra foi identificada no padrão esperado.'
          );
        } else {
          setCsvImportMode('replace');
          setCsvPreview(res.summary);
          setPdfPasswordModalOpen(false);
          setPendingPdfFile(null);
          setPdfPasswordInput('');
          setPdfDebugLines([]);
          setShowDebugLines(false);
        }
      } else if (res.isWrongPassword || res.needsPassword) {
        setPdfPasswordError(
          res.error ||
            'Senha incorreta. No Banco Inter, tente os 5 ou 6 primeiros dígitos do seu CPF.'
        );
      } else {
        setPdfPasswordError(
          res.error || 'Erro ao descriptografar fatura em PDF.'
        );
      }
    } catch (err: any) {
      setPdfPasswordError('Falha ao processar a fatura com a senha informada.');
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleCancelPdfPassword = () => {
    setPdfPasswordModalOpen(false);
    setPendingPdfFile(null);
    setPdfPasswordInput('');
    setPdfPasswordError(null);
    setIsParsingPdf(false);
    setPdfDebugLines([]);
    setShowDebugLines(false);
  };

  const handleProcessPastedInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedInvoiceText.trim() || !activeCard) return;

    const summary = parsePastedInvoiceText(pastedInvoiceText, 'Texto Colado');
    if (summary.transactions.length > 0) {
      setCsvImportMode('replace');
      setCsvPreview(summary);
      setPastedInvoiceModalOpen(false);
      setPastedInvoiceText('');
      setPdfPasswordModalOpen(false);
    } else {
      alert(
        'Não foi possível encontrar compras no texto informado. Verifique se o conteúdo possui data e valor.'
      );
    }
  };

  // Carregar a fatura exemplo Nubank_2026-11-01.csv diretamente no preview do cartão selecionado
  const handleLoadSampleNubankCsv = () => {
    if (!activeCard) return;
    const summary = parseCreditCardCsvDetailed(
      SAMPLE_NUBANK_CSV_RAW,
      'Nubank_2026-11-01.csv'
    );
    setCsvImportMode('replace');
    setCsvPreview(summary);
  };

  // Confirmar a aplicação do CSV como fatura do cartão selecionado
  const handleConfirmCsvImport = () => {
    if (!activeCard || !csvPreview) return;

    const currentList = activeCard.cardTransactions || [];
    const finalTransactions =
      csvImportMode === 'replace'
        ? csvPreview.transactions
        : [...csvPreview.transactions, ...currentList];

    const finalTotal =
      Math.round(
        finalTransactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100;

    onUpdateExpense(activeCard.id, {
      cardTransactions: finalTransactions,
      amount: finalTotal,
    });

    setCsvPreview(null);
    setSelectedTagFilter('all');
    if (showToast) {
      showToast(
        `Fatura importada com sucesso! ${finalTransactions.length} compras salvas no ${activeCard.name}.`
      );
    }
  };

  const handleConvertDirectToCard = (item: ExpenseItem) => {
    onUpdateExpense(item.id, {
      subcategory: 'cartao',
      cardTransactions: item.cardTransactions || [],
    });
    handleSelectCard(item.id);
  };

  const handleConvertCardToDirect = (card: ExpenseItem) => {
    onUpdateExpense(card.id, {
      subcategory: 'direto',
    });
  };

  const activeCardTransactions = activeCard?.cardTransactions || [];
  const sumOfActiveCardItems = useMemo(
    () =>
      Math.round(
        activeCardTransactions.reduce((acc, t) => acc + t.amount, 0) * 100
      ) / 100,
    [activeCardTransactions]
  );

  const filteredTransactions = useMemo(() => {
    return activeCardTransactions.filter((t) => {
      const matchesTag =
        selectedTagFilter === 'all' || t.tag === selectedTagFilter;
      const matchesQuery =
        !searchQuery.trim() ||
        t.description.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchesTag && matchesQuery;
    });
  }, [activeCardTransactions, selectedTagFilter, searchQuery]);

  const tagTotalsForActiveCard = useMemo(() => {
    const map: Record<CardPurchaseTag, number> = {
      gastronomia: 0,
      assinaturas: 0,
      compras: 0,
      mobilidade: 0,
      lazer: 0,
      autocuidado: 0,
      outros: 0,
    };
    activeCardTransactions.forEach((t) => {
      map[t.tag] = Math.round(((map[t.tag] || 0) + t.amount) * 100) / 100;
    });
    return map;
  }, [activeCardTransactions]);

  return (
    <div className="space-y-5">
      {/* Input oculto para importar PDF ou CSV de fatura (ex: Banco Inter, Nubank) */}
      <input
        ref={csvFileInputRef}
        type="file"
        accept=".pdf,.csv,text/csv,application/pdf"
        onChange={handleImportInvoiceFile}
        className="hidden"
      />

      {/* Sub-navegador da aba Cartões & Estilo: Faturas vs Calendário Diário */}
      <div className="flex items-center justify-between gap-3 bg-oat-100/80 dark:bg-espresso-800/80 border border-oat-300 dark:border-espresso-700 p-1.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCardsSubView('invoices')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              cardsSubView === 'invoices'
                ? 'bg-terracotta-500 text-white shadow-xs'
                : 'text-espresso-700 dark:text-espresso-300 hover:text-espresso-900 hover:bg-oat-200/70'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">credit_card</span>
            <span>Faturas & Lançamentos</span>
          </button>

          <button
            type="button"
            onClick={() => setCardsSubView('calendar')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              cardsSubView === 'calendar'
                ? 'bg-terracotta-500 text-white shadow-xs'
                : 'text-espresso-700 dark:text-espresso-300 hover:text-espresso-900 hover:bg-oat-200/70'
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">calendar_month</span>
            <span>Calendário Diário de Gastos</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-espresso-500 hidden sm:inline pr-2">
          {cardsSubView === 'invoices'
            ? `${totalIndividualTransactions} compras em ${creditCards.length} cartões`
            : 'Gastos dia a dia • Estilo de Vida'}
        </span>
      </div>

      {cardsSubView === 'calendar' ? (
        <LifestyleDailyCalendar
          expenses={expenses}
          selectedMonthKey={selectedMonthKey || ''}
          lifestyleIdealAmount={lifestyleIdealAmount}
          onUpdateExpense={onUpdateExpense}
          onOpenCardInvoices={(cardId) => {
            if (cardId) setActiveCardId(cardId);
            setCardsSubView('invoices');
          }}
        />
      ) : (
        <div className="space-y-5">
          {/* Cabeçalho Principal da Aba de Cartões de Estilo de Vida */}
          <div className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-oat-200">
              <div className="flex items-center gap-3 sm:gap-4">
                <InteractiveAsset
                  src="/assets/marvit-estilo.png"
                  alt="Cartões de Crédito • Estilo de Vida"
                  size="md"
                  tone="terracotta"
                  badgeIcon="credit_card"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-2xl font-display font-bold text-espresso-900">
                      Cartões de Crédito • Estilo de Vida
                    </h2>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-terracotta-100 text-terracotta-700 border border-terracotta-200">
                      Subcategoria & Fatura CSV
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-espresso-600 mt-1">
                    Gerencie os gastos individualizados ou importe o arquivo <strong>.CSV</strong> da fatura do cartão selecionado. O total atualiza automaticamente o pilar <strong>Estilo de Vida</strong>!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setCardsSubView('calendar')}
                  className="px-3.5 py-2.5 rounded-2xl bg-oat-100 hover:bg-oat-200 text-espresso-800 font-bold text-xs sm:text-sm border border-oat-300 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  title="Visualizar gastos de cada dia no calendário"
                >
                  <span className="material-symbols-outlined text-[18px] text-terracotta-500">
                    calendar_month
                  </span>
                  <span>Ver Calendário Diário</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCreatingCard(!isCreatingCard)}
                  className="px-4 py-2.5 rounded-2xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isCreatingCard ? 'close' : 'add_card'}
                  </span>
                  <span>
                    {isCreatingCard ? 'Fechar Formulário' : '+ Novo Cartão Global'}
                  </span>
                </button>
              </div>
            </div>

        {/* Resumo Consolidado dos Cartões no Pilar Estilo de Vida */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-4 rounded-2xl bg-terracotta-50/90 border border-terracotta-200 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase text-terracotta-700 tracking-wider block">
                Total em Cartões (Estilo)
              </span>
              <span className="text-xl font-mono font-extrabold text-terracotta-600 mt-0.5 block truncate">
                {formatCurrency(totalCardsInvoice)}
              </span>
              <span className="text-[11px] text-espresso-600">
                Em {creditCards.length}{' '}
                {creditCards.length === 1 ? 'cartão ativo' : 'cartões ativos'}
              </span>
            </div>
            <span className="material-symbols-outlined text-terracotta-500 text-3xl shrink-0">
              credit_card
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-maldives-50/80 border border-maldives-200 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase text-maldives-800 tracking-wider block">
                Ocupação do Teto Estilo de Vida
              </span>
              <span className="text-xl font-mono font-extrabold text-maldives-700 mt-0.5 block truncate">
                {formatPercent(cardsShareOfLifestyleCap)}
              </span>
              <span className="text-[11px] text-espresso-600">
                Teto do pilar: {formatCurrency(lifestyleIdealAmount)}
              </span>
            </div>
            <span className="material-symbols-outlined text-maldives-500 text-3xl shrink-0">
              pie_chart
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-sage-50 border border-sage-200 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase text-sage-600 tracking-wider block">
                Gastos Individualizados
              </span>
              <span className="text-xl font-mono font-extrabold text-espresso-900 mt-0.5 block truncate">
                {totalIndividualTransactions}{' '}
                {totalIndividualTransactions === 1 ? 'item' : 'itens'}
              </span>
              <span className="text-[11px] text-espresso-600">
                Outros gastos diretos/Pix:{' '}
                {formatCurrency(Math.max(0, lifestyleTotalSpent - totalCardsInvoice))}
              </span>
            </div>
            <span className="material-symbols-outlined text-sage-500 text-3xl shrink-0">
              receipt_long
            </span>
          </div>
        </div>

        {/* Formulário de Criação de Novo Cartão de Crédito Global */}
        <AnimatePresence>
          {isCreatingCard && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form
                onSubmit={handleCreateCard}
                className="mt-5 p-4 sm:p-5 rounded-2xl bg-oat-100 border-2 border-terracotta-300 space-y-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-oat-200 pb-3">
                  <div className="text-sm font-display font-bold text-espresso-900 flex items-center gap-2">
                    <span className="material-symbols-outlined text-terracotta-600 text-lg">
                      language
                    </span>
                    <span>Cadastrar Cartão de Crédito Global</span>
                  </div>
                  <span className="text-[11px] font-semibold text-espresso-600 bg-terracotta-100/70 text-terracotta-800 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">all_inclusive</span>
                    Disponível em todos os meses
                  </span>
                </div>

                <p className="text-xs text-espresso-600 leading-relaxed">
                  Ao cadastrar este cartão, ele estará pronto para uso em <strong>todos os meses</strong> (passados e futuros). As faturas, compras e pagamentos de cada mês são estritamente isolados e independentes.
                </p>

                {/* Atalhos Rápidos de Bancos Brasileiros */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-espresso-500 block mb-1.5">
                    Modelos Rápidos de Bancos:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {BANK_PRESETS.map((p) => (
                      <button
                        key={p.brand}
                        type="button"
                        onClick={() => {
                          setNewCardName(p.name);
                          setNewCardLimit(p.limit);
                          setNewCardDueDay(p.dueDay);
                          setNewCardClosingDay(p.closingDay);
                        }}
                        className={`text-xs px-2.5 py-1 rounded-xl font-bold border transition cursor-pointer ${p.badgeClass} shadow-2xs`}
                        title={`Preencher dados com ${p.name}`}
                      >
                        {p.label} (Venc. {p.dueDay} • Fecha {p.closingDay})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Nome do Cartão / Banco
                    </label>
                    <input
                      type="text"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="Ex: Cartão Nubank, Itaú, Inter, XP..."
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Meta / Limite Global (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={newCardLimit}
                      onChange={(e) =>
                        setNewCardLimit(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="Ex: 1500"
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Dia Vencimento (1 a 31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newCardDueDay}
                      onChange={(e) =>
                        setNewCardDueDay(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="Ex: 10"
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block" title="Dia que fecha a fatura (ex: dia 25)">
                      Dia Fechamento (1 a 31)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newCardClosingDay}
                      onChange={(e) =>
                        setNewCardClosingDay(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="Ex: 25"
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCard(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!newCardName.trim()}
                    className="px-5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-40 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Salvar Cartão Global</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Seletor rápido de subcategoria para converter itens existentes de Estilo de Vida em Cartão de Crédito */}
        {directLifestyleItems.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-oat-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-espresso-600">
              <span className="material-symbols-outlined text-terracotta-500 text-[18px] shrink-0">
                category
              </span>
              <span>
                Marcar gasto de <strong>Estilo de Vida</strong> como subcategoria{' '}
                <strong>Cartão de Crédito</strong>:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {directLifestyleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleConvertDirectToCard(item)}
                  className="px-2.5 py-1 rounded-xl bg-oat-100 hover:bg-terracotta-50 text-espresso-700 hover:text-terracotta-700 border border-oat-300 hover:border-terracotta-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Definir como Cartão de Crédito para detalhar compras individualizadas"
                >
                  <span className="material-symbols-outlined text-[14px] text-terracotta-600">
                    add_card
                  </span>
                  <span className="truncate max-w-[150px]">{item.name}</span>
                  <span className="font-mono text-[10px] text-espresso-500">
                    ({formatCurrency(item.amount)})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista de Cartões Cadastrados + Painel de Gastos Individualizados do Cartão Selecionado */}
      {creditCards.length === 0 ? (
        <div className="bg-oat-50/95 border-2 border-dashed border-oat-300 rounded-3xl p-8 text-center space-y-3">
          <span className="material-symbols-outlined text-terracotta-500 text-4xl">
            credit_card
          </span>
          <h3 className="text-base sm:text-lg font-display font-bold text-espresso-900">
            Nenhum item marcado na subcategoria Cartão de Crédito ainda
          </h3>
          <p className="text-xs text-espresso-600 max-w-md mx-auto">
            Toque em um dos seus itens de <strong>Estilo de Vida</strong> acima para marcá-lo como Cartão de Crédito, ou clique em <strong>“Novo Cartão em Estilo de Vida”</strong>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda (4 cols no desktop): Cartões de Crédito Disponíveis */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-terracotta-500">
                  language
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-espresso-700">
                  Cartões Globais ({creditCards.length})
                </span>
              </div>
              <span className="text-[10px] font-semibold text-espresso-600 bg-oat-200/80 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px]">all_inclusive</span>
                Em todos os meses
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {creditCards.map((card) => {
                const isSelected = activeCard?.id === card.id;
                const txCount = card.cardTransactions?.length || 0;
                const limitPercent =
                  card.cardLimit && card.cardLimit > 0
                    ? Math.min(100, (card.amount / card.cardLimit) * 100)
                    : 0;
                const isOverCardLimit =
                  Boolean(card.cardLimit) && card.amount > (card.cardLimit || 0);

                return (
                  <motion.div
                    key={card.id}
                    whileHover={{ y: -2 }}
                    onClick={() => handleSelectCard(card.id)}
                    className={`p-4 rounded-3xl border-2 transition cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-br from-terracotta-50/95 via-oat-50 to-maldives-50/50 border-terracotta-500 shadow-cozy'
                        : 'bg-oat-50/90 border-oat-300 hover:border-terracotta-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? 'bg-terracotta-500 text-white border-terracotta-600'
                              : 'bg-terracotta-50 text-terracotta-600 border-terracotta-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl">
                            credit_card
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-display font-bold text-espresso-900 truncate">
                            {card.name}
                          </h3>
                          <div className="flex items-center gap-2 text-[11px] text-espresso-500 font-mono">
                            <span>
                              {txCount} {txCount === 1 ? 'compra' : 'compras'}
                            </span>
                            {card.cardDueDay && (
                              <span>• Venc. dia {card.cardDueDay}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-terracotta-500 text-white shrink-0">
                          Selecionado
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-oat-200 text-espresso-600 border border-oat-300 shrink-0 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">language</span>
                          Global
                        </span>
                      )}
                    </div>

                    <div className="mt-3.5 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-espresso-500 block">
                          Total na Planilha
                        </span>
                        <span className="text-lg font-mono font-extrabold text-espresso-900">
                          {card.amount > 0 ? (
                            formatCurrency(card.amount)
                          ) : (
                            <span className="text-xs font-sans font-bold text-sage-600 flex items-center gap-1">
                              <span>🍃 Fatura Zerada</span>
                            </span>
                          )}
                        </span>
                      </div>

                      {card.cardLimit && card.cardLimit > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-espresso-500 block">
                            Teto Planejado
                          </span>
                          <span
                            className={`text-xs font-mono font-bold ${
                              isOverCardLimit
                                ? 'text-terracotta-600'
                                : 'text-espresso-700'
                            }`}
                          >
                            {formatCurrency(card.cardLimit)}
                          </span>
                        </div>
                      )}
                    </div>

                    {card.cardLimit && card.cardLimit > 0 && (
                      <div className="w-full bg-oat-200 rounded-full h-2 mt-2 overflow-hidden p-0.5 border border-oat-300">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverCardLimit
                              ? 'bg-terracotta-600'
                              : 'bg-maldives-500'
                          }`}
                          style={{ width: `${limitPercent}%` }}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingCard(true)}
              className="w-full p-3 rounded-2xl border-2 border-dashed border-oat-300 hover:border-terracotta-400 bg-oat-100/60 hover:bg-terracotta-50/50 text-espresso-700 hover:text-terracotta-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[18px]">add_card</span>
              <span>+ Cadastrar Outro Cartão Global</span>
            </button>
          </div>

          {/* Coluna Direita (8 cols no desktop): Detalhamento e Lançamento de Gastos Individualizados do Cartão Ativo */}
          {activeCard && (
            <div className="lg:col-span-8 bg-oat-50/95 border border-oat-300/90 rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden space-y-5">
              {/* Cabeçalho do Cartão Selecionado */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-4 border-b border-oat-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-terracotta-50 border border-terracotta-200 flex items-center justify-center shrink-0 shadow-2xs">
                    <span className="material-symbols-outlined text-terracotta-600 text-2xl">
                      receipt_long
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-display font-bold text-espresso-900 truncate">
                        {activeCard.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-oat-200 text-espresso-700 border border-oat-300 flex items-center gap-1 shrink-0">
                        <span className="material-symbols-outlined text-[12px] text-terracotta-500">
                          language
                        </span>
                        <span>Cartão Global</span>
                      </span>
                      {activeCard.cardDueDay && (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-oat-200 text-espresso-700 border border-oat-300 shrink-0">
                          Venc. dia {activeCard.cardDueDay}
                          {activeCard.cardClosingDay ? ` • Fecha dia ${activeCard.cardClosingDay}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-espresso-600 mt-0.5">
                      Fatura de {selectedMonthKey ? formatMonthKeyLabel(selectedMonthKey) : 'deste mês'}:{' '}
                      <strong className="font-mono text-terracotta-600">
                        {formatCurrency(activeCard.amount)}
                      </strong>{' '}
                      • Soma dos lançamentos:{' '}
                      <strong className="font-mono text-maldives-700">
                        {formatCurrency(sumOfActiveCardItems)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
                    disabled={isParsingPdf}
                    className="px-3 py-1.5 rounded-xl bg-maldives-500 hover:bg-maldives-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                    title="Selecionar arquivo da fatura (PDF do Banco Inter/outros ou CSV do Nubank)"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isParsingPdf ? 'progress_activity' : 'upload_file'}
                    </span>
                    <span>
                      {isParsingPdf
                        ? 'Lendo Fatura...'
                        : 'Importar Fatura (PDF / CSV)'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Importar fatura em PDF do Banco Inter (suporte a senha com CPF)"
                  >
                    <span className="material-symbols-outlined text-[16px] text-orange-600">
                      picture_as_pdf
                    </span>
                    <span>Fatura Inter (PDF)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPastedInvoiceModalOpen(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-800 border border-oat-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Colar texto de extrato ou fatura copiado do app ou PDF"
                  >
                    <span className="material-symbols-outlined text-[16px] text-espresso-600">
                      content_paste
                    </span>
                    <span>Colar Texto</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadSampleNubankCsv}
                    className="px-2.5 py-1.5 rounded-xl bg-maldives-50 hover:bg-maldives-100 text-maldives-800 border border-maldives-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    title="Carregar fatura de exemplo Nubank_2026-11-01.csv neste cartão"
                  >
                    <span className="material-symbols-outlined text-[16px] text-maldives-600">
                      description
                    </span>
                    <span>Exemplo Nubank (.csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={
                      isEditingCardMeta
                        ? () => setIsEditingCardMeta(false)
                        : startEditingActiveCard
                    }
                    className="px-2.5 py-1.5 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-800 border border-oat-300 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isEditingCardMeta ? 'close' : 'settings'}
                    </span>
                    <span>{isEditingCardMeta ? 'Fechar' : 'Ajustar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConvertCardToDirect(activeCard)}
                    className="p-1.5 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-500 hover:text-espresso-800 border border-oat-300 transition flex items-center justify-center cursor-pointer"
                    title="Voltar este item para Gasto Direto/Pix"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      swap_horiz
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeleteCardModalOpen(true)}
                    className="p-1.5 rounded-xl bg-oat-100 hover:bg-terracotta-50 text-espresso-500 hover:text-terracotta-600 border border-oat-300 transition flex items-center justify-center cursor-pointer"
                    title="Gerenciar exclusão deste cartão (global ou deste mês)"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>

              {/* Painel de Pré-visualização e Confirmação da Importação de Fatura CSV */}
              <AnimatePresence>
                {csvPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 rounded-2xl bg-maldives-50/90 border-2 border-maldives-400 space-y-3.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-maldives-700 text-xl shrink-0">
                            task_alt
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-display font-bold text-espresso-900 truncate">
                              Fatura {csvPreview.fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV'} Lida: {csvPreview.fileName}{' '}
                              {csvPreview.detectedBank ? `(${csvPreview.detectedBank})` : ''}
                            </h4>
                            <p className="text-[11px] text-espresso-600">
                              Pronta para aplicar como fatura do cartão{' '}
                              <strong>{activeCard.name}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[10px] font-bold uppercase text-maldives-800 block">
                            Valor Total da Fatura ({csvPreview.fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV'})
                          </span>
                          <span className="text-base sm:text-lg font-mono font-extrabold text-maldives-700">
                            {formatCurrency(csvPreview.totalAmount)} (
                            {csvPreview.transactions.length} compras)
                          </span>
                        </div>
                      </div>

                      {csvPreview.ignoredPaymentsCount > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-oat-50/90 border border-maldives-200 text-[11px] text-espresso-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sage-600 text-[16px] shrink-0">
                            info
                          </span>
                          <span>
                            Ignoramos automaticamente{' '}
                            <strong>
                              {csvPreview.ignoredPaymentsCount} pagamento(s) recebido(s)
                            </strong>{' '}
                            ({formatCurrency(csvPreview.ignoredPaymentsTotal)}) para contabilizar apenas os gastos reais da fatura.
                          </span>
                        </div>
                      )}

                      {csvPreview.cycleInfo?.hasPreviousMonthPurchases && (
                        <div className="px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-300 text-[11px] text-amber-950 flex items-center gap-2 shadow-2xs">
                          <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0">
                            sync_alt
                          </span>
                          <div>
                            <strong>Ciclo de Fechamento Detectado:</strong> Foram identificadas{' '}
                            <strong>{csvPreview.cycleInfo.previousMonthCount} compras</strong> realizadas no mês anterior (após o fechamento, ex: a partir do dia 26/09). Elas serão mapeadas automaticamente no calendário diário deste mês!
                          </div>
                        </div>
                      )}

                      {/* Escolha do Modo de Importação (Substituir Fatura vs Somar) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCsvImportMode('replace')}
                          className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2 ${
                            csvImportMode === 'replace'
                              ? 'bg-maldives-500 text-white border-maldives-600 shadow-xs font-bold'
                              : 'bg-oat-50 text-espresso-700 border-oat-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                            {csvImportMode === 'replace'
                              ? 'radio_button_checked'
                              : 'radio_button_unchecked'}
                          </span>
                          <div>
                            <span className="block font-bold">
                              Substituir Fatura Atual (Recomendado)
                            </span>
                            <span
                              className={`text-[10px] block ${
                                csvImportMode === 'replace'
                                  ? 'text-white/90'
                                  : 'text-espresso-500'
                              }`}
                            >
                              O arquivo importado será o equivalente exato à fatura de{' '}
                              {activeCard.name} ({formatCurrency(csvPreview.totalAmount)})
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCsvImportMode('append')}
                          className={`p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2 ${
                            csvImportMode === 'append'
                              ? 'bg-maldives-500 text-white border-maldives-600 shadow-xs font-bold'
                              : 'bg-oat-50 text-espresso-700 border-oat-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">
                            {csvImportMode === 'append'
                              ? 'radio_button_checked'
                              : 'radio_button_unchecked'}
                          </span>
                          <div>
                            <span className="block font-bold">
                              Somar aos Itens Existentes
                            </span>
                            <span
                              className={`text-[10px] block ${
                                csvImportMode === 'append'
                                  ? 'text-white/90'
                                  : 'text-espresso-500'
                              }`}
                            >
                              Adiciona os {csvPreview.transactions.length} itens do arquivo aos{' '}
                              {activeCardTransactions.length} itens já lançados
                            </span>
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setCsvPreview(null)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmCsvImport}
                          className="px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            check_circle
                          </span>
                          <span>
                            Aplicar Fatura em {activeCard.name} (
                            {formatCurrency(csvPreview.totalAmount)})
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Aviso caso o valor manual do cartão esteja diferente da soma dos itens */}
              {activeCardTransactions.length > 0 &&
                Math.abs(activeCard.amount - sumOfActiveCardItems) > 0.05 && (
                  <div className="p-3 rounded-2xl bg-maldives-50 border border-maldives-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="text-espresso-700">
                      A soma das compras individualizadas é{' '}
                      <strong className="font-mono text-maldives-800">
                        {formatCurrency(sumOfActiveCardItems)}
                      </strong>
                      , enquanto o valor na planilha está em{' '}
                      <strong className="font-mono">
                        {formatCurrency(activeCard.amount)}
                      </strong>
                      .
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateExpense(activeCard.id, {
                          amount: sumOfActiveCardItems,
                        })
                      }
                      className="px-3 py-1 rounded-xl bg-maldives-500 text-white font-bold shrink-0 cursor-pointer"
                    >
                      Igualar Fatura à Soma
                    </button>
                  </div>
                )}

              {/* Painel de Edição de Nome, Limite e Dia de Vencimento do Cartão */}
              <AnimatePresence>
                {isEditingCardMeta && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <form
                      onSubmit={handleSaveCardMeta}
                      className="p-4 rounded-2xl bg-oat-100 border-2 border-terracotta-300 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-oat-200 pb-2">
                        <div className="text-xs font-bold uppercase text-terracotta-700 tracking-wider flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]">language</span>
                          <span>Configurações Globais do Cartão</span>
                        </div>
                        <span className="text-[10px] font-semibold text-espresso-600 bg-terracotta-100/70 text-terracotta-800 px-2 py-0.5 rounded-full">
                          Aplica em todos os meses
                        </span>
                      </div>
                      <p className="text-[11px] text-espresso-600">
                        Alterações no nome, teto de gastos ou dia de vencimento serão sincronizadas em <strong>todos os meses</strong> do sistema.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-espresso-700 block mb-1">
                            Nome do Cartão
                          </label>
                          <input
                            type="text"
                            value={editCardName}
                            onChange={(e) => setEditCardName(e.target.value)}
                            className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-1.5 text-xs font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-espresso-700 block mb-1">
                            Teto Global Planejado (R$)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={editCardLimit}
                            onChange={(e) =>
                              setEditCardLimit(
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="Sem teto fixo"
                            className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-espresso-700 block mb-1">
                            Dia de Vencimento
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={editCardDueDay}
                            onChange={(e) =>
                              setEditCardDueDay(
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="Ex: 10"
                            className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-espresso-700 block mb-1" title="Dia que fecha a fatura (ex: dia 25)">
                            Dia de Fechamento
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={editCardClosingDay}
                            onChange={(e) =>
                              setEditCardClosingDay(
                                e.target.value === ''
                                  ? ''
                                  : Number(e.target.value)
                              )
                            }
                            placeholder="Ex: 25"
                            className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingCardMeta(false)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-[16px]">save</span>
                          <span>Salvar Alterações Globais</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Formulário para Lançar Novo Gasto Individualizado no Cartão */}
              <form
                onSubmit={handleAddTransaction}
                className="bg-oat-100/90 border border-oat-300 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-espresso-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-terracotta-600 text-[18px]">
                      add_shopping_cart
                    </span>
                    <span>
                      Adicionar Gasto Individualizado em {activeCard.name}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="text-[11px] font-semibold text-espresso-700 mb-1 block">
                      Estabelecimento / Compra
                    </label>
                    <input
                      type="text"
                      value={txDesc}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTxDesc(val);
                        if (val.trim().length > 2) {
                          setTxTag(inferCardPurchaseTag(val));
                        }
                      }}
                      placeholder="Ex: Restaurante, iFood, Uber, Spotify, Shein..."
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-sm text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-semibold text-espresso-700 mb-1 block">
                      Valor na Fatura (R$)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={txAmount}
                      onChange={(e) =>
                        setTxAmount(
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="0,00"
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="text-[11px] font-semibold text-espresso-700 mb-1 block">
                      Subcategoria no Cartão
                    </label>
                    <select
                      value={txTag}
                      onChange={(e) =>
                        setTxTag(e.target.value as CardPurchaseTag)
                      }
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-xs font-bold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    >
                      {(
                        Object.keys(CARD_PURCHASE_TAGS) as CardPurchaseTag[]
                      ).map((tagKey) => (
                        <option key={tagKey} value={tagKey}>
                          {CARD_PURCHASE_TAGS[tagKey].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3 items-end">
                  <div className="col-span-1 sm:col-span-4">
                    <label className="text-[11px] font-semibold text-espresso-700 mb-1 block">
                      Parcela / Tipo
                    </label>
                    <input
                      type="text"
                      value={txInstallment}
                      onChange={(e) => setTxInstallment(e.target.value)}
                      placeholder="Ex: À vista, Parcela 1/3"
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-xs font-semibold text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-4">
                    <label className="text-[11px] font-semibold text-espresso-700 mb-1 block">
                      Data / Dia (Opcional)
                    </label>
                    <input
                      type="text"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      placeholder="Ex: 24/10"
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-xs text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-4">
                    <button
                      type="submit"
                      disabled={!txDesc.trim() || !txAmount}
                      className="w-full h-[38px] bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        add
                      </span>
                      <span>Lançar na Fatura</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Busca + Filtros por Tag / Subcategoria da Fatura */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedTagFilter('all')}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                      selectedTagFilter === 'all'
                        ? 'bg-espresso-900 text-oat-50 border-espresso-900'
                        : 'bg-oat-100 text-espresso-700 border-oat-300 hover:border-terracotta-300'
                    }`}
                  >
                    Todas ({activeCardTransactions.length})
                  </button>

                  {(Object.keys(CARD_PURCHASE_TAGS) as CardPurchaseTag[]).map(
                    (tagKey) => {
                      const tagMeta = CARD_PURCHASE_TAGS[tagKey];
                      const totalTag = tagTotalsForActiveCard[tagKey] || 0;
                      if (totalTag <= 0 && selectedTagFilter !== tagKey)
                        return null;

                      return (
                        <button
                          key={tagKey}
                          type="button"
                          onClick={() => setSelectedTagFilter(tagKey)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition cursor-pointer max-w-full ${
                            selectedTagFilter === tagKey
                              ? 'bg-terracotta-500 text-white border-terracotta-600'
                              : 'bg-oat-100 text-espresso-700 border-oat-300 hover:border-terracotta-300'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px] shrink-0">
                            {tagMeta.icon}
                          </span>
                          <span className="truncate">{tagMeta.label}</span>
                          <span className="font-mono opacity-85 shrink-0">
                            ({formatCurrency(totalTag)})
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {activeCardTransactions.length > 3 && (
                  <div className="relative sm:w-48 shrink-0">
                    <span className="material-symbols-outlined text-espresso-400 text-[16px] absolute left-2.5 top-2">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar na fatura..."
                      className="w-full bg-oat-100 border border-oat-300 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>
                )}
              </div>

              {/* Lista de Gastos Individualizados da Fatura */}
              <div className="overflow-hidden border border-oat-300 rounded-2xl bg-oat-50">
                <div className="max-h-[440px] overflow-y-auto divide-y divide-oat-200">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-8 text-center text-espresso-500 text-xs sm:text-sm space-y-1">
                      <p className="font-bold text-espresso-700">
                        Nenhuma compra individualizada neste cartão ainda.
                      </p>
                      <p>
                        Adicione manualmente acima ou clique em{' '}
                        <strong>“Importar Fatura (PDF / CSV)”</strong> para carregar o arquivo da fatura deste cartão (ex: Banco Inter ou Nubank).
                      </p>
                    </div>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const tagMeta =
                        CARD_PURCHASE_TAGS[tx.tag] || CARD_PURCHASE_TAGS.outros;

                      return (
                        <div
                          key={tx.id}
                          className="p-3.5 sm:px-4 hover:bg-oat-100/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                        >
                          <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${tagMeta.badgeClass}`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {tagMeta.icon}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={tx.description}
                                onChange={(e) =>
                                  handleUpdateTransaction(tx.id, {
                                    description: e.target.value,
                                  })
                                }
                                className="w-full bg-transparent text-sm font-semibold text-espresso-900 hover:border-b hover:border-oat-400 focus:border-b focus:border-terracotta-500 focus:outline-none truncate"
                              />

                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <select
                                  value={tx.tag}
                                  onChange={(e) =>
                                    handleUpdateTransaction(tx.id, {
                                      tag: e.target.value as CardPurchaseTag,
                                    })
                                  }
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none ${tagMeta.badgeClass}`}
                                >
                                  {(
                                    Object.keys(
                                      CARD_PURCHASE_TAGS
                                    ) as CardPurchaseTag[]
                                  ).map((k) => (
                                    <option key={k} value={k}>
                                      {CARD_PURCHASE_TAGS[k].label}
                                    </option>
                                  ))}
                                </select>

                                {/* Parcela Editável */}
                                <div
                                  className="flex items-center gap-1 bg-oat-200/90 dark:bg-espresso-800/90 rounded-lg px-2 py-0.5 border border-oat-300 dark:border-espresso-700"
                                  title="Editar parcela (ex: À vista, 1/3, 2/6, Recorrente)"
                                >
                                  <span className="material-symbols-outlined text-[13px] text-espresso-500">
                                    layers
                                  </span>
                                  <input
                                    type="text"
                                    value={tx.installment || ''}
                                    placeholder="À vista"
                                    onChange={(e) =>
                                      handleUpdateTransaction(tx.id, {
                                        installment: e.target.value,
                                      })
                                    }
                                    className="w-16 sm:w-20 bg-transparent text-[10px] font-mono font-bold text-espresso-800 dark:text-oat-100 focus:outline-none focus:border-b focus:border-terracotta-500 placeholder:text-espresso-400"
                                  />
                                </div>

                                {/* Dia / Data Editável */}
                                <div
                                  className="flex items-center gap-1 bg-oat-200/90 dark:bg-espresso-800/90 rounded-lg px-2 py-0.5 border border-oat-300 dark:border-espresso-700"
                                  title="Editar dia ou data da compra (ex: 12/11, 2026-11-12 ou dia 12)"
                                >
                                  <span className="material-symbols-outlined text-[13px] text-espresso-500">
                                    calendar_today
                                  </span>
                                  <input
                                    type="text"
                                    value={tx.purchaseDate || ''}
                                    placeholder="DD/MM"
                                    onChange={(e) =>
                                      handleUpdateTransaction(tx.id, {
                                        purchaseDate: e.target.value,
                                      })
                                    }
                                    className="w-14 sm:w-16 bg-transparent text-[10px] font-mono text-espresso-700 dark:text-oat-200 focus:outline-none focus:border-b focus:border-terracotta-500 text-center placeholder:text-espresso-400"
                                  />
                                </div>

                                {/* Badge de Ciclo de Fechamento da Fatura */}
                                {tx.purchaseDate &&
                                  selectedMonthKey &&
                                  (() => {
                                    const parts = selectedMonthKey.split('-');
                                    if (parts.length !== 2) return false;
                                    const curM = parseInt(parts[1], 10);
                                    const prevM = curM === 1 ? 12 : curM - 1;
                                    const prevMStr = String(prevM).padStart(2, '0');
                                    const isPrev =
                                      tx.purchaseDate.endsWith(`/${prevMStr}`) ||
                                      tx.purchaseDate.includes(`/${prevMStr}/`) ||
                                      tx.purchaseDate.includes(`-${prevMStr}-`);
                                    return (
                                      isPrev && (
                                        <span
                                          title="Compra realizada após o fechamento da fatura anterior (Ciclo da Fatura)"
                                          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shrink-0 flex items-center gap-0.5"
                                        >
                                          <span>↺</span>
                                          <span>Ciclo</span>
                                        </span>
                                      )
                                    );
                                  })()}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-espresso-500 font-mono">
                                R$
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={tx.amount}
                                onChange={(e) =>
                                  handleUpdateTransaction(tx.id, {
                                    amount: Math.max(
                                      0,
                                      Number(e.target.value)
                                    ),
                                  })
                                }
                                className="w-24 sm:w-28 bg-oat-100 border border-oat-300 focus:border-terracotta-500 rounded-xl px-2.5 py-1.5 text-sm font-bold text-right text-espresso-900 font-mono focus:outline-none"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCloneTransaction(tx)}
                              className="text-espresso-400 hover:text-maldives-600 p-1.5 rounded-xl hover:bg-maldives-50 dark:hover:bg-maldives-950/40 transition cursor-pointer"
                              title="Clonar esta compra na fatura (duplicar)"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                content_copy
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="text-espresso-400 hover:text-terracotta-600 p-1.5 rounded-xl hover:bg-terracotta-50 transition cursor-pointer"
                              title="Remover compra da fatura"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmação e Escopo de Exclusão do Cartão */}
      <AnimatePresence>
        {isDeleteCardModalOpen && activeCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-espresso-950/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-oat-50 border border-oat-300 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-oat-200">
                <div className="w-10 h-10 rounded-2xl bg-terracotta-100 text-terracotta-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">delete</span>
                </div>
                <div>
                  <h3 className="text-base font-display font-bold text-espresso-900">
                    Gerenciar Cartão
                  </h3>
                  <p className="text-xs text-espresso-600 font-semibold truncate">
                    {activeCard.name}
                  </p>
                </div>
              </div>

              <p className="text-xs text-espresso-700 leading-relaxed">
                Como este é um <strong>Cartão Global</strong>, escolha como deseja proceder:
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleDeleteCardChoice('current_month')}
                  className="w-full text-left p-3.5 rounded-2xl bg-oat-100 hover:bg-oat-200 border border-oat-300 transition flex items-start gap-3 cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-maldives-600 text-xl mt-0.5 shrink-0">
                    restart_alt
                  </span>
                  <div>
                    <span className="text-xs font-bold text-espresso-900 block group-hover:text-maldives-700">
                      Zerar Fatura Apenas Deste Mês
                    </span>
                    <span className="text-[11px] text-espresso-500 block mt-0.5">
                      Apaga as compras e zera a fatura de {selectedMonthKey ? formatMonthKeyLabel(selectedMonthKey) : 'deste mês'}, mantendo o cartão salvo para os outros meses.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteCardChoice('global')}
                  className="w-full text-left p-3.5 rounded-2xl bg-terracotta-50 hover:bg-terracotta-100 border border-terracotta-300 transition flex items-start gap-3 cursor-pointer group"
                >
                  <span className="material-symbols-outlined text-terracotta-600 text-xl mt-0.5 shrink-0">
                    delete_forever
                  </span>
                  <div>
                    <span className="text-xs font-bold text-terracotta-800 block group-hover:text-terracotta-600">
                      Excluir Cartão Globalmente (Todos os Meses)
                    </span>
                    <span className="text-[11px] text-terracotta-600/90 block mt-0.5">
                      Remove completamente o cartão do seu cadastro global e de todos os meses do sistema.
                    </span>
                  </div>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteCardModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Senha para Fatura PDF Protegida (Banco Inter, etc.) */}
      <AnimatePresence>
        {pdfPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-espresso-950/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={handleCancelPdfPassword}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-oat-50 dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shadow-2xs">
                    <span className="material-symbols-outlined text-2xl">
                      lock
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-espresso-900 dark:text-oat-100">
                      Fatura Protegida por Senha
                    </h3>
                    <p className="text-xs text-espresso-600 dark:text-espresso-400 truncate max-w-[220px]">
                      {pendingPdfFile?.name || 'Fatura em PDF'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelPdfPassword}
                  className="p-1 rounded-full text-espresso-400 hover:text-espresso-700 hover:bg-oat-200 transition cursor-pointer"
                  title="Fechar"
                >
                  <span className="material-symbols-outlined text-lg">
                    close
                  </span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/50 text-xs text-amber-950 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                  <span className="material-symbols-outlined text-[17px] text-amber-600">
                    lightbulb
                  </span>
                  <span>Dica de Desbloqueio (Banco Inter):</span>
                </div>
                <p className="leading-relaxed">
                  As faturas do <strong>Banco Inter</strong> geralmente vêm protegidas com os <strong>primeiros 5 ou 6 dígitos do seu CPF</strong> (apenas números).
                </p>
                <div className="flex items-center gap-1 text-[11px] text-amber-800/80 dark:text-amber-400/80 pt-0.5">
                  <span className="material-symbols-outlined text-[14px] text-sage-600">
                    verified_user
                  </span>
                  <span>
                    100% seguro: a descriptografia é processada no seu navegador e sua senha nunca é gravada ou transmitida.
                  </span>
                </div>
              </div>

              <form onSubmit={handleUnlockPdfWithPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-espresso-800 dark:text-espresso-200 mb-1">
                    Digite a Senha da Fatura
                  </label>
                  <div className="relative">
                    <input
                      type={showPdfPassword ? 'text' : 'password'}
                      value={pdfPasswordInput}
                      onChange={(e) => {
                        setPdfPasswordInput(e.target.value);
                        if (pdfPasswordError) setPdfPasswordError(null);
                      }}
                      placeholder="Ex: 123456 (dígitos do CPF)"
                      autoFocus
                      className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-white dark:bg-espresso-800 border border-oat-300 dark:border-espresso-700 text-sm font-mono text-espresso-900 dark:text-oat-100 placeholder:text-espresso-400 focus:outline-hidden focus:ring-2 focus:ring-terracotta-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPdfPassword(!showPdfPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-700 transition"
                      tabIndex={-1}
                      title={showPdfPassword ? 'Ocultar senha' : 'Exibir senha'}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showPdfPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {pdfPasswordError && (
                    <div className="space-y-2 mt-2">
                      <p className="text-xs text-terracotta-600 font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">
                          error
                        </span>
                        {pdfPasswordError}
                      </p>

                      {pdfDebugLines.length > 0 && (
                        <div className="rounded-xl border border-oat-300 dark:border-espresso-700 bg-oat-100 dark:bg-espresso-800 p-2.5 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-espresso-800 dark:text-oat-100 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px] text-maldives-600">
                                terminal
                              </span>
                              <span>Linhas lidas do PDF ({pdfDebugLines.length})</span>
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    pdfDebugLines.join('\n')
                                  );
                                  setIsCopiedDebug(true);
                                  setTimeout(() => setIsCopiedDebug(false), 2000);
                                }}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-espresso-700 border border-oat-300 text-[10px] font-bold text-espresso-700 dark:text-oat-200 hover:bg-oat-200 cursor-pointer"
                              >
                                {isCopiedDebug ? 'Copiado!' : 'Copiar Texto'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowDebugLines(!showDebugLines)}
                                className="px-2 py-0.5 rounded-lg bg-white dark:bg-espresso-700 border border-oat-300 text-[10px] font-bold text-espresso-700 dark:text-oat-200 hover:bg-oat-200 cursor-pointer"
                              >
                                {showDebugLines ? 'Recolher' : 'Expandir'}
                              </button>
                            </div>
                          </div>

                          {showDebugLines && (
                            <pre className="max-h-40 overflow-y-auto text-[10px] font-mono p-2 bg-white dark:bg-espresso-950 rounded-lg border border-oat-200 dark:border-espresso-800 text-espresso-800 dark:text-oat-200 whitespace-pre-wrap select-all">
                              {pdfDebugLines.slice(0, 35).join('\n')}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPdfPasswordModalOpen(false);
                      setPastedInvoiceModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-terracotta-600 hover:text-terracotta-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      content_paste
                    </span>
                    <span>Colar texto manualmente</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCancelPdfPassword}
                      disabled={isParsingPdf}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isParsingPdf || !pdfPasswordInput.trim()}
                      className="px-4 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                    >
                      {isParsingPdf ? (
                        <>
                          <span className="animate-spin material-symbols-outlined text-base">
                            progress_activity
                          </span>
                          <span>Descriptografando...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">
                            lock_open
                          </span>
                          <span>Desbloquear e Importar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para Colar Texto da Fatura Manualmente */}
      <AnimatePresence>
        {pastedInvoiceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-espresso-950/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setPastedInvoiceModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-oat-50 dark:bg-espresso-900 border border-oat-300 dark:border-espresso-700 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-maldives-100 dark:bg-maldives-900/40 text-maldives-700 dark:text-maldives-300 flex items-center justify-center shadow-2xs">
                    <span className="material-symbols-outlined text-2xl">
                      content_paste
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-display font-bold text-espresso-900 dark:text-oat-100">
                      Colar Texto da Fatura
                    </h3>
                    <p className="text-xs text-espresso-600 dark:text-espresso-400">
                      Copie o extrato de compras do seu app ou PDF e cole abaixo
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPastedInvoiceModalOpen(false)}
                  className="p-1 rounded-full text-espresso-400 hover:text-espresso-700 hover:bg-oat-200 transition cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>

              <form onSubmit={handleProcessPastedInvoice} className="space-y-3">
                <textarea
                  value={pastedInvoiceText}
                  onChange={(e) => setPastedInvoiceText(e.target.value)}
                  placeholder="Exemplo de linhas que você pode colar aqui:
12/10 IFOOD *RESTAURANTE 45,90
14/10 SHEIN BRASIL 129,90 01/03
18/10 UBER TRIP 24,90"
                  rows={8}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-espresso-800 border border-oat-300 dark:border-espresso-700 text-xs font-mono text-espresso-900 dark:text-oat-100 placeholder:text-espresso-400 focus:outline-hidden focus:ring-2 focus:ring-terracotta-500"
                />

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPastedInvoiceModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-espresso-600 hover:bg-oat-200 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!pastedInvoiceText.trim()}
                    className="px-4 py-2 rounded-xl bg-maldives-500 hover:bg-maldives-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">
                      playlist_add_check
                    </span>
                    <span>Processar Texto Colado</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      )}
    </div>
  );
};
