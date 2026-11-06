// Vercel Serverless Function (/api/sync)
// Sistema de PIN obrigatório desde o 1º acesso (PIN padrão inicial: "2026")
// Permite alterar o PIN após o primeiro acesso e sincroniza automaticamente na nuvem.

import crypto from 'crypto';

interface StoredVaultRecord {
  pinHash: string;
  updatedAt: string;
  data: unknown;
}

const memoryStore = new Map<string, StoredVaultRecord>();

export const DEFAULT_VAULT_ID = 'marvit';
export const DEFAULT_INITIAL_PIN = '2026';

function computePinHashServer(vaultId: string, pin: string): string {
  const normalized = `${vaultId.trim().toLowerCase()}::${pin.trim()}::marvit_salt_v2`;
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function getEnv(): Record<string, string | undefined> {
  return (
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
      .process?.env || {}
  );
}

function getRedisCredentials(): { url: string; token: string } | null {
  const env = getEnv();
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/$/, ''), token };
  }
  return null;
}

function getGitHubVaultCredentials(): { token: string; repo: string } | null {
  const env = getEnv();
  const token = env.GITHUB_VAULT_TOKEN || env.GITHUB_TOKEN;
  const repo = env.GITHUB_VAULT_REPO || 'marconysouzaVOID/marvit-finances';
  if (token) {
    return { token, repo };
  }
  return null;
}

async function githubGet(vaultId: string): Promise<StoredVaultRecord | null> {
  const gh = getGitHubVaultCredentials();
  if (!gh) return null;

  const filePath = `.vault/${encodeURIComponent(vaultId)}.json`;
  const url = `https://api.github.com/repos/${gh.repo}/contents/${filePath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${gh.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Marvit-Finances-CloudSync',
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { content?: string };
  if (!json.content) return null;
  try {
    const decoded = Buffer.from(json.content, 'base64').toString('utf-8');
    return JSON.parse(decoded) as StoredVaultRecord;
  } catch {
    return null;
  }
}

async function githubSet(vaultId: string, value: StoredVaultRecord): Promise<boolean> {
  const gh = getGitHubVaultCredentials();
  if (!gh) return false;

  const filePath = `.vault/${encodeURIComponent(vaultId)}.json`;
  const url = `https://api.github.com/repos/${gh.repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${gh.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Marvit-Finances-CloudSync',
  };

  let sha: string | undefined;
  const checkRes = await fetch(url, { headers });
  if (checkRes.ok) {
    const existingFile = (await checkRes.json()) as { sha?: string };
    sha = existingFile.sha;
  }

  const contentBase64 = Buffer.from(JSON.stringify(value, null, 2), 'utf-8').toString(
    'base64'
  );

  const putRes = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `chore(vault): sync vault ${vaultId}`,
      content: contentBase64,
      ...(sha ? { sha } : {}),
    }),
  });

  return putRes.ok;
}

async function storageGet(vaultId: string): Promise<StoredVaultRecord | null> {
  const key = `marvit:vault:${vaultId}`;
  const creds = getRedisCredentials();
  if (creds) {
    const response = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    if (response.ok) {
      const json = (await response.json()) as { result?: string | null };
      if (json.result) {
        try {
          return JSON.parse(json.result) as StoredVaultRecord;
        } catch {
          // continua para fallback
        }
      }
    }
  }

  const ghRecord = await githubGet(vaultId);
  if (ghRecord) return ghRecord;

  return memoryStore.get(key) || null;
}

async function storageSet(
  vaultId: string,
  value: StoredVaultRecord
): Promise<'cloud' | 'local-fallback'> {
  const key = `marvit:vault:${vaultId}`;
  const creds = getRedisCredentials();
  if (creds) {
    const response = await fetch(`${creds.url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(value),
    });

    if (response.ok) {
      return 'cloud';
    }
  }

  const savedOnGithub = await githubSet(vaultId, value);
  if (savedOnGithub) {
    return 'cloud';
  }

  memoryStore.set(key, value);
  return 'local-fallback';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasCloudDriver = Boolean(getRedisCredentials() || getGitHubVaultCredentials());

  try {
    if (req.method === 'GET') {
      const vaultId = String(req.query?.vaultId || DEFAULT_VAULT_ID)
        .trim()
        .toLowerCase();
      const pinHash = String(req.query?.pinHash || '').trim();

      if (!vaultId || !pinHash) {
        return res.status(400).json({ error: 'Informe o PIN de acesso.' });
      }

      const existing = await storageGet(vaultId);
      const defaultHash = computePinHashServer(vaultId, DEFAULT_INITIAL_PIN);

      // Se o cofre ainda não existe na nuvem, aceita apenas o PIN padrão ("2026") no primeiro acesso do cofre padrão
      if (!existing) {
        if (vaultId === DEFAULT_VAULT_ID && pinHash !== defaultHash) {
          return res.status(401).json({
            error: 'PIN incorreto. No primeiro acesso, utilize o PIN padrão (2026).',
          });
        }
        return res.status(200).json({
          ok: true,
          data: null,
          isDefaultPin: pinHash === defaultHash,
          mode: hasCloudDriver ? 'cloud' : 'local-fallback',
        });
      }

      if (existing.pinHash !== pinHash) {
        return res.status(401).json({
          error: 'PIN incorreto. Tente novamente.',
        });
      }

      return res.status(200).json({
        ok: true,
        data: existing.data,
        updatedAt: existing.updatedAt,
        isDefaultPin: existing.pinHash === defaultHash,
        mode: hasCloudDriver ? 'cloud' : 'local-fallback',
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const vaultId = String(body?.vaultId || DEFAULT_VAULT_ID)
        .trim()
        .toLowerCase();
      const pinHash = String(body?.pinHash || '').trim();
      const newPinHash = body?.newPinHash ? String(body.newPinHash).trim() : '';
      const payload = body?.payload;

      if (!vaultId || !pinHash || !payload) {
        return res.status(400).json({ error: 'Dados incompletos para sincronização.' });
      }

      const existing = await storageGet(vaultId);
      const defaultHash = computePinHashServer(vaultId, DEFAULT_INITIAL_PIN);

      if (existing && existing.pinHash !== pinHash) {
        return res.status(401).json({
          error: 'PIN atual incorreto para este Cofre.',
        });
      }

      if (!existing && vaultId === DEFAULT_VAULT_ID && pinHash !== defaultHash && !newPinHash) {
        return res.status(401).json({
          error: 'PIN incorreto.',
        });
      }

      const finalPinHashToStore = newPinHash || pinHash;
      const updatedAt = new Date().toISOString();
      const mode = await storageSet(vaultId, {
        pinHash: finalPinHashToStore,
        updatedAt,
        data: payload,
      });

      return res.status(200).json({
        ok: true,
        mode,
        updatedAt,
        isDefaultPin: finalPinHashToStore === defaultHash,
        message: newPinHash
          ? 'Novo PIN salvo e sincronizado na nuvem com sucesso!'
          : mode === 'cloud'
          ? 'Sincronizado permanentemente na nuvem!'
          : 'Sincronizado na sessão.',
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Erro interno no servidor de sincronização.',
    });
  }
}
