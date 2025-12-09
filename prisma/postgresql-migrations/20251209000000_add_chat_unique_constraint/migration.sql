-- 1. Cleanup: Remove duplicate chats, keeping the most recently updated one
DELETE FROM "evo_Chat"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY "instanceId", "remoteJid"
             ORDER BY "updatedAt" DESC NULLS LAST
           ) as row_num
    FROM "evo_Chat"
  ) t
  WHERE t.row_num > 1
);

-- 2. Create the unique index (Constraint)
CREATE UNIQUE INDEX "evo_Chat_instanceId_remoteJid_key" ON "evo_Chat"("instanceId", "remoteJid");
