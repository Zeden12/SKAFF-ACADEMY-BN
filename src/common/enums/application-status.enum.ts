/**
 * Lifecycle of an online Application, from the applicant's first draft
 * through to enrollment. Shared vocabulary with the SKAFF-ACADEMY frontend —
 * do not rename or add conflicting statuses without updating both sides.
 */
export enum ApplicationStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  MORE_INFORMATION_REQUIRED = 'more_information_required',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ENROLLED = 'enrolled',
}
