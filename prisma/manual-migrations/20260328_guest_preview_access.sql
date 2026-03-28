ALTER TABLE "Generation"
ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Generation"
ADD COLUMN "storageKeyPrefix" TEXT;

UPDATE "Generation"
SET "storageKeyPrefix" = CONCAT('gen/', "userId")
WHERE "userId" IS NOT NULL
  AND "storageKeyPrefix" IS NULL;
