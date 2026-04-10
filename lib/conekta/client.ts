const CONEKTA_BASE = 'https://api.conekta.io';
const CONEKTA_API_VERSION = '2.1.0';

function headers() {
  const auth = Buffer.from(`${process.env.CONEKTA_PRIVATE_KEY}:`).toString('base64');
  return {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'es',
    'Conekta-Client-User-Agent': JSON.stringify({ lang: 'node', publisher: 'boletera' }),
    'X-Conekta-Client-User-Agent': `Conekta/v2 NodeBindings/${CONEKTA_API_VERSION}`,
  };
}

export type ConektaOrderPayload = {
  currency: string;
  customer_info: {
    name: string;
    email: string;
    phone?: string;
  };
  line_items: Array<{
    name: string;
    unit_price: number; // centavos
    quantity: number;
  }>;
  charges: Array<{
    payment_method: {
      type: 'card' | 'oxxo_cash' | 'spei';
      monthly_installments?: number;
    };
    amount: number;
  }>;
  checkout?: {
    type: string;
    allowed_payment_methods: string[];
    success_url: string;
    failure_url: string;
  };
  metadata?: Record<string, string>;
};

export async function createConektaOrder(payload: ConektaOrderPayload) {
  const res = await fetch(`${CONEKTA_BASE}/orders`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Conekta error: ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function getConektaOrder(orderId: string) {
  const res = await fetch(`${CONEKTA_BASE}/orders/${orderId}`, {
    headers: headers(),
  });

  if (!res.ok) throw new Error('Failed to fetch Conekta order');
  return res.json();
}
