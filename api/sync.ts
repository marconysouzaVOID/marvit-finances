// Vercel Serverless Function (/api/sync)
// Compatível com Vercel KV / Upstash Redis gratuito via REST API

interface StoredVaultRecord {
  pinHash: string;
  updatedAt: string;
  data: unknown;
}

// Memória efêmera de fallback caso as variáveis KV/Upstash ainda não estejam preenchidas na Vercel
const memoryStore = new Map<string, StoredVaultRecord>();

function getRedisCredentials(): { url: string; token: string } | null {
  const env = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  if (!env) return null;

  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/$/, ''), token };
  }
  return null;
}

async function redisGet(key: string): Promise<StoredVaultRecord | null> {
  const creds = getRedisCredentials();
  if (!creds) {
    return memoryStore.get(key) || null;
  }

  const response = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${creds.token}` },
  });
  if (!response.ok) return null;
  const json = (await response.json()) as { result?: string | null };
  if (!json.result) return null;
  try {
    return JSON.parse(json.result) as StoredVaultRecord;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: StoredVaultRecord): Promise<'cloud' | 'local-fallback'> {
  const creds = getRedisCredentials();
  if (!creds) {
    memoryStore.set(key, value);
    return 'local-fallback';
  }

  const response = await fetch(`${creds.url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });

  if (!response.ok) {
    memoryStore.set(key, value);
    return 'local-fallback';
  }
  return 'cloud';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const vaultId = String(req.query?.vaultId || '')
        .trim()
        .toLowerCase();
      const pinHash = String(req.query?.pinHash || '').trim();

      if (!vaultId || !pinHash) {
        return res.status(400).json({ error: 'Informe vaultId e pinHash.' });
      }

      const key = `marvit:vault:${vaultId}`;
      const existing = await redisGet(key);

      if (!existing) {
        return res.status(200).json({
          ok: true,
          data: null,
          mode: getRedisCredentials() ? 'cloud' : 'local-fallback',
        });
      }

      if (existing.pinHash !== pinHash) {
        return res.status(401).json({
          error: 'PIN incorreto para este Cofre Marvit.',
        });
      }

      return res.status(200).json({
        ok: true,
        data: existing.data,
        updatedAt: existing.updatedAt,
        mode: getRedisCredentials() ? 'cloud' : 'local-fallback',
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

      const key = `marvit:vault:${vaultId}`;
      const existing = await redisGet(key);

      if (existing && existing.pinHash !== pinHash) {
        return res.status(401).json({
          error: 'Este nome de Cofre já pertence a outro PIN/Senha.',
        });
      }

      const updatedAt = new Date().toISOString();
      const mode = await redisSet(key, {
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
            ? 'Sincronizado no Vercel KV / Upstash Redis!'
            : 'Sincronizado na sessão da Vercel (adicione KV_REST_API_URL para persistência permanente).',
      });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Erro interno no servidor de sincronização.',
    });
  }
}

