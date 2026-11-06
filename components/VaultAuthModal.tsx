import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarvitBackupData, VaultCredentials } from '../types';
import {
  clearBiometricRegistration,
  hasRegisteredBiometrics,
  isBiometricsSupported,
  isRunningAsPwa,
  registerBiometricVault,
  unlockWithBiometrics,
} from '../utils/biometricAuth';
import {
  DEFAULT_VAULT_ID,
  hashPin,
  pullVaultFromCloud,
  pushVaultToCloud,
} from '../utils/cloudSync';

interface VaultAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  vault: VaultCredentials | null;
  onUpdateVault: (vault: VaultCredentials | null) => void;
  currentBackupPayload: MarvitBackupData;
  onRestorePayload: (payload: MarvitBackupData) => void;
}

export const VaultAuthModal: React.FC<VaultAuthModalProps> = ({
  isOpen,
  onClose,
  vault,
  onUpdateVault,
  currentBackupPayload,
  onRestorePayload,
}) => {
  const [vaultIdInput, setVaultIdInput] = useState(
    vault?.vaultId || DEFAULT_VAULT_ID
  );
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [autoSync, setAutoSync] = useState(vault?.autoSync ?? true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    isBiometricsSupported().then(setBiometricAvailable);
    setBiometricRegistered(Boolean(hasRegisteredBiometrics()));
  }, [isOpen]);

  useEffect(() => {
    if (vault) {
      setVaultIdInput(vault.vaultId);
      setAutoSync(vault.autoSync);
    }
  }, [vault]);

  if (!isOpen) return null;

  const handleConnectAndSync = async (direction: 'push' | 'pull') => {
    const cleanVaultId = (vaultIdInput || DEFAULT_VAULT_ID).trim().toLowerCase();

    let finalPinHash = vault?.vaultId === cleanVaultId ? vault.pinHash : '';
    if (pinInput.trim()) {
      finalPinHash = await hashPin(cleanVaultId, pinInput.trim());
    }

    if (!finalPinHash) {
      setStatusMessage({
        text: 'Digite seu PIN de acesso para autenticar o Cofre.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const pwa = isRunningAsPwa();
      let bioNowRegistered = biometricRegistered;

      if (direction === 'pull') {
        const res = await pullVaultFromCloud(cleanVaultId, finalPinHash);
        if (!res.ok) {
          setStatusMessage({
            text: res.message || 'Erro ao acessar cofre.',
            type: 'error',
          });
          setLoading(false);
          return;
        }
        if (res.data) {
          onRestorePayload(res.data);
        }

        if (pwa && biometricAvailable && !biometricRegistered) {
          try {
            await registerBiometricVault(cleanVaultId, finalPinHash);
            bioNowRegistered = true;
            setBiometricRegistered(true);
          } catch {
            // Usuário pode vincular no próximo acesso
          }
        }

        const nextVault: VaultCredentials = {
          vaultId: cleanVaultId,
          pinHash: finalPinHash,
          autoSync: true,
          appLockEnabled: true,
          biometricEnabled: bioNowRegistered,
          lastSyncedAt: res.updatedAt || new Date().toISOString(),
        };
        onUpdateVault(nextVault);
        setPinInput('');
        setStatusMessage({
          text:
            pwa && bioNowRegistered
              ? 'Cofre sincronizado e Biometria ativada automaticamente para o PWA!'
              : res.message || 'Cofre conectado e sincronizado!',
          type: 'success',
        });
      } else {
        const res = await pushVaultToCloud(
          cleanVaultId,
          finalPinHash,
          currentBackupPayload
        );
        if (!res.ok) {
          setStatusMessage({
            text: res.message || 'Falha ao salvar na nuvem.',
            type: 'error',
          });
          setLoading(false);
          return;
        }

        if (pwa && biometricAvailable && !biometricRegistered) {
          try {
            await registerBiometricVault(cleanVaultId, finalPinHash);
            bioNowRegistered = true;
            setBiometricRegistered(true);
          } catch {
            // Usuário pode vincular no próximo acesso
          }
        }

        const nextVault: VaultCredentials = {
          vaultId: cleanVaultId,
          pinHash: finalPinHash,
          autoSync: true,
          appLockEnabled: true,
          biometricEnabled: bioNowRegistered,
          lastSyncedAt: res.updatedAt || new Date().toISOString(),
        };
        onUpdateVault(nextVault);
        setPinInput('');
        setStatusMessage({
          text:
            pwa && bioNowRegistered
              ? 'Dados salvos e Biometria configurada automaticamente para o PWA!'
              : res.message || 'Dados salvos no Cofre com sucesso!',
          type: 'success',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = newPinInput.trim();
    const cleanConfirm = confirmNewPinInput.trim();

    if (!cleanNew || cleanNew.length < 4) {
      setStatusMessage({
        text: 'Escolha um novo PIN com pelo menos 4 caracteres ou dígitos.',
        type: 'error',
      });
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setStatusMessage({
        text: 'A confirmação do novo PIN não confere.',
        type: 'error',
      });
      return;
    }

    const cleanVaultId = (vault?.vaultId || vaultIdInput || DEFAULT_VAULT_ID)
      .trim()
      .toLowerCase();
    let currentPinHash = vault?.pinHash || '';
    if (pinInput.trim()) {
      currentPinHash = await hashPin(cleanVaultId, pinInput.trim());
    }

    if (!currentPinHash) {
      setStatusMessage({
        text: 'Informe seu PIN atual para autorizar a troca.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const nextPinHash = await hashPin(cleanVaultId, cleanNew);
      const res = await pushVaultToCloud(
        cleanVaultId,
        currentPinHash,
        currentBackupPayload,
        nextPinHash
      );

      if (!res.ok) {
        setStatusMessage({
          text: res.message || 'Não foi possível alterar o PIN.',
          type: 'error',
        });
        setLoading(false);
        return;
      }

      // Se a biometria já estiver cadastrada ou se estiver em PWA, atualiza o cofre biométrico com o novo PIN
      let bioEnabled = biometricRegistered;
      if ((isRunningAsPwa() && biometricAvailable) || biometricRegistered) {
        try {
          await registerBiometricVault(cleanVaultId, nextPinHash);
          bioEnabled = true;
          setBiometricRegistered(true);
        } catch {
          // ignore
        }
      }

      const updatedVault: VaultCredentials = {
        vaultId: cleanVaultId,
        pinHash: nextPinHash,
        autoSync,
        appLockEnabled: true,
        biometricEnabled: bioEnabled,
        lastSyncedAt: res.updatedAt || new Date().toISOString(),
      };
      onUpdateVault(updatedVault);
      setNewPinInput('');
      setConfirmNewPinInput('');
      setPinInput('');
      setStatusMessage({
        text: 'Seu PIN de acesso foi alterado e sincronizado com sucesso!',
        type: 'success',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBiometrics = async () => {
    const cleanVaultId =
      vaultIdInput.trim().toLowerCase() || vault?.vaultId || DEFAULT_VAULT_ID;
    let finalPinHash = vault?.pinHash || '';
    if (pinInput.trim() && cleanVaultId) {
      finalPinHash = await hashPin(cleanVaultId, pinInput.trim());
    }

    if (!cleanVaultId || !finalPinHash) {
      setStatusMessage({
        text: 'Autentique seu PIN antes de vincular sua Biometria.',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);
      await registerBiometricVault(cleanVaultId, finalPinHash);
      setBiometricRegistered(true);
      const updatedVault: VaultCredentials = {
        vaultId: cleanVaultId,
        pinHash: finalPinHash,
        autoSync,
        appLockEnabled: true,
        biometricEnabled: true,
        lastSyncedAt: vault?.lastSyncedAt || new Date().toISOString(),
      };
      onUpdateVault(updatedVault);
      setStatusMessage({
        text: 'Biometria (FaceID / TouchID / Digital) vinculada com sucesso!',
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Não foi possível ativar a biometria.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricQuickLogin = async () => {
    try {
      setLoading(true);
      const creds = await unlockWithBiometrics();
      setVaultIdInput(creds.vaultId);
      const res = await pullVaultFromCloud(creds.vaultId, creds.pinHash);
      if (res.ok && res.data) {
        onRestorePayload(res.data);
      }
      onUpdateVault({
        vaultId: creds.vaultId,
        pinHash: creds.pinHash,
        autoSync,
        appLockEnabled: true,
        biometricEnabled: true,
        lastSyncedAt: new Date().toISOString(),
      });
      setStatusMessage({
        text: `Desbloqueado via Biometria! Cofre "${creds.vaultId}" sincronizado.`,
        type: 'success',
      });
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || 'Falha na leitura biométrica.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-900/45 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-oat-50 border-2 border-oat-300 rounded-3xl max-w-lg w-full p-6 shadow-cozy-lg relative overflow-hidden my-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-oat-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-maldives-50 border border-maldives-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-maldives-600 text-2xl">
                  fingerprint
                </span>
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-espresso-900">
                  Cofre Marvit • PIN & Biometria
                </h3>
                <p className="text-xs text-espresso-600">
                  Gerencie seu PIN obrigatório, sincronização na nuvem e Biometria no PWA.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-espresso-500 hover:text-espresso-900 hover:bg-oat-200 transition cursor-pointer"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="space-y-4 mt-5">
            {biometricRegistered && (
              <button
                type="button"
                onClick={handleBiometricQuickLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-maldives-500 to-maldives-600 hover:from-maldives-600 hover:to-maldives-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">
                  fingerprint
                </span>
                <span>Sincronizar Agora com Biometria</span>
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                  Identificador do Cofre
                </label>
                <input
                  type="text"
                  value={vaultIdInput}
                  onChange={(e) => setVaultIdInput(e.target.value)}
                  placeholder="marvit"
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                  PIN Atual
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={vault ? '•••• (autenticado)' : 'PIN (padrão: 2026)'}
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
              </div>
            </div>

            {/* Seção para Alterar o PIN */}
            <form
              onSubmit={handleChangePin}
              className="p-4 rounded-2xl bg-maldives-50/70 border border-maldives-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-maldives-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-maldives-600">
                    passkey
                  </span>
                  Alterar PIN de Acesso da Aplicação
                </span>
                <span className="text-[10px] font-mono text-espresso-500">
                  PIN Inicial Padrão: 2026
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="Novo PIN (mín. 4 dígitos)"
                  className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
                <input
                  type="password"
                  value={confirmNewPinInput}
                  onChange={(e) => setConfirmNewPinInput(e.target.value)}
                  placeholder="Confirmar Novo PIN"
                  className="w-full bg-oat-50 border border-oat-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !newPinInput.trim()}
                className="w-full py-2 px-3 rounded-xl bg-maldives-600 hover:bg-maldives-700 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Salvar Novo PIN na Nuvem
              </button>
            </form>

            {/* Opções de Nuvem e Biometria */}
            <div className="p-3.5 rounded-2xl bg-oat-100 border border-oat-300 space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-semibold text-espresso-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-maldives-600 text-[18px]">
                    cloud_sync
                  </span>
                  Sincronização automática na nuvem ao editar
                </span>
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => {
                    setAutoSync(e.target.checked);
                    if (vault) onUpdateVault({ ...vault, autoSync: e.target.checked });
                  }}
                  className="w-4 h-4 accent-maldives-500 rounded cursor-pointer"
                />
              </label>

              {biometricAvailable && (
                <div className="pt-2 border-t border-oat-200 flex items-center justify-between">
                  <span className="text-xs text-espresso-600">
                    {biometricRegistered
                      ? '✅ Biometria ativa para desbloqueio rápido no PWA'
                      : 'No PWA, a biometria é ativada automaticamente no login'}
                  </span>
                  {biometricRegistered ? (
                    <button
                      type="button"
                      onClick={() => {
                        clearBiometricRegistration();
                        setBiometricRegistered(false);
                      }}
                      className="text-xs font-bold text-terracotta-600 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRegisterBiometrics}
                      className="px-3 py-1 rounded-xl bg-maldives-100 text-maldives-800 border border-maldives-300 text-xs font-bold hover:bg-maldives-200 transition cursor-pointer"
                    >
                      Vincular Biometria
                    </button>
                  )}
                </div>
              )}
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold border ${
                  statusMessage.type === 'success'
                    ? 'bg-maldives-50 border-maldives-300 text-maldives-800'
                    : statusMessage.type === 'error'
                    ? 'bg-terracotta-50 border-terracotta-300 text-terracotta-700'
                    : 'bg-oat-100 border-oat-300 text-espresso-700'
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleConnectAndSync('push')}
                className="py-2.5 px-4 rounded-2xl bg-maldives-500 hover:bg-maldives-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  cloud_upload
                </span>
                <span>Salvar Dados na Nuvem</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleConnectAndSync('pull')}
                className="py-2.5 px-4 rounded-2xl bg-oat-200 hover:bg-oat-300 text-espresso-900 border border-oat-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  cloud_download
                </span>
                <span>Carregar Dados da Nuvem</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
