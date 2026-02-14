/**
 * Platform pricing constants.
 *
 * Every invoice download costs a flat service fee charged via M-Pesa.
 * The fee is independent of the invoice total — it's the cost of using
 * the Riciti platform to generate a professional PDF invoice.
 */

/** Fixed service fee (KES) charged per invoice download */
export const SERVICE_FEE_AMOUNT = 10;

/** Currency for the service fee (always KES regardless of invoice currency) */
export const SERVICE_FEE_CURRENCY = "KES";
