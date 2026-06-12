-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LotteryMethod" AS ENUM ('RANDOM', 'LIVE_DRAW', 'FIXED_ORDER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('PRIVATE', 'GOVERNMENT', 'NGO', 'SELF_EMPLOYED', 'UNEMPLOYED', 'STUDENT', 'RETIRED');

-- CreateEnum
CREATE TYPE "GuarantorStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CALLED');

-- CreateEnum
CREATE TYPE "PenaltyStatus" AS ENUM ('PENDING', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "PenaltyReason" AS ENUM ('LATE_PAYMENT', 'MISSED_PAYMENT', 'POST_WIN_DEFAULT', 'RULE_VIOLATION');

-- CreateEnum
CREATE TYPE "PayoutOrderStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('PAYMENT_DISPUTE', 'PAYOUT_DISPUTE', 'MEMBERSHIP_DISPUTE', 'LOTTERY_DISPUTE', 'GENERAL');

-- CreateEnum
CREATE TYPE "MergedGroupStatus" AS ENUM ('ACTIVE', 'DISSOLVED');

-- CreateEnum
CREATE TYPE "MergedSlotStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');

-- CreateEnum
CREATE TYPE "FeeWaiverStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "PayoutSchedule" AS ENUM ('IMMEDIATE', 'NEXT_DAY', 'END_OF_CYCLE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EarlyWithdrawalPolicy" AS ENUM ('NOT_ALLOWED', 'WITH_FEE', 'ALLOWED');

-- CreateEnum
CREATE TYPE "DisputeResolution" AS ENUM ('ADMIN_DECISION', 'MEMBER_VOTE', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "AdminFeeType" AS ENUM ('NONE', 'FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DEADLINE_APPROACHING', 'PAYMENT_OVERDUE', 'DEPOSIT_VERIFIED', 'DEPOSIT_REJECTED', 'LOTTERY_WIN', 'MEMBER_JOINED', 'MEMBER_REMOVED', 'MEMBER_SUSPENDED', 'RULE_VIOLATION', 'PENALTY_CREATED', 'PENALTY_PAID', 'CYCLE_STARTED', 'CYCLE_COMPLETED', 'GROUP_COMPLETED', 'TURN_SWAP_REQUEST', 'TURN_SWAP_APPROVED', 'TURN_SWAP_REJECTED', 'DISPUTE_FILED', 'DISPUTE_RESOLVED', 'GENERAL');

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegram_id" TEXT,
    "government_id" TEXT,
    "photo_url" TEXT,
    "employment_type" "EmploymentType",
    "employer_name" TEXT,
    "marital_status" "MaritalStatus",
    "country" TEXT DEFAULT 'Ethiopia',
    "city" TEXT,
    "sub_city" TEXT,
    "woreda" TEXT,
    "house_number" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "reliability_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equb_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contribution_amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "cycle_type" TEXT NOT NULL,
    "cycle_days" INTEGER,
    "max_members" INTEGER NOT NULL,
    "lottery_method" "LotteryMethod" NOT NULL DEFAULT 'RANDOM',
    "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "bank_account" TEXT,
    "bank_name" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equb_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "shares" INTEGER NOT NULL DEFAULT 1,
    "merged_group_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'PENDING',
    "winner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "ocr_data" JSONB,
    "ft_number" TEXT,
    "amount" DOUBLE PRECISION,
    "bank_name" TEXT,
    "deposit_date" TIMESTAMP(3),
    "sender_name" TEXT,
    "sender_account" TEXT,
    "receiver_account" TEXT,
    "branch" TEXT,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verified_by_id" TEXT,
    "rejection_reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "penalty_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lottery_results" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "winner_id" TEXT NOT NULL,
    "method" "LotteryMethod" NOT NULL,
    "amount_won" DOUBLE PRECISION NOT NULL,
    "drawn_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drawn_by" TEXT,

    CONSTRAINT "lottery_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "lottery_result_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "admin_fee_amount" DOUBLE PRECISION,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "payout_date" TIMESTAMP(3),
    "transaction_ref" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guarantors" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "guarantor_user_id" TEXT NOT NULL,
    "guaranteed_user_id" TEXT NOT NULL,
    "status" "GuarantorStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarantors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_records" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "reason" "PenaltyReason" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PenaltyStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "paid_at" TIMESTAMP(3),
    "waived_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penalty_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_orders" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "PayoutOrderStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "payout_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn_swap_requests" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "requester_turn" INTEGER NOT NULL,
    "target_turn" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turn_swap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "filed_by_user_id" TEXT NOT NULL,
    "against_user_id" TEXT,
    "type" "DisputeType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merged_member_groups" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_shares" INTEGER NOT NULL DEFAULT 1,
    "max_members" INTEGER NOT NULL DEFAULT 4,
    "status" "MergedGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merged_member_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merged_member_slots" (
    "id" TEXT NOT NULL,
    "merged_group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "share_percentage" DOUBLE PRECISION NOT NULL,
    "status" "MergedSlotStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "merged_member_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_fee_waivers" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "duration_cycles" INTEGER NOT NULL,
    "cycles_used" INTEGER NOT NULL DEFAULT 0,
    "status" "FeeWaiverStatus" NOT NULL DEFAULT 'ACTIVE',
    "missed_after_expiry" INTEGER NOT NULL DEFAULT 0,
    "granted_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_fee_waivers_pkey" PRIMARY KEY ("id")
);

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
    "allow_mid_cycle_join" BOOLEAN NOT NULL DEFAULT false,
    "require_government_id" BOOLEAN NOT NULL DEFAULT false,
    "post_win_contribution_required" BOOLEAN NOT NULL DEFAULT true,
    "auto_complete_group" BOOLEAN NOT NULL DEFAULT true,
    "admin_fee_type" "AdminFeeType" NOT NULL DEFAULT 'NONE',
    "admin_fee_amount" DOUBLE PRECISION,
    "admin_fee_percent" DOUBLE PRECISION,
    "payout_schedule" "PayoutSchedule" NOT NULL DEFAULT 'IMMEDIATE',
    "payout_delay_days" INTEGER NOT NULL DEFAULT 0,
    "early_withdrawal_policy" "EarlyWithdrawalPolicy" NOT NULL DEFAULT 'NOT_ALLOWED',
    "early_withdrawal_fee" DOUBLE PRECISION,
    "dispute_resolution" "DisputeResolution" NOT NULL DEFAULT 'ADMIN_DECISION',
    "allow_merged_members" BOOLEAN NOT NULL DEFAULT false,
    "max_merged_members_per_slot" INTEGER NOT NULL DEFAULT 4,
    "fee_waiver_grace_period_days" INTEGER NOT NULL DEFAULT 7,
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
    "allow_mid_cycle_join" BOOLEAN NOT NULL DEFAULT false,
    "require_government_id" BOOLEAN NOT NULL DEFAULT false,
    "post_win_contribution_required" BOOLEAN NOT NULL DEFAULT true,
    "auto_complete_group" BOOLEAN NOT NULL DEFAULT true,
    "admin_fee_type" "AdminFeeType" NOT NULL DEFAULT 'NONE',
    "admin_fee_amount" DOUBLE PRECISION,
    "admin_fee_percent" DOUBLE PRECISION,
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
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_group_id_user_id_key" ON "group_memberships"("group_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cycles_group_id_cycle_number_key" ON "cycles"("group_id", "cycle_number");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_ft_number_key" ON "deposits"("ft_number");

-- CreateIndex
CREATE UNIQUE INDEX "lottery_results_cycle_id_key" ON "lottery_results"("cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_lottery_result_id_key" ON "payouts"("lottery_result_id");

-- CreateIndex
CREATE UNIQUE INDEX "guarantors_group_id_guarantor_user_id_guaranteed_user_id_key" ON "guarantors"("group_id", "guarantor_user_id", "guaranteed_user_id");

-- CreateIndex
CREATE INDEX "penalty_records_group_id_user_id_idx" ON "penalty_records"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "penalty_records_status_idx" ON "penalty_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payout_orders_group_id_position_key" ON "payout_orders"("group_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "payout_orders_group_id_user_id_key" ON "payout_orders"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "disputes_group_id_idx" ON "disputes"("group_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "merged_member_slots_merged_group_id_user_id_key" ON "merged_member_slots"("merged_group_id", "user_id");

-- CreateIndex
CREATE INDEX "admin_fee_waivers_group_id_user_id_idx" ON "admin_fee_waivers"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "admin_fee_waivers_status_idx" ON "admin_fee_waivers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "group_rules_group_id_key" ON "group_rules"("group_id");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "equb_groups" ADD CONSTRAINT "equb_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_merged_group_id_fkey" FOREIGN KEY ("merged_group_id") REFERENCES "merged_member_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_results" ADD CONSTRAINT "lottery_results_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lottery_results" ADD CONSTRAINT "lottery_results_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_lottery_result_id_fkey" FOREIGN KEY ("lottery_result_id") REFERENCES "lottery_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_guarantor_user_id_fkey" FOREIGN KEY ("guarantor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_guaranteed_user_id_fkey" FOREIGN KEY ("guaranteed_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_records" ADD CONSTRAINT "penalty_records_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_orders" ADD CONSTRAINT "payout_orders_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_orders" ADD CONSTRAINT "payout_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_swap_requests" ADD CONSTRAINT "turn_swap_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_swap_requests" ADD CONSTRAINT "turn_swap_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_swap_requests" ADD CONSTRAINT "turn_swap_requests_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_filed_by_user_id_fkey" FOREIGN KEY ("filed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_against_user_id_fkey" FOREIGN KEY ("against_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merged_member_groups" ADD CONSTRAINT "merged_member_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merged_member_slots" ADD CONSTRAINT "merged_member_slots_merged_group_id_fkey" FOREIGN KEY ("merged_group_id") REFERENCES "merged_member_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merged_member_slots" ADD CONSTRAINT "merged_member_slots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_fee_waivers" ADD CONSTRAINT "admin_fee_waivers_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_fee_waivers" ADD CONSTRAINT "admin_fee_waivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "equb_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_templates" ADD CONSTRAINT "rule_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
