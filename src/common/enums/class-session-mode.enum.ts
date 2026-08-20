/**
 * Delivery mode of a ClassSession. SKAFF Academy is physical-campus-first;
 * online/offsite are the exception, not the default. Shared vocabulary with
 * the SKAFF-ACADEMY frontend — do not rename or add conflicting modes
 * without updating both sides.
 */
export enum ClassSessionMode {
  PHYSICAL = 'physical',
  ONLINE = 'online',
  OFFSITE = 'offsite',
}
