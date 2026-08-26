-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'APPROVED', 'REJECTED', 'ENROLLED');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('PRIMARY', 'SECONDARY', 'VOCATIONAL', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'DOCTORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationDocumentType" AS ENUM ('IDENTIFICATION', 'PHOTO', 'ACADEMIC', 'ADDITIONAL');

-- CreateEnum
CREATE TYPE "ApplicationHistoryActorType" AS ENUM ('APPLICANT', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApplicationHistoryVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "applicationId" TEXT;

-- AlterTable
ALTER TABLE "Intake" ADD COLUMN     "applicationCloseAt" TIMESTAMP(3),
ADD COLUMN     "applicationOpenAt" TIMESTAMP(3),
ADD COLUMN     "capacity" INTEGER;

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "currentAddress" TEXT,
    "highestEducationLevel" "EducationLevel",
    "previousInstitution" TEXT,
    "fieldOfStudy" TEXT,
    "completionYear" INTEGER,
    "educationNotes" TEXT,
    "applicantFacingMessage" TEXT,
    "internalAdminNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "ApplicationDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationHistoryEntry" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorType" "ApplicationHistoryActorType" NOT NULL,
    "actorName" TEXT,
    "message" TEXT,
    "visibility" "ApplicationHistoryVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceCounter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE INDEX "Application_programId_idx" ON "Application"("programId");

-- CreateIndex
CREATE INDEX "Application_intakeId_idx" ON "Application"("intakeId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_submittedAt_idx" ON "Application"("submittedAt");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationHistoryEntry_applicationId_idx" ON "ApplicationHistoryEntry"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationHistoryEntry_createdAt_idx" ON "ApplicationHistoryEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_applicationId_key" ON "Enrollment"("applicationId");

-- CreateIndex
CREATE INDEX "Intake_status_idx" ON "Intake"("status");

-- CreateIndex
CREATE INDEX "Intake_applicationsOpen_idx" ON "Intake"("applicationsOpen");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationHistoryEntry" ADD CONSTRAINT "ApplicationHistoryEntry_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

