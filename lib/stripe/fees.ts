// Stripe's MX processing rate + Mexican 16% IVA on the fee itself
const STRIPE_RATE          = 0.036 * 1.16;             // 4.176 %
const STRIPE_FIXED_CENTAVOS = Math.round(300 * 1.16);  // 348 centavos (MXN $3 + IVA)

/**
 * Calculates the gross charge, Stripe fee (IVA-inclusive), and the correct
 * `application_fee_amount` to pass to Stripe on a destination charge.
 *
 * With destination charges, Stripe transfers (charge − application_fee) to the
 * connected account and bills its own processing fee to the platform separately.
 * Bundling both the platform fee AND Stripe's fee into `application_fee_amount`
 * ensures the accounting is exact:
 *   - Organizer nets exactly `ticketSubtotalCentavos`
 *   - Platform nets exactly `platformFeeCentavos`
 *
 * Gross-up derivation:
 *   charge × (1 − STRIPE_RATE) = ticket + platform + STRIPE_FIXED
 *   charge = ceil((ticket + platform + STRIPE_FIXED) / (1 − STRIPE_RATE))
 */
export function calculateStripeFees(
  ticketSubtotalCentavos: number,
  platformFeeCentavos: number,
): {
  chargeCentavos: number;
  stripeFeeCentavos: number;
  applicationFeeCentavos: number; // pass as application_fee_amount
} {
  const chargeCentavos = Math.ceil(
    (ticketSubtotalCentavos + platformFeeCentavos + STRIPE_FIXED_CENTAVOS) /
    (1 - STRIPE_RATE),
  );
  const stripeFeeCentavos      = chargeCentavos - ticketSubtotalCentavos - platformFeeCentavos;
  const applicationFeeCentavos = platformFeeCentavos + stripeFeeCentavos; // = charge − ticket
  return { chargeCentavos, stripeFeeCentavos, applicationFeeCentavos };
}
