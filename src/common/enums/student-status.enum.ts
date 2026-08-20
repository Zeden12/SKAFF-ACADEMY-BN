/**
 * Standing of an enrolled student. Shared vocabulary with the
 * SKAFF-ACADEMY frontend — do not rename or add conflicting statuses
 * without updating both sides.
 */
export enum StudentStatus {
  ACTIVE = 'active',
  PENDING_PAYMENT = 'pending_payment',
  ON_HOLD = 'on_hold',
  SUSPENDED = 'suspended',
  COMPLETED = 'completed',
  WITHDRAWN = 'withdrawn',
}
