import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type AuthenticatedIdentity = {
  subject: string;
  scopes: string[];
  authenticationMethods: string[];
};

export class AuthConfigurationError extends Error {}

declare module 'fastify' {
  interface FastifyRequest {
    identity: AuthenticatedIdentity | null;
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function authSettings() {
  const issuer = process.env.OIDC_ISSUER;
  const audience = process.env.OIDC_AUDIENCE;
  const jwksUrl = process.env.OIDC_JWKS_URL;

  if (!issuer || !audience || !jwksUrl) {
    throw new AuthConfigurationError('OIDC issuer, audience, and JWKS URL are required');
  }

  let url: URL;
  try {
    url = new URL(jwksUrl);
  } catch {
    throw new AuthConfigurationError('OIDC_JWKS_URL must be an absolute URL');
  }

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new AuthConfigurationError('OIDC JWKS must be served over HTTPS in production');
  }

  jwks ??= createRemoteJWKSet(url);
  return { issuer, audience, jwks };
}

export function assertAuthConfiguration() {
  if (process.env.NODE_ENV === 'production') authSettings();
}

export async function verifyAccessToken(token: string): Promise<AuthenticatedIdentity> {
  const { issuer, audience, jwks: keySet } = authSettings();
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
    algorithms: ['RS256', 'ES256', 'EdDSA'],
    requiredClaims: ['exp', 'sub'],
  });

  const claims = payload as JWTPayload & { scope?: string; scp?: string[]; amr?: string[] };
  const scopes = Array.isArray(claims.scp)
    ? claims.scp
    : typeof claims.scope === 'string'
      ? claims.scope.split(/\s+/).filter(Boolean)
      : [];

  return {
    subject: claims.sub!,
    scopes,
    authenticationMethods: Array.isArray(claims.amr) ? claims.amr : [],
  };
}

export function hasRequiredMfa(identity: AuthenticatedIdentity) {
  const acceptedMethods = new Set(
    (process.env.OIDC_MFA_AMR_VALUES ?? 'mfa,otp,webauthn')
      .split(',')
      .map((method) => method.trim())
      .filter(Boolean),
  );
  return identity.authenticationMethods.some((method) => acceptedMethods.has(method));
}

export function hasScopes(identity: AuthenticatedIdentity, requiredScopes: string[]) {
  return requiredScopes.every((scope) => identity.scopes.includes(scope));
}