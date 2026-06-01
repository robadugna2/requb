-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PRIVATE', 'GOVERNMENT', 'NGO', 'SELF_EMPLOYED', 'UNEMPLOYED', 'STUDENT', 'RETIRED');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "PayoutSchedule" AS ENUM ('IMMEDIATE', 'NEXT_DAY', 'END_OF_CYCLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EarlyWithdrawalPolicy" AS ENUM ('NOT_ALLOWED', 'WITH_FEE', 'ALLOWED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('ADMIN_DECISION', 'MEMBER_VOTE', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DEADLINE_APPROACHING', 'PAYMENT_OVERDUE', 'DEPOSIT_VERIFIED', 'DEPOSIT_REJECTED', 'LOTTERY_WIN', 'MEMBER_JOINED', 'MEMBER_REMOVED', 'RULE_VIOLATION', 'CYCLE_STARTED', 'GENERAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'Ethiopia',
ADD COLUMN     "employer_name" TEXT,
ADD COLUMN     "employment_type" "EmploymentType",
ADD COLUMN     "government_id" TEXT,
ADD COLUMN     "house_number" TEXT,
ADD COLUMN     "marital_status" "MaritalStatus",
ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "sub_city" TEXT,
ADD COLUMN     "woreda" TEXT;

-- CreateTable
CREATE TABLE "group_rules" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "late_penalty_type" "PenaltyType" NOT NULL DEFAULT 'NONE',
    "late_penalty_amount" DOUBLE PRECISION,
    "late_penalty_percent" DOUBLE PRECISION,
    "grace_period_days" INTEGER NOT NULL DEFAULT 3,
    "max_missed_payments" INTEGER NOT NULL DEFAULT 3,
    "require_exact_amount" BOOLEAN NOT NULL DEFAULT true,
    "deposit_deadline_day" INTEGER,
    "min_verification_hours" INTEGER NOT NULL DEFAULT 24,
    "allow_skip_round" BOOLEAN NOT NULL DEFAULT false,
    "max_skips_allowed" INTEGER NOT NULL DEFAULT 0,
    "require_guarantor" BOOLEAN NOT NULL DEFAULT false,
    "min_members_to_start" INTEGER NOT NULL DEFAULT 3,
    "payout_schedule" "PayoutSchedule" NOT NULL DEFAULT 'IMMEDIATE',
    "payout_delay_days" INTEGER NOT NULL DEFAULT 0,
    "early_withdrawal_policy" "EarlyWithdrawalPolicy" NOT NULL DEFAULT 'NOT_ALLOWED',
    "early_withdrawal_fee" DOUBLE PRECISION,
    "dispute_resolution" "DisputeResolution" NOT NULL DEFAULT 'ADMIN_DECISION',
    "custom_rules" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "late_penalty_type" "PenaltyType" NOT NULL DEFAULT 'NONE',
    "late_penalty_amount" DOUBLE PRECISION,
    "late_penalty_percent" DOUBLE PRECISION,
    "grace_period_days" INTEGER NOT NULL DEFAULT 3,
    "max_missed_payments" INTEGER NOT NULL DEFAULT 3,
    "require_exact_amount" BOOLEAN NOT NULL DEFAULT true,
    "deposit_deadline_day" INTEGER,
    "min_verification_hours" INTEGER NOT NULL DEFAULT 24,
    "allow_skip_round" BOOLEAN NOT NULL DEFAULT false,
    "max_skips_allowed" INTEGER NOT NULL DEFAULT 0,
    "require_guarantor" BOOLEAN NOT NULL DEFAULT false,
    "min_members_to_start" INTEGER NOT NULL DEFAULT 3,
    "payout_schedule" "PayoutSchedule" NOT NULL DEFAULT 'IMMEDIATE',
    "payout_delay_days" INTEGER NOT NULL DEFAULT 0,
    "early_withdrawal_policy" "EarlyWithdrawalPolicy" NOT NULL DEFAULT 'NOT_ALLOWED',
    "early_withdrawal_fee" DOUBLE PRECISION,
    "dispute_resolution" "DisputeResolution" NOT NULL DEFAULT 'ADMIN_DECISION',
    "custom_rules" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "group_id" TEXT,
    "user_id" TEXT,
    "deposit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_rules_group_id_key" ON "group_rules"("group_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_templates" ADD CONSTRAINT "rule_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
