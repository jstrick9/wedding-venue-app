# Re-Review — 15: Operations (Vendor Payments) (fresh pass)

## Finding

### GAP (non-functional feature) — No payment-recording UI despite a full payments data layer
`useVendors` had complete payment CRUD (`addPayment`, `updatePayment`,
`deletePayment`, `getPaymentsForVendor`, `getUpcomingPayments`) and a
`VendorPayment` type, and the Event Overview dashboard reads payments for the
budget card — but **`VendorPanel` never surfaced payments**. You could add a
vendor with a contract amount/deposit, but there was **no way to record an actual
payment** through the UI. So the "Total Paid / Remaining" budget and the
dashboard's paid/balance were always empty unless data was injected.

**Fix:** Added a **💳 Payments** tab to the VendorPanel:
- Record a payment: pick vendor, amount, due date, paid status.
- List all recorded payments (vendor, due date, amount, paid status).
- Toggle paid/unpaid and delete a payment.

## Cross-module impact
- The Vendor budget card in the Event Overview and the Budget tab's
  Total-Paid/Remaining now reflect real data entered in the UI.

## Validation
- Typecheck clean; full suite green; build succeeds.
