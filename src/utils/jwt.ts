import * as jose from 'jose';
const OIDC_CONFIG_URL = 'https://auth.adolfrey.com/api/.well-known/openid-configuration';

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;
let issuer: string | undefined = undefined;

async function discover() {
  if (jwks && issuer) return;
  try {
    const response = await fetch(OIDC_CONFIG_URL);
    const config = await response.json();
    issuer = config.issuer;
    jwks = jose.createRemoteJWKSet(new URL(config.jwks_uri));
  } catch (error) {
    console.error('OIDC Discovery failed:', error);
    throw new Error('Failed to load identity provider configuration.');
  }
}

export interface AccountPayload {
  bank: string;
  accountName: string;
  accountId: string;
  qrData: string;
  [key: string]: any;
}

/**
 * Verifies a JWT token using dynamically discovered OIDC configuration
 * @param token The JWT string to verify
 * @returns The decoded and verified payload
 * @throws Error if verification fails
 */
export async function verifyAccountToken(token: string): Promise<AccountPayload> {
  try {
    await discover();
    if (!jwks) throw new Error('JWKS not initialized');

    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer,
    });

    return payload as unknown as AccountPayload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    throw new Error('Error: Expired account, contact AR');
  }
}
