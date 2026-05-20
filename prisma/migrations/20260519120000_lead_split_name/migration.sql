-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '';

-- Backfill existing rows by splitting `name` on the first space.
-- "Hector Romero"   -> firstName="Hector", lastName="Romero"
-- "Mary Jo Smith"   -> firstName="Mary",   lastName="Jo Smith"
-- "Cher"            -> firstName="Cher",   lastName=""
-- empty/null name   -> firstName="",       lastName=""
-- WHERE clause keeps this idempotent if re-run after first apply.
UPDATE "Lead"
SET
  "firstName" = CASE
    WHEN "name" IS NULL OR trim("name") = '' THEN ''
    WHEN position(' ' IN trim("name")) = 0 THEN trim("name")
    ELSE substring(trim("name") FROM 1 FOR position(' ' IN trim("name")) - 1)
  END,
  "lastName" = CASE
    WHEN "name" IS NULL OR trim("name") = '' THEN ''
    WHEN position(' ' IN trim("name")) = 0 THEN ''
    ELSE substring(trim("name") FROM position(' ' IN trim("name")) + 1)
  END
WHERE "firstName" = '' AND "lastName" = '';
