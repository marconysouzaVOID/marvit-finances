import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CARD_PURCHASE_TAGS } from '../constants';
import {
  CardPurchaseTag,
  CreditCardTransaction,
  ExpenseItem,
} from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { InteractiveAsset } from './InteractiveAsset';

interface CreditCardsManagerProps {
  expenses: ExpenseItem[];
  lifestyleIdealAmount: number;
  lifestyleTotalSpent: number;
  selectedCardId?: string | null;
  onSelectCardId?: (id: string | null) => void;
  onAddCardExpense: (card: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense: (id: string, updated: Partial<ExpenseItem>) => void;
  onDeleteExpense: (id: string) => void;
}

export const CreditCardsManager: React.FC<CreditCardsManagerProps> = ({
  expenses,
  lifestyleIdealAmount,
  lifestyleTotalSpent,
  selectedCardId,
  onSelectCardId,
  onAddCardExpense,
  onUpdateExpense,
  onDeleteExpense,
}) => {
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

  // Outros itens do pilar Estilo de Vida que ainda estão como 'direto' (ou sem subcategoria)
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

  // Estado de edição de configurações do cartão ativo
  const [isEditingCardMeta, setIsEditingCardMeta] = useState(false);
  const [editCardName, setEditCardName] = useState('');
  const [editCardLimit, setEditCardLimit] = useState<number | ''>('');
  const [editCardDueDay, setEditCardDueDay] = useState<number | ''>('');

  // Estado para adicionar gasto individualizado na fatura do cartão selecionado
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txTag, setTxTag] = useState<CardPurchaseTag>('gastronomia');
  const [txInstallment, setTxInstallment] = useState('À vista');
  const [txDate, setTxDate] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<
    'all' | CardPurchaseTag
  >('all');

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
    if (onSelectCardId) onSelectCardId(id);
  };

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim()) return;

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
      isCustom: true,
    });

    setNewCardName('');
    setIsCreatingCard(false);
  };

  const startEditingActiveCard = () => {
    if (!activeCard) return;
    setEditCardName(activeCard.name);
    setEditCardLimit(activeCard.cardLimit || '');
    setEditCardDueDay(activeCard.cardDueDay || '');
    setIsEditingCardMeta(true);
  };

  const handleSaveCardMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !editCardName.trim()) return;
    onUpdateExpense(activeCard.id, {
      name: editCardName.trim(),
      cardLimit: Number(editCardLimit) > 0 ? Number(editCardLimit) : undefined,
      cardDueDay:
        Number(editCardDueDay) >= 1 && Number(editCardDueDay) <= 31
          ? Number(editCardDueDay)
          : undefined,
    });
    setIsEditingCardMeta(false);
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
      amount: Math.max(0, Number(txAmount)),
      tag: txTag,
      installment: txInstallment.trim() || 'À vista',
      purchaseDate: txDate.trim() || undefined,
    };

    const nextTransactions = [newTx, ...currentList];
    const nextTotal = nextTransactions.reduce((acc, t) => acc + t.amount, 0);

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
    const nextTotal = nextTransactions.reduce((acc, t) => acc + t.amount, 0);

    onUpdateExpense(activeCard.id, {
      cardTransactions: nextTransactions,
      amount: nextTotal,
    });
  };

  const handleDeleteTransaction = (txId: string) => {
    if (!activeCard) return;
    const currentList = activeCard.cardTransactions || [];
    const nextTransactions = currentList.filter((t) => t.id !== txId);
    const nextTotal = nextTransactions.reduce((acc, t) => acc + t.amount, 0);

    onUpdateExpense(activeCard.id, {
      cardTransactions: nextTransactions,
      amount: nextTotal,
    });
  };

  // Converter um item existente de Estilo de Vida em Cartão de Crédito já com 1 lançamento inicial se tinha saldo > 0
  const handleConvertDirectToCard = (item: ExpenseItem) => {
    const initialTransactions: CreditCardTransaction[] =
      item.amount > 0
        ? [
            {
              id: `tx-init-${Date.now()}`,
              description: `${item.name} (Saldo inicial)`,
              amount: item.amount,
              tag: 'outros',
              installment: 'À vista',
            },
          ]
        : [];

    onUpdateExpense(item.id, {
      subcategory: 'cartao',
      cardTransactions:
        item.cardTransactions && item.cardTransactions.length > 0
          ? item.cardTransactions
          : initialTransactions,
    });
    handleSelectCard(item.id);
  };

  const activeCardTransactions = activeCard?.cardTransactions || [];
  const filteredTransactions =
    selectedTagFilter === 'all'
      ? activeCardTransactions
      : activeCardTransactions.filter((t) => t.tag === selectedTagFilter);

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
      map[t.tag] = (map[t.tag] || 0) + t.amount;
    });
    return map;
  }, [activeCardTransactions]);

  return (
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
                  Subcategoria Sincronizada
                </span>
              </div>
              <p className="text-xs sm:text-sm text-espresso-600 mt-1">
                Gerencie cada compra individualizada nos seus cartões. O total de cada fatura alimenta automaticamente o pilar <strong>Estilo de Vida (30%)</strong> do mês!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingCard(!isCreatingCard)}
            className="px-4 py-2.5 rounded-2xl bg-terracotta-500 hover:bg-terracotta-600 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCreatingCard ? 'close' : 'add_card'}
            </span>
            <span>
              {isCreatingCard ? 'Fechar Formulário' : 'Novo Cartão em Estilo de Vida'}
            </span>
          </button>
        </div>

        {/* Resumo Consolidado dos Cartões no Pilar Estilo de Vida */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-4 rounded-2xl bg-terracotta-50/90 border border-terracotta-200 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase text-terracotta-700 tracking-wider block">
                Total em Faturas (Estilo de Vida)
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
                Compras Individualizadas
              </span>
              <span className="text-xl font-mono font-extrabold text-espresso-900 mt-0.5 block truncate">
                {totalIndividualTransactions}{' '}
                {totalIndividualTransactions === 1 ? 'compra' : 'compras'}
              </span>
              <span className="text-[11px] text-espresso-600">
                Gastos Diretos/Pix: {formatCurrency(Math.max(0, lifestyleTotalSpent - totalCardsInvoice))}
              </span>
            </div>
            <span className="material-symbols-outlined text-sage-500 text-3xl shrink-0">
              receipt_long
            </span>
          </div>
        </div>

        {/* Formulário de Criação de Novo Cartão de Crédito */}
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
                className="mt-5 p-4 sm:p-5 rounded-2xl bg-oat-100 border-2 border-terracotta-300 space-y-4"
              >
                <div className="text-sm font-display font-bold text-espresso-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-terracotta-600 text-lg">
                    add_card
                  </span>
                  <span>Adicionar Cartão de Crédito ao Pilar Estilo de Vida</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Nome do Cartão / Banco
                    </label>
                    <input
                      type="text"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      placeholder="Ex: Cartão Nubank, Itaú Personnalité, XP..."
                      className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3.5 py-2 text-sm text-espresso-900 focus:outline-none focus:border-terracotta-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                      Meta / Teto deste Cartão (R$)
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
                      Dia do Vencimento (Opcional)
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
                </div>

                <div className="flex justify-end gap-2">
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
                    className="px-5 py-2 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-40 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    Criar Cartão de Crédito
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Atalho rápido para converter gastos existentes de Estilo de Vida na subcategoria Cartão de Crédito */}
        {directLifestyleItems.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-oat-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs text-espresso-600">
              <span className="material-symbols-outlined text-terracotta-500 text-[18px] shrink-0">
                swap_horiz
              </span>
              <span>
                Deseja transformar um item de <strong>Estilo de Vida</strong> já existente em Cartão de Crédito?
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {directLifestyleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleConvertDirectToCard(item)}
                  className="px-2.5 py-1 rounded-xl bg-oat-100 hover:bg-terracotta-50 text-espresso-700 hover:text-terracotta-700 border border-oat-300 hover:border-terracotta-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                  title="Converter para a subcategoria Cartão de Crédito para detalhar compras"
                >
                  <span className="material-symbols-outlined text-[14px] text-terracotta-600">
                    credit_card
                  </span>
                  <span className="truncate max-w-[160px]">{item.name}</span>
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
            Nenhum Cartão de Crédito cadastrado na subcategoria Estilo de Vida ainda
          </h3>
          <p className="text-xs text-espresso-600 max-w-md mx-auto">
            Clique em <strong>“Novo Cartão em Estilo de Vida”</strong> acima ou converta um item existente para começar a lançar seus gastos individualizados de cartão.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Coluna Esquerda (4 cols no desktop): Cartões de Crédito Disponíveis */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-espresso-600">
                Seus Cartões ({creditCards.length})
              </span>
              <span className="text-[11px] text-espresso-500">
                Toque para abrir a fatura
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

                      {isSelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-terracotta-500 text-white shrink-0">
                          Ativo
                        </span>
                      )}
                    </div>

                    <div className="mt-3.5 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-espresso-500 block">
                          Fatura Atual
                        </span>
                        <span className="text-lg font-mono font-extrabold text-espresso-900">
                          {formatCurrency(card.amount)}
                        </span>
                      </div>

                      {card.cardLimit && card.cardLimit > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] text-espresso-500 block">
                            Teto do Cartão
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
          </div>

          {/* Coluna Direita (8 cols no desktop): Detalhamento e Lançamento de Gastos Individualizados do Cartão Ativo */}
          {activeCard && (
            <div className="lg:col-span-8 bg-oat-50/95 border border-oat-300/90 rounded-3xl p-4 sm:p-6 shadow-cozy overflow-hidden space-y-5">
              {/* Cabeçalho do Cartão Selecionado */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-oat-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-terracotta-50 border border-terracotta-200 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-terracotta-600 text-2xl">
                      receipt_long
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-xl font-display font-bold text-espresso-900 truncate">
                        Fatura: {activeCard.name}
                      </h3>
                      {activeCard.cardDueDay && (
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-oat-200 text-espresso-700 border border-oat-300">
                          Vencimento dia {activeCard.cardDueDay}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-espresso-600 mt-0.5">
                      Total da fatura sincronizado em Estilo de Vida:{' '}
                      <strong className="font-mono text-terracotta-600">
                        {formatCurrency(activeCard.amount)}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={
                      isEditingCardMeta
                        ? () => setIsEditingCardMeta(false)
                        : startEditingActiveCard
                    }
                    className="px-3 py-1.5 rounded-xl bg-oat-100 hover:bg-oat-200 text-espresso-800 border border-oat-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isEditingCardMeta ? 'close' : 'settings'}
                    </span>
                    <span>
                      {isEditingCardMeta ? 'Fechar Ajuste' : 'Editar Cartão'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteExpense(activeCard.id)}
                    className="p-1.5 rounded-xl bg-oat-100 hover:bg-terracotta-50 text-espresso-500 hover:text-terracotta-600 border border-oat-300 transition flex items-center justify-center cursor-pointer"
                    title="Excluir este cartão de crédito do mês"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>

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
                      <div className="text-xs font-bold uppercase text-terracotta-700 tracking-wider">
                        Configurações do Cartão
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                            Teto Mensal Planejado (R$)
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
                          className="px-4 py-1.5 rounded-xl bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold cursor-pointer"
                        >
                          Salvar Cartão
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
                    <span>Adicionar Compra Individualizada em {activeCard.name}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-5">
                    <label className="text-[11px] font-semibold text-espresso-700 mb-1 block">
                      Estabelecimento / Descrição da Compra
                    </label>
                    <input
                      type="text"
                      value={txDesc}
                      onChange={(e) => setTxDesc(e.target.value)}
                      placeholder="Ex: Restaurante, iFood, Uber, Cinema, Roupa..."
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
                      Categoria no Cartão
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
                      placeholder="Ex: À vista, 2/6, Recorrente"
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
                      placeholder="Ex: 14/Nov"
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

              {/* Filtros por Tag / Subcategoria da Fatura */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 transition cursor-pointer ${
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
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border shrink-0 flex items-center gap-1.5 transition cursor-pointer ${
                          selectedTagFilter === tagKey
                            ? 'bg-terracotta-500 text-white border-terracotta-600'
                            : 'bg-oat-100 text-espresso-700 border-oat-300 hover:border-terracotta-300'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {tagMeta.icon}
                        </span>
                        <span>{tagMeta.label}</span>
                        <span className="font-mono opacity-85">
                          ({formatCurrency(totalTag)})
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              {/* Lista de Gastos Individualizados da Fatura */}
              <div className="overflow-hidden border border-oat-300 rounded-2xl bg-oat-50">
                <div className="max-h-[420px] overflow-y-auto divide-y divide-oat-200">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-8 text-center text-espresso-500 text-xs sm:text-sm space-y-1">
                      <p className="font-bold text-espresso-700">
                        Nenhuma compra individualizada lançada neste filtro.
                      </p>
                      <p>
                        Use o formulário acima para registrar cada gasto deste cartão e manter sua fatura de Estilo de Vida 100% transparente.
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

                                {tx.installment && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-oat-200 text-espresso-700 border border-oat-300">
                                    {tx.installment}
                                  </span>
                                )}

                                {tx.purchaseDate && (
                                  <span className="text-[10px] font-mono text-espresso-500">
                                    • {tx.purchaseDate}
                                  </span>
                                )}
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
                                step="10"
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
    </div>
  );
};

