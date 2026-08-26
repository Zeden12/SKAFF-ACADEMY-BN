export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeReference(reference: string): string {
  return reference.trim().toUpperCase();
}
