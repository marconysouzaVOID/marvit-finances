// Vercel Serverless Function (/api/sync)
// Autenticação básica + Cofre Automático na Nuvem
// Variáveis de ambiente suportadas na Vercel:
// - MARVIT_AUTH_USER (padrão: "marvit")
// - MARVIT_AUTH_PASS (padrão: "Marvit@2026")
// - GITHUB_VAULT_TOKEN + GITHUB_VAULT_REPO ("marconysouzaVOID/marvit-finances")
// - KV_REST_API_URL + KV_REST_API_TOKEN (opcional)

import crypto from 'crypto';

interface StoredVaultRecord {
  pinHash: string;
  updatedAt: string;
  data: unknown;
}

const memoryStore = new Map<string, StoredVaultRecord>();

function getEnv(): Record<string, string | undefined> {
  return (
    (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
      .process?.env || {}
  );
}

function getExpectedAuth(): { user: string; pinHash: string } {
  const env = getEnv();
  const user = (env.MARVIT_AUTH_USER || 'marvit').trim().toLowerCase();
  const pass = (env.MARVIT_AUTH_PASS || 'Marvit@2026').trim();
  const normalized = `${user}::${pass}::marvit_salt_v2`;
  const pinHash = crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  return { user, pinHash };
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
  const expected = getExpectedAuth();

  try {
    if (req.method === 'GET') {
      const vaultId = String(req.query?.vaultId || '')
        .trim()
        .toLowerCase();
      const pinHash = String(req.query?.pinHash || '').trim();

      if (!vaultId || !pinHash) {
        return res.status(400).json({ error: 'Informe Login e Senha.' });
      }

      if (vaultId !== expected.user || pinHash !== expected.pinHash) {
        return res.status(401).json({
          error: 'Login ou Senha inválidos. Verifique suas credenciais de acesso.',
        });
      }

      const existing = await storageGet(vaultId);

      if (!existing) {
        return res.status(200).json({
          ok: true,
          data: null,
          mode: hasCloudDriver ? 'cloud' : 'local-fallback',
        });
      }

      return res.status(200).json({
        ok: true,
        data: existing.data,
        updatedAt: existing.updatedAt,
        mode: hasCloudDriver ? 'cloud' : 'local-fallback',
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const vaultId = String(body?.vaultId || '')
        .trim()
        .toLowerCase();
      const pinHash = String(body?.pinHash || '').trim();
      const payload = body?.payload;

      if (!vaultId || !pinHash || !payload) {
        return res.status(400).json({ error: 'Dados incompletos para sincronização.' });
      }

      if (vaultId !== expected.user || pinHash !== expected.pinHash) {
        return res.status(401).json({
          error: 'Sessão não autorizada. Login ou Senha inválidos.',
        });
      }

      const updatedAt = new Date().toISOString();
      const mode = await storageSet(vaultId, {
        pinHash,
        updatedAt,
        data: payload,
      });

      return res.status(200).json({
        ok: true,
        mode,
        updatedAt,
        message:
          mode === 'cloud'
            ? 'Sincronizado permanentemente na nuvem!'
            : 'Sincronizado na sessão.',
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Erro interno no servidor de autenticação e sincronização.',
    });
  }
}
