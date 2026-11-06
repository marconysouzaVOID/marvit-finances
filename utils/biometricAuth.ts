const BIOMETRIC_STORAGE_KEY = 'marvit_biometric_credential_v1';

interface StoredBiometricRecord {
  credentialIdBase64: string;
  vaultId: string;
  pinHash: string;
  createdAt: string;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Verifica se a aplicação está rodando instalada como PWA (standalone / fullscreen / iOS WebApp) */
export function isRunningAsPwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/** Verifica se o dispositivo atual suporta Biometria nativa (FaceID, TouchID, Impressão Digital Android ou Windows Hello) */
export async function isBiometricsSupported(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !window.PublicKeyCredential ||
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function'
  ) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function hasRegisteredBiometrics(): StoredBiometricRecord | null {
  try {
    const raw = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredBiometricRecord;
  } catch {
    return null;
  }
}

export function clearBiometricRegistration(): void {
  localStorage.removeItem(BIOMETRIC_STORAGE_KEY);
}

/** Registra uma credencial WebAuthn de plataforma (FaceID / TouchID / Biometria) para o Cofre Marvit */
export async function registerBiometricVault(
  vaultId: string,
  pinHash: string
): Promise<boolean> {
  const supported = await isBiometricsSupported();
  if (!supported) {
    throw new Error('Este aparelho ou navegador não disponibiliza leitor biométrico nativo.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new TextEncoder().encode(vaultId || 'marvit-default');

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'Marvit&Finances Cozy Kitchen',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: `${vaultId}@marvit.finances`,
        displayName: `Cofre ${vaultId}`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Cadastro biométrico cancelado.');
  }

  const record: StoredBiometricRecord = {
    credentialIdBase64: bufferToBase64(credential.rawId),
    vaultId,
    pinHash,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(record));
  return true;
}

/** Solicita FaceID / TouchID / Impressão Digital para desbloquear o Cofre Marvit */
export async function unlockWithBiometrics(): Promise<{
  vaultId: string;
  pinHash: string;
}> {
  const record = hasRegisteredBiometrics();
  if (!record) {
    throw new Error('Nenhuma biometria cadastrada neste aparelho.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: base64ToBuffer(record.credentialIdBase64),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error('Verificação biométrica não concluída.');
  }

  return {
    vaultId: record.vaultId,
    pinHash: record.pinHash,
  };
}

