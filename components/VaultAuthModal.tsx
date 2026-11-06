import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarvitBackupData, VaultCredentials } from '../types';
import {
  clearBiometricRegistration,
  hasRegisteredBiometrics,
  isBiometricsSupported,
  registerBiometricVault,
  unlockWithBiometrics,
} from '../utils/biometricAuth';
import { hashPin, pullVaultFromCloud, pushVaultToCloud } from '../utils/cloudSync';

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
  const [vaultIdInput, setVaultIdInput] = useState(vault?.vaultId || '');
  const [pinInput, setPinInput] = useState('');
  const [autoSync, setAutoSync] = useState(vault?.autoSync ?? true);
  const [appLockEnabled, setAppLockEnabled] = useState(vault?.appLockEnabled ?? false);
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
      setAppLockEnabled(vault.appLockEnabled);
    }
  }, [vault]);

  if (!isOpen) return null;

  const handleConnectAndSync = async (direction: 'push' | 'pull') => {
    const cleanVaultId = vaultIdInput.trim().toLowerCase();
    if (!cleanVaultId) {
      setStatusMessage({
        text: 'Escolha um nome para o seu Cofre (ex: familia-marvit).',
        type: 'error',
      });
      return;
    }

    let finalPinHash = vault?.vaultId === cleanVaultId ? vault.pinHash : '';
    if (pinInput.trim()) {
      finalPinHash = await hashPin(cleanVaultId, pinInput.trim());
    }

    if (!finalPinHash) {
      setStatusMessage({
        text: 'Digite seu PIN ou Senha secreta para autenticar o Cofre.',
        type: 'error',
      });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      if (direction === 'pull') {
        const res = await pullVaultFromCloud(cleanVaultId, finalPinHash);
        if (!res.ok) {
          setStatusMessage({ text: res.message || 'Erro ao acessar cofre.', type: 'error' });
          setLoading(false);
          return;
        }
        if (res.data) {
          onRestorePayload(res.data);
        }
        const nextVault: VaultCredentials = {
          vaultId: cleanVaultId,
          pinHash: finalPinHash,
          autoSync,
          appLockEnabled,
          biometricEnabled: biometricRegistered,
          lastSyncedAt: res.updatedAt || new Date().toISOString(),
        };
        onUpdateVault(nextVault);
        setPinInput('');
        setStatusMessage({
          text: res.message || 'Cofre conectado e sincronizado!',
          type: 'success',
        });
      } else {
        const res = await pushVaultToCloud(cleanVaultId, finalPinHash, currentBackupPayload);
        if (!res.ok) {
          setStatusMessage({ text: res.message || 'Falha ao salvar na nuvem.', type: 'error' });
          setLoading(false);
          return;
        }
        const nextVault: VaultCredentials = {
          vaultId: cleanVaultId,
          pinHash: finalPinHash,
          autoSync,
          appLockEnabled,
          biometricEnabled: biometricRegistered,
          lastSyncedAt: res.updatedAt || new Date().toISOString(),
        };
        onUpdateVault(nextVault);
        setPinInput('');
        setStatusMessage({
          text: res.message || 'Dados salvos no Cofre com sucesso!',
          type: 'success',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBiometrics = async () => {
    const cleanVaultId = vaultIdInput.trim().toLowerCase() || vault?.vaultId || '';
    let finalPinHash = vault?.pinHash || '';
    if (pinInput.trim() && cleanVaultId) {
      finalPinHash = await hashPin(cleanVaultId, pinInput.trim());
    }

    if (!cleanVaultId || !finalPinHash) {
      setStatusMessage({
        text: 'Informe o Nome do Cofre e o PIN antes de vincular sua Biometria.',
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
        appLockEnabled,
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
        appLockEnabled,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-900/45 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-oat-50 border-2 border-oat-300 rounded-3xl max-w-lg w-full p-6 shadow-cozy-lg relative overflow-hidden"
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
                  Cofre Marvit • Nuvem & Biometria
                </h3>
                <p className="text-xs text-espresso-600">
                  Sincronize seus dados entre PC e PWA no celular via PIN ou FaceID/Digital.
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
                <span>Entrar e Sincronizar com Biometria (FaceID / Digital)</span>
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
                  placeholder="Ex: casa-marco"
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-espresso-700 mb-1 block">
                  PIN / Senha Secreta
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={vault ? '•••••• (já autenticado)' : 'Digite seu PIN'}
                  className="w-full bg-oat-100 border border-oat-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-espresso-900 focus:outline-none focus:border-maldives-500"
                />
              </div>
            </div>

            {/* Opções de Segurança e Biometria */}
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

              <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-oat-200">
                <span className="text-xs font-semibold text-espresso-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-terracotta-600 text-[18px]">
                    lock
                  </span>
                  Exigir Biometria / PIN ao abrir o aplicativo (App Lock)
                </span>
                <input
                  type="checkbox"
                  checked={appLockEnabled}
                  onChange={(e) => {
                    setAppLockEnabled(e.target.checked);
                    if (vault)
                      onUpdateVault({ ...vault, appLockEnabled: e.target.checked });
                  }}
                  className="w-4 h-4 accent-maldives-500 rounded cursor-pointer"
                />
              </label>

              {biometricAvailable && (
                <div className="pt-2 border-t border-oat-200 flex items-center justify-between">
                  <span className="text-xs text-espresso-600">
                    {biometricRegistered
                      ? '✅ FaceID / Impressão Digital ativa neste aparelho'
                      : 'Ative a biometria para entrar sem digitar PIN'}
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
                      Cadastrar Biometria
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
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

            {vault && (
              <div className="flex items-center justify-between text-[11px] text-espresso-500 pt-2 border-t border-oat-200">
                <span>
                  Conectado ao cofre: <strong className="text-espresso-800">{vault.vaultId}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateVault(null);
                    setStatusMessage({ text: 'Cofre desconectado.', type: 'info' });
                  }}
                  className="text-terracotta-600 hover:underline font-semibold cursor-pointer"
                >
                  Desconectar
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

