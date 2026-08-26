import { ApplicationHistoryActorType, ApplicationHistoryVisibility, Prisma } from '@prisma/client';

/**
 * Shapes an ApplicationHistoryEntry create payload. Applicant-facing APIs
 * must only ever read PUBLIC entries — see ApplicationsService.mapPublicHistory.
 */
export function historyEntryData(
  applicationId: string,
  action: string,
  actorType: ApplicationHistoryActorType,
  options: {
    actorName?: string | null;
    message?: string | null;
    visibility?: ApplicationHistoryVisibility;
  } = {},
): Prisma.ApplicationHistoryEntryUncheckedCreateInput {
  return {
    applicationId,
    action,
    actorType,
    actorName: options.actorName ?? null,
    message: options.message ?? null,
    visibility: options.visibility ?? ApplicationHistoryVisibility.INTERNAL,
  };
}
