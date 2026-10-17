export function paidLinkMatches(p: any, row: any) {
  return (
    p.id === row.provider_id &&
    p.reference_id === row.id &&
    p.status === "paid" &&
    p.currency === "INR" &&
    p.amount === row.amount &&
    p.amount_paid === row.amount
  );
}
