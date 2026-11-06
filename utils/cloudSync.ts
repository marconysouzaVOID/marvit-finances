import { MarvitBackupData } from '../types';

export const DEFAULT_VAULT_ID = 'marvit';
export const DEFAULT_INITIAL_PIN = '2026';

export async function hashPin(vaultId: string, pin: string): Promise<string> {
  const normalized = `${vaultId.trim().toLowerCase()}::${pin.trim()}::marvit_salt_v2`;
  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CloudSyncResponse {
  ok: boolean;
  mode?: 'cloud' | 'local-fallback';
  message?: string;
  data?: MarvitBackupData | null;
  updatedAt?: string;
  isDefaultPin?: boolean;
}

export async function pushVaultToCloud(
  vaultId: string,
  pinHash: string,
  payload: MarvitBackupData,
  newPinHash?: string
): Promise<CloudSyncResponse> {
  const cleanId = (vaultId || DEFAULT_VAULT_ID).trim().toLowerCase();
  const effectiveStoredHash = newPinHash || pinHash;

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vaultId: cleanId,
        pinHash,
        ...(newPinHash ? { newPinHash } : {}),
        payload,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      if (res.status === 401) {
        return {
          ok: false,
          message: errJson.error || 'PIN incorreto para este Cofre na nuvem.',
        };
      }
      saveLocalMirrorVault(cleanId, effectiveStoredHash, payload);
      return {
        ok: true,
        mode: 'local-fallback',
        updatedAt: new Date().toISOString(),
        message: newPinHash
          ? 'Novo PIN salvo no dispositivo!'
          : 'Cofre salvo no armazenamento seguro local.',
      };
    }

    const result = await res.json();
    saveLocalMirrorVault(cleanId, effectiveStoredHash, payload);
    return {
      ok: true,
      mode: result.mode || 'cloud',
      updatedAt: result.updatedAt || new Date().toISOString(),
      isDefaultPin: result.isDefaultPin,
      message:
        result.message ||
        (newPinHash
          ? 'Novo PIN salvo com sucesso!'
          : 'Sincronizado com sucesso na nuvem!'),
    };
  } catch {
    saveLocalMirrorVault(cleanId, effectiveStoredHash, payload);
    return {
      ok: true,
      mode: 'local-fallback',
      updatedAt: new Date().toISOString(),
      message: newPinHash
        ? 'Novo PIN salvo no cofre local!'
        : 'Salvo no cofre local deste dispositivo (modo offline).',
    };
  }
}

export async function pullVaultFromCloud(
  vaultId: string,
  pinHash: string
): Promise<CloudSyncResponse> {
  const cleanId = (vaultId || DEFAULT_VAULT_ID).trim().toLowerCase();
  const defaultHash = await hashPin(cleanId, DEFAULT_INITIAL_PIN);

  try {
    const res = await fetch(
      `/api/sync?vaultId=${encodeURIComponent(cleanId)}&pinHash=${encodeURIComponent(pinHash)}`,
      { method: 'GET' }
    );

    if (res.status === 401) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        message: errJson.error || 'PIN incorreto. Tente novamente.',
      };
    }

    if (res.ok) {
      const result = await res.json();
      if (result && 'ok' in result) {
        if (result.data) {
          saveLocalMirrorVault(cleanId, pinHash, result.data);
        }
        return {
          ok: true,
          mode: result.mode || 'cloud',
          data: result.data ?? null,
          updatedAt: result.updatedAt,
          isDefaultPin: result.isDefaultPin ?? pinHash === defaultHash,
          message: result.data
            ? 'Dados carregados da nuvem com sucesso!'
            : 'Primeiro acesso autenticado com sucesso!',
        };
      }
    }
  } catch {
    // Fallback para espelho local caso offline ou sem backend ativo
  }

  const localResult = loadLocalMirrorVault(cleanId, pinHash);
  if (localResult.status === 'unauthorized') {
    return {
      ok: false,
      message: 'PIN incorreto para o cofre salvo neste dispositivo.',
    };
  }
  if (localResult.status === 'found' && localResult.data) {
    return {
      ok: true,
      mode: 'local-fallback',
      data: localResult.data,
      updatedAt: localResult.updatedAt,
      isDefaultPin: pinHash === defaultHash,
      message: 'Dados restaurados do cofre seguro local.',
    };
  }

  if (cleanId === DEFAULT_VAULT_ID && pinHash !== defaultHash) {
    return {
      ok: false,
      message: 'PIN incorreto. No primeiro acesso, utilize o PIN padrão: 2026.',
    };
  }

  return {
    ok: true,
    mode: 'local-fallback',
    data: null,
    isDefaultPin: pinHash === defaultHash,
    message: 'Acesso liberado!',
  };
}

function saveLocalMirrorVault(
  vaultId: string,
  pinHash: string,
  data: MarvitBackupData
): void {
  const key = `marvit_vault_mirror_${vaultId.trim().toLowerCase()}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      pinHash,
      updatedAt: new Date().toISOString(),
      data,
    })
  );
}

function loadLocalMirrorVault(
  vaultId: string,
  pinHash: string
): {
  status: 'found' | 'not_found' | 'unauthorized';
  data?: MarvitBackupData;
  updatedAt?: string;
} {
  const key = `marvit_vault_mirror_${vaultId.trim().toLowerCase()}`;
  const raw = localStorage.getItem(key);
  if (!raw) return { status: 'not_found' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed.pinHash && parsed.pinHash !== pinHash) {
      return { status: 'unauthorized' };
    }
    return {
      status: 'found',
      data: parsed.data,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return { status: 'not_found' };
  }
}
