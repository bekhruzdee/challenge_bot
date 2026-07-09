-- CreateEnum
CREATE TYPE "Language" AS ENUM ('uz', 'ru');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "language" "Language";
