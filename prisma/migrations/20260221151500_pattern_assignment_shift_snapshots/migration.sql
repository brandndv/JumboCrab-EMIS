-- AlterTable
ALTER TABLE "EmployeePatternAssignment"
ADD COLUMN "sunShiftIdSnapshot" INTEGER,
ADD COLUMN "monShiftIdSnapshot" INTEGER,
ADD COLUMN "tueShiftIdSnapshot" INTEGER,
ADD COLUMN "wedShiftIdSnapshot" INTEGER,
ADD COLUMN "thuShiftIdSnapshot" INTEGER,
ADD COLUMN "friShiftIdSnapshot" INTEGER,
ADD COLUMN "satShiftIdSnapshot" INTEGER;

-- Backfill snapshots from current pattern definitions
UPDATE "EmployeePatternAssignment" AS epa
SET
  "sunShiftIdSnapshot" = wp."sunShiftId",
  "monShiftIdSnapshot" = wp."monShiftId",
  "tueShiftIdSnapshot" = wp."tueShiftId",
  "wedShiftIdSnapshot" = wp."wedShiftId",
  "thuShiftIdSnapshot" = wp."thuShiftId",
  "friShiftIdSnapshot" = wp."friShiftId",
  "satShiftIdSnapshot" = wp."satShiftId"
FROM "WeeklyPattern" AS wp
WHERE epa."patternId" = wp."id";
