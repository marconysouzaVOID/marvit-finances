import { MarvitBackupData } from '../types';

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
}

export async function pushVaultToCloud(
  vaultId: string,
  pinHash: string,
  payload: MarvitBackupData
): Promise<CloudSyncResponse> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vaultId: vaultId.trim().toLowerCase(),
        pinHash,
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
      // Se estiver rodando localmente via Vite sem Vercel KV configurado, salva no cofre local espelhado
      saveLocalMirrorVault(vaultId, pinHash, payload);
      return {
        ok: true,
        mode: 'local-fallback',
        updatedAt: new Date().toISOString(),
        message:
          'Cofre salvo no armazenamento seguro local (configure Vercel KV na Vercel para nuvem remota).',
      };
    }

    const result = await res.json();
    saveLocalMirrorVault(vaultId, pinHash, payload);
    return {
      ok: true,
      mode: result.mode || 'cloud',
      updatedAt: result.updatedAt || new Date().toISOString(),
      message: result.message || 'Sincronizado com sucesso na nuvem!',
    };
  } catch {
    saveLocalMirrorVault(vaultId, pinHash, payload);
    return {
      ok: true,
      mode: 'local-fallback',
      updatedAt: new Date().toISOString(),
      message: 'Salvo no cofre local deste dispositivo (modo offline).',
    };
  }
}

export async function pullVaultFromCloud(
  vaultId: string,
  pinHash: string
): Promise<CloudSyncResponse> {
  const cleanId = vaultId.trim().toLowerCase();
  try {
    const res = await fetch(
      `/api/sync?vaultId=${encodeURIComponent(cleanId)}&pinHash=${encodeURIComponent(pinHash)}`,
      { method: 'GET' }
    );

    if (res.status === 401) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        message: errJson.error || 'PIN/Senha inválido para este Cofre.',
      };
    }

    if (res.ok) {
      const result = await res.json();
      if (result && 'ok' in result) {
        return {
          ok: true,
          mode: result.mode || 'cloud',
          data: result.data ?? null,
          updatedAt: result.updatedAt,
          message: result.data
            ? 'Dados carregados da nuvem com sucesso!'
            : 'Conectado à nuvem com sucesso!',
        };
      }
    }
  } catch {
    // Fallback para espelho local caso offline ou sem backend ativo
  }

  // Validação offline de segurança para credenciais básicas
  const defaultExpectedHash = await hashPin('marvit', 'Marvit@2026');
  const localResult = loadLocalMirrorVault(cleanId, pinHash);
  if (localResult.status === 'unauthorized') {
    return {
      ok: false,
      message: 'Login ou Senha incorretos.',
    };
  }
  if (localResult.status === 'found' && localResult.data) {
    return {
      ok: true,
      mode: 'local-fallback',
      data: localResult.data,
      updatedAt: localResult.updatedAt,
      message: 'Dados restaurados do cofre seguro local.',
    };
  }

  if (cleanId !== 'marvit' || pinHash !== defaultExpectedHash) {
    return {
      ok: false,
      message: 'Login ou Senha inválidos.',
    };
  }

  return {
    ok: true,
    mode: 'local-fallback',
    data: null,
    message: 'Autenticado! Seus dados atuais serão sincronizados.',
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
): { status: 'found' | 'not_found' | 'unauthorized'; data?: MarvitBackupData; updatedAt?: string } {
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

