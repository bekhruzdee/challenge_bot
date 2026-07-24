-- DropIndex
DROP INDEX "story_submissions_userId_idx";

-- CreateIndex
CREATE INDEX "story_submissions_userId_status_idx" ON "story_submissions"("userId", "status");
