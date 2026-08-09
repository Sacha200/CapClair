-- CreateEnum
CREATE TYPE "Organisme" AS ENUM ('CAF', 'CPAM', 'FRANCE_TRAVAIL');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('A_ANALYSER', 'A_FAIRE', 'EN_ATTENTE_REPONSE', 'TERMINE');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'TERMINEE', 'ECHEC');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('FAIBLE', 'MOYEN', 'ELEVE');

-- CreateEnum
CREATE TYPE "EcheanceType" AS ENUM ('EXPLICITE', 'RELATIVE');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('J_MOINS_7', 'J_MOINS_1', 'JOUR_J');

-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ANNULE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ANALYSE_TERMINEE', 'ANALYSE_ECHEC', 'RAPPEL', 'SYSTEME');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('ANALYSE_IA', 'CGU');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "reminderOptIn" BOOLEAN NOT NULL DEFAULT true,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisme" "Organisme" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'A_ANALYSER',
    "analysisStatus" "AnalysisStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "mainDeadline" TIMESTAMP(3),
    "mainDeadlineType" "EcheanceType",
    "mainDeadlineSourceExcerpt" TEXT,
    "mainDeadlineConfidence" "ConfidenceLevel",
    "summary" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelEn" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedInformation" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceExcerpt" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'ELEVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedInformation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceExcerpt" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "dueDateType" "EcheanceType",
    "dueDateSourceExcerpt" TEXT,
    "dueDateConfidence" "ConfidenceLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredDocument" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceExcerpt" TEXT NOT NULL,
    "provided" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequiredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseDraft" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "caseFileId" TEXT NOT NULL,
    "reminderType" "ReminderType" NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseFileId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseFileId" TEXT,
    "consentType" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caseFileId" TEXT,
    "eventType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_lastActivityAt_idx" ON "User"("lastActivityAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "CaseFile_userId_idx" ON "CaseFile"("userId");

-- CreateIndex
CREATE INDEX "CaseFile_status_idx" ON "CaseFile"("status");

-- CreateIndex
CREATE INDEX "CaseFile_analysisStatus_idx" ON "CaseFile"("analysisStatus");

-- CreateIndex
CREATE INDEX "Document_caseFileId_idx" ON "Document"("caseFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE INDEX "ExtractedInformation_caseFileId_idx" ON "ExtractedInformation"("caseFileId");

-- CreateIndex
CREATE INDEX "ExtractedInformation_categoryId_idx" ON "ExtractedInformation"("categoryId");

-- CreateIndex
CREATE INDEX "ActionItem_caseFileId_idx" ON "ActionItem"("caseFileId");

-- CreateIndex
CREATE INDEX "RequiredDocument_caseFileId_idx" ON "RequiredDocument"("caseFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseDraft_caseFileId_key" ON "ResponseDraft"("caseFileId");

-- CreateIndex
CREATE INDEX "Reminder_status_scheduledFor_idx" ON "Reminder"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_caseFileId_reminderType_channel_key" ON "Reminder"("caseFileId", "reminderType", "channel");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "ConsentLog_userId_idx" ON "ConsentLog"("userId");

-- CreateIndex
CREATE INDEX "AuditEvent_caseFileId_idx" ON "AuditEvent"("caseFileId");

-- CreateIndex
CREATE INDEX "AuditEvent_userId_idx" ON "AuditEvent"("userId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFile" ADD CONSTRAINT "CaseFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedInformation" ADD CONSTRAINT "ExtractedInformation_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedInformation" ADD CONSTRAINT "ExtractedInformation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredDocument" ADD CONSTRAINT "RequiredDocument_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseDraft" ADD CONSTRAINT "ResponseDraft_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLog" ADD CONSTRAINT "ConsentLog_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
