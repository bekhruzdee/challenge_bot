-- CreateEnum
CREATE TYPE "RegistrationStep" AS ENUM ('RULES', 'CHECKING_SUB', 'ASK_FIRST_NAME', 'ASK_LAST_NAME', 'ASK_PHONE', 'ASK_REGION');

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "step" "RegistrationStep" NOT NULL DEFAULT 'RULES',
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_userId_key" ON "user_sessions"("userId");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
