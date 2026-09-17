export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatPatientId(clinicName: string, patientNumber: number | null): string {
  if (!patientNumber) return "-";
  const prefix =
    (clinicName || "PT").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "PT";
  return `${prefix}-${1000 + patientNumber}`;
}
