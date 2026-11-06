import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MarvitBackupData, VaultCredentials } from '../types';
import {
  hasRegisteredBiometrics,
  isBiometricsSupported,
  isRunningAsPwa,
  registerBiometricVault,
  unlockWithBiometrics,
} from '../utils/biometricAuth';
import { hashPin, pullVaultFromCloud } from '../utils/cloudSync';
import { InteractiveAsset } from './InteractiveAsset';

interface AuthLoginScreenProps {
  onAuthenticated: (
    session: VaultCredentials,
    cloudData?: MarvitBackupData | null,
    justLoggedInWithPassword?: boolean
  ) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const AuthLoginScreen: React.FC<AuthLoginScreenProps> = ({
  onAuthenticated,
  isDark,
  onToggleTheme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPwa, setIsPwa] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [savedBioRecord, setSavedBioRecord] = useState<{
    vaultId: string;
    pinHash: string;
  } | null>(null);
  const [showPasswordFormInPwa, setShowPasswordFormInPwa] = useState(false);

  useEffect(() => {
    const pwaMode = isRunningAsPwa();
    setIsPwa(pwaMode);

    isBiometricsSupported().then((supported) => {
      setBioSupported(supported);
      const existing = hasRegisteredBiometrics();
      if (existing) {
        setSavedBioRecord(existing);
        setUsername(existing.vaultId);
        // Se estiver rodando como PWA e já tiver biometria salva, dispara a validação biométrica automaticamente
        if (pwaMode && supported) {
          handleBiometricAccess(existing.vaultId, existing.pinHash, true);
        }
      }
    });
  }, []);

  const handleBiometricAccess = async (
    targetVaultId?: string,
    targetPinHash?: string,
    silentIfCanceled = false
  ) => {
    try {
      setLoading(true);
      setError('');
      const unlocked = await unlockWithBiometrics();
      const vId = targetVaultId || unlocked.vaultId;
      const pHash = targetPinHash || unlocked.pinHash;

      const cloudRes = await pullVaultFromCloud(vId, pHash);
      if (!cloudRes.ok) {
        setError(cloudRes.message || 'Não foi possível validar suas credenciais.');
        setShowPasswordFormInPwa(true);
        return;
      }

      onAuthenticated(
        {
          vaultId: vId,
          pinHash: pHash,
          autoSync: true,
          appLockEnabled: true,
          biometricEnabled: true,
          lastSyncedAt: cloudRes.updatedAt || new Date().toISOString(),
        },
        cloudRes.data,
        false
      );
    } catch (err: any) {
      if (!silentIfCanceled) {
        setError(
          err?.message ||
            'Validação biométrica não concluída. Tente novamente ou use Login e Senha.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Preencha seu Login e Senha para entrar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const pHash = await hashPin(cleanUser, cleanPass);
      const cloudRes = await pullVaultFromCloud(cleanUser, pHash);

      if (!cloudRes.ok) {
        setError(cloudRes.message || 'Login ou Senha incorretos.');
        setLoading(false);
        return;
      }

      // Se estiver no PWA e o aparelho suportar biometria, registra/atualiza automaticamente o cofre biométrico!
      let bioEnabled = Boolean(savedBioRecord);
      if (isPwa && bioSupported) {
        try {
          await registerBiometricVault(cleanUser, pHash);
          bioEnabled = true;
        } catch {
          // Caso o usuário pule o prompt nativo agora, poderá ativar no próximo acesso
        }
      }

      onAuthenticated(
        {
          vaultId: cleanUser,
          pinHash: pHash,
          autoSync: true,
          appLockEnabled: isPwa,
          biometricEnabled: bioEnabled,
          lastSyncedAt: cloudRes.updatedAt || new Date().toISOString(),
        },
        cloudRes.data,
        true
      );
    } catch (err: any) {
      setError(err?.message || 'Erro ao autenticar junto ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  const showBiometricOnlyCard =
    isPwa && bioSupported && Boolean(savedBioRecord) && !showPasswordFormInPwa;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-oat-100 relative overflow-hidden">
      {/* Botão de Tema Claro / Escuro no canto superior direito */}
      <div className="fixed top-4 right-4 z-30">
        <button
          type="button"
          onClick={onToggleTheme}
          className="px-3.5 py-2 rounded-2xl bg-oat-50 border border-oat-300 text-espresso-800 text-xs font-bold flex items-center gap-2 shadow-cozy hover:border-maldives-500 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-maldives-600">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
          <span>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35 }}
        className="bg-oat-50/95 border-2 border-oat-300 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-cozy-lg relative z-10"
      >
        <div className="flex flex-col items-center text-center">
          <InteractiveAsset
            src="/assets/marvit-logo.png"
            alt="Marvit&Finances Logo"
            size="xl"
            tone="maldives"
          />

          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-espresso-900 mt-4">
            Marvit<span className="text-maldives-600">&</span>Finances
          </h1>
          <p className="text-xs sm:text-sm text-espresso-600 mt-1">
            Planejamento familiar, Potes dos Sonhos e Liberdade Financeira
          </p>

          {isPwa && (
            <span className="mt-2.5 text-[11px] font-bold px-3 py-0.5 rounded-full bg-maldives-100 text-maldives-800 border border-maldives-300 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">
                verified_user
              </span>
              <span>Modo Aplicativo PWA • Biometria Automática</span>
            </span>
          )}
        </div>

        {showBiometricOnlyCard ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="p-4 rounded-2xl bg-maldives-50 border border-maldives-200">
              <p className="text-xs text-espresso-700">
                Bem-vindo de volta,{' '}
                <strong className="text-maldives-700 font-mono">
                  {savedBioRecord?.vaultId}
                </strong>
                ! Use sua biometria para entrar instantaneamente.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                handleBiometricAccess(
                  savedBioRecord?.vaultId,
                  savedBioRecord?.pinHash,
                  false
                )
              }
              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-maldives-500 to-maldives-600 hover:from-maldives-600 hover:to-maldives-700 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl">
                fingerprint
              </span>
              <span>
                {loading
                  ? 'Validando Biometria...'
                  : 'Entrar com Biometria (FaceID / Digital)'}
              </span>
            </button>

            {error && (
              <div className="p-3 rounded-xl bg-terracotta-50 border border-terracotta-300 text-xs font-semibold text-terracotta-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPasswordFormInPwa(true)}
              className="text-xs font-bold text-espresso-600 hover:text-maldives-600 underline cursor-pointer pt-1"
            >
              Prefiro entrar com Login e Senha
            </button>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-espresso-700 mb-1.5 block">
                Login / Usuário
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-espresso-400 text-[20px]">
                  person
                </span>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário (ex: marvit)"
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl py-2.5 pl-11 pr-3.5 text-sm font-semibold text-espresso-900 focus:outline-none focus:border-maldives-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-espresso-700 mb-1.5 block">
                Senha de Acesso
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-espresso-400 text-[20px]">
                  key
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl py-2.5 pl-11 pr-3.5 text-sm font-semibold text-espresso-900 focus:outline-none focus:border-maldives-500 transition"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-terracotta-50 border border-terracotta-300 text-xs font-semibold text-terracotta-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-2xl bg-maldives-500 hover:bg-maldives-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                login
              </span>
              <span>{loading ? 'Autenticando na Vercel...' : 'Entrar no Marvit&Finances'}</span>
            </button>

            {isPwa && bioSupported && savedBioRecord && (
              <button
                type="button"
                onClick={() => setShowPasswordFormInPwa(false)}
                className="w-full py-2.5 rounded-xl bg-oat-200 hover:bg-oat-300 text-espresso-800 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-maldives-600">
                  fingerprint
                </span>
                <span>Voltar para Desbloqueio Biométrico</span>
              </button>
            )}

            <p className="text-[11px] text-espresso-500 text-center leading-relaxed pt-1">
              {isPwa
                ? 'Ao entrar pela primeira vez no PWA, sua biometria será vinculada automaticamente para os próximos acessos.'
                : 'Seus dados orçamentários são sincronizados automaticamente na nuvem ao fazer login.'}
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
};
