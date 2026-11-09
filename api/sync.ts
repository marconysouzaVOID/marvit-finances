// Vercel Serverless Function (/api/sync)
// Acesso Geral Unificado (PC & Celular compartilham sempre o mesmo cofre global "marvit")
// Exige o PIN obrigatoriamente desde o 1º acesso (PIN padrão inicial: "2026")

import crypto from 'crypto';

interface StoredVaultRecord {
  pinHash: string;
  updatedAt: string;
  data: unknown;
}

const memoryStore = new Map<string, StoredVaultRecord>();

export const GLOBAL_VAULT_ID = 'marvit';
export const DEFAULT_INITIAL_PIN = '2026';

function computePinHashServer(pin: string): string {
  const normalized = `${GLOBAL_VAULT_ID}::${pin.trim()}::marvit_salt_v2`;
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
  const url = `https://api.github.com/repos/${gh.repo}/contents/${filePath}?t=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${gh.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Marvit-Finances-CloudSync',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
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
  const baseUrl = `https://api.github.com/repos/${gh.repo}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${gh.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Marvit-Finances-CloudSync',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  const contentBase64 = Buffer.from(JSON.stringify(value, null, 2), 'utf-8').toString(
    'base64'
  );

  // Tenta até 3 vezes caso haja conflito de SHA (409/422) em edições rápidas seguidas
  for (let attempt = 0; attempt < 3; attempt++) {
    let sha: string | undefined;
    const checkRes = await fetch(`${baseUrl}?t=${Date.now()}`, { headers });
    if (checkRes.ok) {
      const existingFile = (await checkRes.json()) as { sha?: string };
      sha = existingFile.sha;
    }

    const putRes = await fetch(baseUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `chore(vault): sync global marvit finance state`,
        content: contentBase64,
        ...(sha ? { sha } : {}),
      }),
    });

    if (putRes.ok) {
      return true;
    }

    if (putRes.status !== 409 && putRes.status !== 422) {
      break;
    }
  }

  return false;
}

async function storageGet(): Promise<StoredVaultRecord | null> {
  const key = `marvit:vault:${GLOBAL_VAULT_ID}`;
  const memRecord = memoryStore.get(key) || null;
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

  const ghRecord = await githubGet(GLOBAL_VAULT_ID);
  if (ghRecord && memRecord) {
    const ghTime = new Date(ghRecord.updatedAt || 0).getTime() || 0;
    const memTime = new Date(memRecord.updatedAt || 0).getTime() || 0;
    return memTime > ghTime ? memRecord : ghRecord;
  }

  return ghRecord || memRecord;
}

async function storageSet(
  value: StoredVaultRecord
): Promise<'cloud' | 'local-fallback'> {
  const key = `marvit:vault:${GLOBAL_VAULT_ID}`;
  memoryStore.set(key, value);

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

  const savedOnGithub = await githubSet(GLOBAL_VAULT_ID, value);
  if (savedOnGithub) {
    return 'cloud';
  }

  return 'local-fallback';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasCloudDriver = Boolean(getRedisCredentials() || getGitHubVaultCredentials());
  const defaultHash = computePinHashServer(DEFAULT_INITIAL_PIN);

  try {
    if (req.method === 'GET') {
      const pinHash = String(req.query?.pinHash || '').trim();

      if (!pinHash) {
        return res.status(400).json({ error: 'Informe o PIN de acesso.' });
      }

      const existing = await storageGet();

      if (!existing) {
        if (pinHash !== defaultHash) {
          return res.status(401).json({
            error: 'PIN incorreto. No primeiro acesso, utilize o PIN padrão: 2026.',
          });
        }
        return res.status(200).json({
          ok: true,
          data: null,
          isDefaultPin: true,
          mode: hasCloudDriver ? 'cloud' : 'local-fallback',
        });
      }

      if (existing.pinHash !== pinHash) {
        return res.status(401).json({
          error: 'PIN incorreto. Digite o PIN configurado na sua conta geral.',
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
      const pinHash = String(body?.pinHash || '').trim();
      const newPinHash = body?.newPinHash ? String(body.newPinHash).trim() : '';
      const payload = body?.payload;

      if (!pinHash || !payload) {
        return res.status(400).json({ error: 'Dados incompletos para sincronização.' });
      }

      const existing = await storageGet();

      if (existing && existing.pinHash !== pinHash) {
        return res.status(401).json({
          error: 'PIN atual incorreto.',
        });
      }

      if (!existing && pinHash !== defaultHash && !newPinHash) {
        return res.status(401).json({
          error: 'PIN incorreto.',
        });
      }

      const finalPinHashToStore = newPinHash || pinHash;
      const updatedAt = new Date().toISOString();
      const mode = await storageSet({
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
          ? 'Novo PIN geral salvo! Ele já vale tanto no computador quanto no celular.'
          : mode === 'cloud'
          ? 'Sincronizado na conta geral (PC & Celular)!'
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
