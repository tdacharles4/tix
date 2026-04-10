import crypto from 'crypto';

/**
 * Verifies the Conekta webhook signature.
 * Conekta sends a signed digest in the `Digest` header.
 */
export function verifyConektaWebhook(rawBody: string, digestHeader: string | null): boolean {
  if (!digestHeader) return false;

  const secret = process.env.CONEKTA_WEBHOOK_SECRET;
  if (!secret) throw new Error('CONEKTA_WEBHOOK_SECRET not set');

  // Conekta uses HMAC-SHA256; the Digest header format is "sha256=<hex>"
  const [algo, signature] = digestHeader.split('=');
  if (algo !== 'sha256') return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

export type ConektaWebhookEvent = {
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      metadata?: Record<string, string>;
      amount?: number;
      currency?: string;
    };
  };
};
