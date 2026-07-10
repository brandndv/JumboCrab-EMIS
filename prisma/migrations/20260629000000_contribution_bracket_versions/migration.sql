-- CreateTable
CREATE TABLE "ContributionBracketVersion" (
    "id" TEXT NOT NULL,
    "contributionType" "ContributionType" NOT NULL,
    "payrollFrequency" "PayrollFrequency",
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "referenceCode" TEXT,
    "changeReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionBracketVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ContributionBracket" ADD COLUMN "versionId" TEXT;

-- Backfill current bracket rows into initial immutable versions.
CREATE TEMP TABLE "_ContributionBracketVersionBackfill" AS
SELECT
    concat('cbv_', substr(md5(row_number() OVER ()::text || random()::text || clock_timestamp()::text), 1, 20)) AS "id",
    "contributionType",
    "payrollFrequency",
    "effectiveFrom",
    CASE
        WHEN bool_or("effectiveTo" IS NULL) THEN NULL
        ELSE MAX("effectiveTo")
    END AS "effectiveTo",
    "referenceCode",
    'Initial version from existing contribution brackets'::text AS "changeReason",
    MIN("createdAt") AS "createdAt",
    MAX("updatedAt") AS "updatedAt"
FROM "ContributionBracket"
GROUP BY "contributionType", "payrollFrequency", "effectiveFrom", "referenceCode";

INSERT INTO "ContributionBracketVersion" (
    "id",
    "contributionType",
    "payrollFrequency",
    "effectiveFrom",
    "effectiveTo",
    "referenceCode",
    "changeReason",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "contributionType",
    "payrollFrequency",
    "effectiveFrom",
    "effectiveTo",
    "referenceCode",
    "changeReason",
    "createdAt",
    "updatedAt"
FROM "_ContributionBracketVersionBackfill";

UPDATE "ContributionBracket" AS bracket
SET "versionId" = backfill."id"
FROM "_ContributionBracketVersionBackfill" AS backfill
WHERE bracket."contributionType" = backfill."contributionType"
  AND bracket."payrollFrequency" IS NOT DISTINCT FROM backfill."payrollFrequency"
  AND bracket."effectiveFrom" = backfill."effectiveFrom"
  AND bracket."referenceCode" IS NOT DISTINCT FROM backfill."referenceCode";

DROP TABLE "_ContributionBracketVersionBackfill";

-- CreateIndex
CREATE INDEX "ContributionBracketVersion_contributionType_payrollFrequency_effectiveFrom_idx" ON "ContributionBracketVersion"("contributionType", "payrollFrequency", "effectiveFrom");

-- CreateIndex
CREATE INDEX "ContributionBracketVersion_effectiveFrom_effectiveTo_idx" ON "ContributionBracketVersion"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "ContributionBracketVersion_createdByUserId_idx" ON "ContributionBracketVersion"("createdByUserId");

-- CreateIndex
CREATE INDEX "ContributionBracket_versionId_idx" ON "ContributionBracket"("versionId");

-- AddForeignKey
ALTER TABLE "ContributionBracketVersion" ADD CONSTRAINT "ContributionBracketVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionBracket" ADD CONSTRAINT "ContributionBracket_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ContributionBracketVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
