import React from 'react';
import { motion } from 'framer-motion';
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

  const insights: {
    title: string;
    desc: string;
    icon: string;
    tone: 'danger' | 'warning' | 'success';
  }[] = [];

  if (percEssencial > 55) {
    insights.push({
      title: 'Custos Fixos Acima da Receita da Casa',
      desc: `Seus gastos essenciais ocupam ${formatPercent(
        percEssencial
      )} da renda (ideal: até 50%). Revise assinaturas recorrentes e contratos fixos para devolver leveza ao mês.`,
      icon: 'warning',
      tone: 'danger',
    });
  } else {
    insights.push({
      title: 'Despensa & Essenciais Equilibrados',
      desc: `Muito bom! Seus custos essenciais estão em ${formatPercent(
        percEssencial
      )}, mantendo uma margem confortável de segurança para imprevistos.`,
      icon: 'verified',
      tone: 'success',
    });
  }

  if (percEstilo > 33) {
    insights.push({
      title: 'Atenção aos Excessos no Estilo de Vida',
      desc: `Lazer e confortos somam ${formatPercent(
        percEstilo
      )} (teto sugerido: 30%). Que tal transformar parte desse valor em mais um aporte nos seus Potes dos Sonhos?`,
      icon: 'local_cafe',
      tone: 'warning',
    });
  } else {
    insights.push({
      title: 'Conforto e Lazer na Medida Certa',
      desc: `Você destina ${formatPercent(
        percEstilo
      )} para curtir o presente sem comprometer sua paz financeira no futuro.`,
      icon: 'spa',
      tone: 'success',
    });
  }

  if (percInvestimento < 18) {
    insights.push({
      title: 'Potencial de Aporte Pode Crescer',
      desc: `Seus investimentos representam ${formatPercent(
        percInvestimento
      )} da renda (meta: 20%+). Pague-se primeiro assim que a renda cair na conta.`,
      icon: 'trending_up',
      tone: 'warning',
    });
  } else {
    insights.push({
      title: 'Colheita de Patrimônio Acelerada',
      desc: `Investindo ${formatPercent(
        percInvestimento
      )} da sua renda! A constância mensal nos juros compostos está encurtando sua jornada até a liberdade.`,
      icon: 'military_tech',
      tone: 'success',
    });
  }

  if (balance < 0) {
    insights.push({
      title: 'Balanço Mensal no Vermelho',
      desc: `As saídas superam a renda em ${formatCurrency(
        Math.abs(balance)
      )}. Ajuste itens variáveis imediatamente para proteger sua reserva.`,
      icon: 'error',
      tone: 'danger',
    });
  } else if (balance > 0) {
    insights.push({
      title: 'Sobra Mensal Disponível para os Potes',
      desc: `Você ainda tem ${formatCurrency(
        balance
      )} livres no mês! Aproveite para turbinar um Pote dos Sonhos ou sua Reserva de Segurança.`,
      icon: 'savings',
      tone: 'success',
    });
  }

  return (
    <div className="bg-oat-50/95 border border-oat-300/90 rounded-3xl p-5 sm:p-6 shadow-cozy">
      <div className="flex items-center gap-3 pb-4 border-b border-oat-200">
        <div className="w-10 h-10 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center">
          <span className="material-symbols-outlined text-maldives-600 text-xl">
            psychology
          </span>
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-display font-bold text-espresso-900">
            Diagnóstico Inteligente & Receita Marvit
          </h2>
          <p className="text-xs text-espresso-600">
            Análise automática da saúde do seu orçamento mensal.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        {insights.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 ${
              item.tone === 'danger'
                ? 'bg-terracotta-50 border-terracotta-300 text-espresso-900'
                : item.tone === 'warning'
                ? 'bg-oat-100 border-terracotta-200 text-espresso-900'
                : 'bg-maldives-50/70 border-maldives-200 text-espresso-900'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                item.tone === 'danger'
                  ? 'bg-terracotta-200 text-terracotta-700'
                  : item.tone === 'warning'
                  ? 'bg-terracotta-100 text-terracotta-600'
                  : 'bg-maldives-100 text-maldives-700'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-display font-bold text-espresso-900">
                {item.title}
              </h4>
              <p className="text-xs text-espresso-600 mt-1 leading-relaxed">
                {item.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-5 p-4 rounded-2xl bg-oat-100 border border-oat-300 text-xs text-espresso-600 font-display italic text-center">
        “Assim como uma cozinha acolhedora e bem organizada, a liberdade financeira nasce de ingredientes simples: clareza, constância e carinho com o futuro.” — Filosofia Marvit&Finances
      </div>
    </div>
  );
};

