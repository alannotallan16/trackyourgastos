/**
 * Payment-method suggestions used by all Record Payment forms as a
 * <datalist>. Users can still type a custom value.
 *
 * "Forgiven" is a convention label — a Forgiven payment still writes a real
 * settlement_payments row (so paid/owed stay balanced). For closing a batch
 * row without any cash leg at all, use reconcileBatchRows via the Close
 * batch dialog on the settlement detail page.
 */
export const PAYMENT_METHODS = [
  "Bank transfer",
  "Cash",
  "GCash",
  "Forgiven",
  "Other"
] as const;

export const PAYMENT_METHODS_DATALIST_ID = "payment-methods-datalist";

export function PaymentMethodsDatalist() {
  return (
    <datalist id={PAYMENT_METHODS_DATALIST_ID}>
      {PAYMENT_METHODS.map((m) => (
        <option key={m} value={m} />
      ))}
    </datalist>
  );
}
