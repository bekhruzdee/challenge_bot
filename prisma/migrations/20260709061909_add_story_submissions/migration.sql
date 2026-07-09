-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "story_submissions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "caption" TEXT,
    "status" "StoryStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "story_submissions_userId_idx" ON "story_submissions"("userId");

-- CreateIndex
CREATE INDEX "story_submissions_status_idx" ON "story_submissions"("status");

-- AddForeignKey
ALTER TABLE "story_submissions" ADD CONSTRAINT "story_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
