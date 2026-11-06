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

/** Calcula o patrimônio necessário para viver de renda passiva (Regra dos 4% / 6% a.a.) */
export function calculateFireTarget(monthlyCost: number, realYieldAnnual = 0.06): number {
  const annualCost = monthlyCost * 12;
  return realYieldAnnual > 0 ? annualCost / realYieldAnnual : 0;
}

/** Calcula estimativa de meses para atingir liberdade financeira partindo do zero */
export function estimateMonthsToFire(
  currentMonthlyInvestment: number,
  targetPatrimony: number,
  annualInterestRate = 0.10
): number {
  if (currentMonthlyInvestment <= 0 || targetPatrimony <= 0) return 0;
  const monthlyRate = Math.pow(1 + annualInterestRate, 1 / 12) - 1;
  if (monthlyRate <= 0) {
    return Math.ceil(targetPatrimony / currentMonthlyInvestment);
  }

  const factor = (targetPatrimony * monthlyRate) / currentMonthlyInvestment + 1;
  if (factor <= 1) return 0;

  const months = Math.log(factor) / Math.log(1 + monthlyRate);
  return Math.ceil(months);
}

export interface GoalProjectionResult {
  monthsRemaining: number;
  yearsFormatted: string;
  estimatedDateLabel: string;
  progressPercent: number;
  remainingAmount: number;
  totalContributedOutOfPocket: number;
  totalInterestEarned: number;
  projectedFinalAmount: number;
  monthsSavedWithExtra100: number;
  isAlreadyReached: boolean;
}

/**
 * Calcula a projeção completa de uma Meta Personalizada de Longo Prazo
 * considerando saldo já acumulado (PV), aporte mensal (PMT) e taxa anual de juros compostos.
 */
export function calculateGoalProjection(
  targetAmount: number,
  currentAmount: number,
  monthlyContribution: number,
  annualInterestRatePercent: number
): GoalProjectionResult {
  const safeTarget = Math.max(1, targetAmount);
  const safeCurrent = Math.max(0, currentAmount);
  const safeMonthly = Math.max(0, monthlyContribution);
  const progressPercent = Math.min(100, (safeCurrent / safeTarget) * 100);

  if (safeCurrent >= safeTarget) {
    return {
      monthsRemaining: 0,
      yearsFormatted: 'Concluída!',
      estimatedDateLabel: 'Meta já atingida 🎉',
      progressPercent: 100,
      remainingAmount: 0,
      totalContributedOutOfPocket: safeCurrent,
      totalInterestEarned: 0,
      projectedFinalAmount: safeCurrent,
      monthsSavedWithExtra100: 0,
      isAlreadyReached: true,
    };
  }

  const monthlyRate =
    annualInterestRatePercent > 0
      ? Math.pow(1 + annualInterestRatePercent / 100, 1 / 12) - 1
      : 0;

  const computeMonths = (pv: number, pmt: number, r: number, fv: number): number => {
    if (pv >= fv) return 0;
    if (r <= 0) {
      return pmt > 0 ? Math.ceil((fv - pv) / pmt) : Infinity;
    }
    const denominator = pv * r + pmt;
    if (denominator <= 0) return Infinity;
    const numerator = fv * r + pmt;
    if (numerator / denominator <= 1) return 0;
    const n = Math.log(numerator / denominator) / Math.log(1 + r);
    return Math.ceil(Math.max(0, n));
  };

  const monthsRemaining = computeMonths(safeCurrent, safeMonthly, monthlyRate, safeTarget);

  if (!Number.isFinite(monthsRemaining) || monthsRemaining > 1200) {
    return {
      monthsRemaining: Infinity,
      yearsFormatted: 'Indefinido',
      estimatedDateLabel: 'Defina um aporte mensal',
      progressPercent,
      remainingAmount: safeTarget - safeCurrent,
      totalContributedOutOfPocket: safeCurrent,
      totalInterestEarned: 0,
      projectedFinalAmount: safeCurrent,
      monthsSavedWithExtra100: 0,
      isAlreadyReached: false,
    };
  }

  // Simular evolução mês a mês para obter montante final exato e juros acumulados
  let balance = safeCurrent;
  for (let m = 0; m < monthsRemaining; m++) {
    balance = balance * (1 + monthlyRate) + safeMonthly;
  }

  const totalFutureContributions = safeMonthly * monthsRemaining;
  const totalContributedOutOfPocket = safeCurrent + totalFutureContributions;
  const totalInterestEarned = Math.max(0, balance - totalContributedOutOfPocket);

  // Data estimada
  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + monthsRemaining);
  const estimatedDateLabel = `${monthNames[targetDate.getMonth()]} de ${targetDate.getFullYear()}`;

  const years = Math.floor(monthsRemaining / 12);
  const remMonths = monthsRemaining % 12;
  const yearsFormatted =
    years > 0
      ? remMonths > 0
        ? `${years}a e ${remMonths}m`
        : `${years} ${years === 1 ? 'ano' : 'anos'}`
      : `${monthsRemaining} ${monthsRemaining === 1 ? 'mês' : 'meses'}`;

  const monthsWithExtra = computeMonths(safeCurrent, safeMonthly + 200, monthlyRate, safeTarget);
  const monthsSavedWithExtra100 = Number.isFinite(monthsWithExtra)
    ? Math.max(0, monthsRemaining - monthsWithExtra)
    : 0;

  return {
    monthsRemaining,
    yearsFormatted,
    estimatedDateLabel,
    progressPercent,
    remainingAmount: Math.max(0, safeTarget - safeCurrent),
    totalContributedOutOfPocket,
    totalInterestEarned,
    projectedFinalAmount: balance,
    monthsSavedWithExtra100,
    isAlreadyReached: false,
  };
}

