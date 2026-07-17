-- CreateEnum
CREATE TYPE "InstagramStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegistrationStep" ADD VALUE 'INSTAGRAM_SUB';
ALTER TYPE "RegistrationStep" ADD VALUE 'WAITING_INSTAGRAM_APPROVAL';

-- CreateTable
CREATE TABLE "instagram_verifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "InstagramStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_verifications_userId_key" ON "instagram_verifications"("userId");

-- AddForeignKey
ALTER TABLE "instagram_verifications" ADD CONSTRAINT "instagram_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
