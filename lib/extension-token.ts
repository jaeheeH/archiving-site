import { createHmac, timingSafeEqual } from "node:crypto";

export const EXTENSION_REFERENCE_ROLES = ["admin", "sub-admin", "sub_admin"] as const;

type ExtensionTokenPayload = {
  type: "archb-reference-extension";
  sub: string;
  role: string;
  iat: number;
  exp: number;
};

function getExtensionTokenSecret() {
  const secret = process.env.EXTENSION_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("EXTENSION_TOKEN_SECRET is not configured");
  }

  return secret;
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );

  return Buffer.from(padded, "base64").toString("utf8");
}

function signTokenPayload(encodedPayload: string) {
  return encodeBase64Url(
    createHmac("sha256", getExtensionTokenSecret()).update(encodedPayload).digest()
  );
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isExtensionTokenPayload(value: unknown): value is ExtensionTokenPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<ExtensionTokenPayload>;

  return (
    payload.type === "archb-reference-extension" &&
    typeof payload.sub === "string" &&
    typeof payload.role === "string" &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number"
  );
}

export function isReferenceExtensionRole(role?: string | null) {
  return EXTENSION_REFERENCE_ROLES.includes(role as (typeof EXTENSION_REFERENCE_ROLES)[number]);
}

export function issueExtensionToken({
  userId,
  role,
  expiresInDays = 365,
}: {
  userId: string;
  role: string;
  expiresInDays?: number;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresInDays * 24 * 60 * 60;
  const payload: ExtensionTokenPayload = {
    type: "archb-reference-extension",
    sub: userId,
    role,
    iat: issuedAt,
    exp: expiresAt,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function verifyExtensionToken(token: string | null | undefined) {
  if (!token) return null;

  const [encodedPayload, signature, extra] = token.trim().split(".");
  if (!encodedPayload || !signature || extra) return null;

  const expectedSignature = signTokenPayload(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as unknown;
    if (!isExtensionTokenPayload(payload)) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
