import { MarvitBackupData } from '../types';

export const DEFAULT_VAULT_ID = 'marvit';
export const DEFAULT_INITIAL_PIN = '2026';

export async function hashPin(_vaultId: string, pin: string): Promise<string> {
  // Acesso geral único: sempre usa a chave global "marvit" para garantir paridade total entre PC e Celular
  const normalized = `${DEFAULT_VAULT_ID}::${pin.trim()}::marvit_salt_v2`;
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
  _vaultId: string,
  pinHash: string,
  payload: MarvitBackupData,
  newPinHash?: string
): Promise<CloudSyncResponse> {
  const effectiveStoredHash = newPinHash || pinHash;

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vaultId: DEFAULT_VAULT_ID,
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
          message: errJson.error || 'PIN incorreto.',
        };
      }
      saveLocalMirrorVault(effectiveStoredHash, payload);
      return {
        ok: true,
        mode: 'local-fallback',
        updatedAt: new Date().toISOString(),
        message: newPinHash
          ? 'Novo PIN salvo no dispositivo!'
          : 'Dados salvos no armazenamento local seguro.',
      };
    }

    const result = await res.json();
    saveLocalMirrorVault(effectiveStoredHash, payload);
    return {
      ok: true,
      mode: result.mode || 'cloud',
      updatedAt: result.updatedAt || new Date().toISOString(),
      isDefaultPin: result.isDefaultPin,
      message:
        result.message ||
        (newPinHash
          ? 'Novo PIN geral salvo com sucesso!'
          : 'Sincronizado com sucesso entre PC e Celular!'),
    };
  } catch {
    saveLocalMirrorVault(effectiveStoredHash, payload);
    return {
      ok: true,
      mode: 'local-fallback',
      updatedAt: new Date().toISOString(),
      message: newPinHash
        ? 'Novo PIN salvo localmente!'
        : 'Salvo no cofre local deste dispositivo (modo offline).',
    };
  }
}

export async function pullVaultFromCloud(
  _vaultId: string,
  pinHash: string
): Promise<CloudSyncResponse> {
  const defaultHash = await hashPin(DEFAULT_VAULT_ID, DEFAULT_INITIAL_PIN);

  try {
    const res = await fetch(
      `/api/sync?vaultId=${DEFAULT_VAULT_ID}&pinHash=${encodeURIComponent(pinHash)}&t=${Date.now()}`,
      { method: 'GET', cache: 'no-store' }
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
          saveLocalMirrorVault(pinHash, result.data);
        }
        return {
          ok: true,
          mode: result.mode || 'cloud',
          data: result.data ?? null,
          updatedAt: result.updatedAt,
          isDefaultPin: result.isDefaultPin ?? pinHash === defaultHash,
          message: result.data
            ? 'Finanças sincronizadas da nuvem!'
            : 'Primeiro acesso autenticado com sucesso!',
        };
      }
    }
  } catch {
    // Fallback para espelho local caso offline ou sem backend ativo
  }

  const localResult = loadLocalMirrorVault(pinHash);
  if (localResult.status === 'unauthorized') {
    return {
      ok: false,
      message: 'PIN incorreto.',
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

  if (pinHash !== defaultHash) {
    return {
      ok: false,
      message: 'PIN incorreto. No primeiro acesso, utilize o PIN padrão: 2026.',
    };
  }

  return {
    ok: true,
    mode: 'local-fallback',
    data: null,
    isDefaultPin: true,
    message: 'Acesso liberado!',
  };
}

function saveLocalMirrorVault(pinHash: string, data: MarvitBackupData): void {
  const key = `marvit_vault_mirror_${DEFAULT_VAULT_ID}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      pinHash,
      updatedAt: new Date().toISOString(),
      data,
    })
  );
}

function loadLocalMirrorVault(pinHash: string): {
  status: 'found' | 'not_found' | 'unauthorized';
  data?: MarvitBackupData;
  updatedAt?: string;
} {
  const key = `marvit_vault_mirror_${DEFAULT_VAULT_ID}`;
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
