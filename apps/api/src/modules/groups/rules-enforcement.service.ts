import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GroupRules, PenaltyType } from '@prisma/client';

export interface RuleViolation {
  rule: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface PenaltyCalculation {
  amount: number;
  type: PenaltyType;
  reason: string;
}

@Injectable()
export class RulesEnforcementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get group rules, returning defaults if none exist
   */
  async getGroupRules(groupId: string): Promise<GroupRules | null> {
    return this.prisma.groupRules.findUnique({
      where: { groupId },
    });
  }

  // ─── Member Validation ──────────────────────────────────────────

  /**
   * Validate whether a new member can be added to the group
   */
  async validateMemberAddition(
    groupId: string,
    userId: string,
  ): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    const rules = await this.getGroupRules(groupId);

    if (!rules) return violations; // no rules configured — allow everything

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      violations.push({
        rule: 'USER_EXISTS',
        message: 'User not found.',
        severity: 'ERROR',
      });
      return violations;
    }

    // Check government ID requirement
    if (rules.requireGovernmentId && !user.governmentId) {
      violations.push({
        rule: 'REQUIRE_GOVERNMENT_ID',
        message:
          'This group requires members to have a government ID on file. Please update the member profile first.',
        severity: 'ERROR',
      });
    }

    // Check guarantor requirement
    if (rules.requireGuarantor) {
      const guarantor = await this.prisma.guarantor.findFirst({
        where: {
          groupId,
          guaranteedUserId: userId,
          status: 'ACTIVE',
        },
      });

      if (!guarantor) {
        violations.push({
          rule: 'REQUIRE_GUARANTOR',
          message:
            'This group requires a guarantor. Please assign a guarantor for this member before adding them.',
          severity: 'ERROR',
        });
      }
    }

    // Check mid-cycle join restriction
    if (!rules.allowMidCycleJoin) {
      const activeCycle = await this.prisma.cycle.findFirst({
        where: { groupId, status: 'ACTIVE' },
      });

      if (activeCycle) {
        violations.push({
          rule: 'NO_MID_CYCLE_JOIN',
          message:
            'This group does not allow new members to join during an active cycle. Wait until the current cycle completes.',
          severity: 'ERROR',
        });
      }
    }

    return violations;
  }

  /**
   * Validate whether a member can be removed from the group
   */
  async validateMemberRemoval(
    groupId: string,
    userId: string,
  ): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];

    // Check for unpaid penalties
    const unpaidPenalties = await this.prisma.penaltyRecord.count({
      where: {
        groupId,
        userId,
        status: 'PENDING',
      },
    });

    if (unpaidPenalties > 0) {
      violations.push({
        rule: 'UNPAID_PENALTIES',
        message: `Member has ${unpaidPenalties} unpaid penalty/penalties. Consider resolving these before removal.`,
        severity: 'WARNING',
      });
    }

    // Check if member has already won but hasn't completed remaining cycles
    const rules = await this.getGroupRules(groupId);
    if (rules?.postWinContributionRequired) {
      const memberWins = await this.prisma.lotteryResult.findMany({
        where: {
          winnerId: userId,
          cycle: { groupId },
        },
      });

      if (memberWins.length > 0) {
        const totalCycles = await this.prisma.cycle.count({
          where: { groupId },
        });
        const activeMembers = await this.prisma.groupMembership.count({
          where: { groupId, status: 'ACTIVE' },
        });

        if (totalCycles < activeMembers) {
          violations.push({
            rule: 'POST_WIN_OBLIGATION',
            message:
              'Member has won a payout and is obligated to continue contributing until the rotation completes.',
            severity: 'WARNING',
          });
        }
      }
    }

    return violations;
  }

  // ─── Deposit Validation ─────────────────────────────────────────

  /**
   * Validate a deposit against group rules
   */
  async validateDeposit(
    groupId: string,
    userId: string,
    amount: number | null | undefined,
    depositDate: Date | null | undefined,
  ): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    const rules = await this.getGroupRules(groupId);

    if (!rules) return violations;

    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) return violations;

    // Get member's shares
    const membership = await this.prisma.groupMembership.findFirst({
      where: { groupId, userId, status: 'ACTIVE' },
    });

    const shares = membership?.shares ?? 1;
    const expectedAmount = group.contributionAmount * shares;

    // Check exact amount requirement
    if (rules.requireExactAmount && amount !== null && amount !== undefined) {
      // Allow a small tolerance (1 ETB) for rounding
      if (Math.abs(amount - expectedAmount) > 1) {
        violations.push({
          rule: 'EXACT_AMOUNT_REQUIRED',
          message: `Deposit amount (${amount} ETB) does not match the required contribution of ${expectedAmount} ETB${shares > 1 ? ` (${shares} shares × ${group.contributionAmount} ETB)` : ''}.`,
          severity: 'ERROR',
        });
      }
    }

    // Check deposit deadline
    if (rules.depositDeadlineDay && depositDate) {
      const deadline = this.getDeadlineDate(
        depositDate,
        rules.depositDeadlineDay,
      );
      const isLate = depositDate > deadline;

      if (isLate) {
        const gracePeriodEnd = new Date(deadline);
        gracePeriodEnd.setDate(
          gracePeriodEnd.getDate() + rules.gracePeriodDays,
        );

        if (depositDate > gracePeriodEnd) {
          violations.push({
            rule: 'DEPOSIT_PAST_GRACE_PERIOD',
            message: `Deposit is past the deadline (day ${rules.depositDeadlineDay}) and the ${rules.gracePeriodDays}-day grace period. A late penalty will be applied.`,
            severity: 'WARNING',
          });
        } else {
          violations.push({
            rule: 'DEPOSIT_LATE_IN_GRACE',
            message: `Deposit is past the deadline (day ${rules.depositDeadlineDay}) but within the ${rules.gracePeriodDays}-day grace period.`,
            severity: 'WARNING',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check if a deposit is late based on group rules
   */
  async isDepositLate(
    groupId: string,
    depositDate: Date,
  ): Promise<{ isLate: boolean; isPastGrace: boolean }> {
    const rules = await this.getGroupRules(groupId);

    if (!rules?.depositDeadlineDay) {
      return { isLate: false, isPastGrace: false };
    }

    const deadline = this.getDeadlineDate(
      depositDate,
      rules.depositDeadlineDay,
    );
    const isLate = depositDate > deadline;

    if (!isLate) {
      return { isLate: false, isPastGrace: false };
    }

    const gracePeriodEnd = new Date(deadline);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + rules.gracePeriodDays);
    const isPastGrace = depositDate > gracePeriodEnd;

    return { isLate, isPastGrace };
  }

  // ─── Lottery / Draw Validation ──────────────────────────────────

  /**
   * Validate eligibility for lottery draw
   */
  async validateLotteryEligibility(
    groupId: string,
    cycleId: string,
  ): Promise<RuleViolation[]> {
    const violations: RuleViolation[] = [];
    const rules = await this.getGroupRules(groupId);

    if (!rules) return violations;

    // Check minimum members to start
    const activeMembers = await this.prisma.groupMembership.count({
      where: { groupId, status: 'ACTIVE' },
    });

    if (activeMembers < rules.minMembersToStart) {
      violations.push({
        rule: 'MIN_MEMBERS_NOT_MET',
        message: `Group needs at least ${rules.minMembersToStart} active members to run a lottery. Currently has ${activeMembers}.`,
        severity: 'ERROR',
      });
    }

    // Check post-win contribution compliance
    if (rules.postWinContributionRequired) {
      const postWinViolations = await this.checkPostWinCompliance(
        groupId,
        cycleId,
      );
      if (postWinViolations.length > 0) {
        violations.push({
          rule: 'POST_WIN_DEFAULT',
          message: `${postWinViolations.length} previous winner(s) have not contributed to this cycle: ${postWinViolations.join(', ')}. They must pay before the draw.`,
          severity: 'WARNING',
        });
      }
    }

    return violations;
  }

  /**
   * Check if previous winners have continued contributing (post-win compliance)
   */
  async checkPostWinCompliance(
    groupId: string,
    cycleId: string,
  ): Promise<string[]> {
    // Get all previous winners in this group
    const previousWinners = await this.prisma.lotteryResult.findMany({
      where: {
        cycle: { groupId },
      },
      include: {
        winner: true,
      },
    });

    if (previousWinners.length === 0) return [];

    // Check which winners have NOT deposited for the current cycle
    const defaultingWinners: string[] = [];

    for (const result of previousWinners) {
      // Check if this winner is still an active member
      const membership = await this.prisma.groupMembership.findFirst({
        where: {
          groupId,
          userId: result.winnerId,
          status: 'ACTIVE',
        },
      });

      if (!membership) continue; // not active, skip

      // Check if they have a verified deposit for this cycle
      const deposit = await this.prisma.deposit.findFirst({
        where: {
          cycleId,
          userId: result.winnerId,
          verificationStatus: 'VERIFIED',
        },
      });

      if (!deposit) {
        defaultingWinners.push(result.winner.name);
      }
    }

    return defaultingWinners;
  }

  // ─── Penalty Calculation ────────────────────────────────────────

  /**
   * Calculate the penalty amount for a given violation
   */
  async calculatePenalty(
    groupId: string,
  ): Promise<PenaltyCalculation | null> {
    const rules = await this.getGroupRules(groupId);

    if (!rules || rules.latePenaltyType === 'NONE') return null;

    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) return null;

    let amount = 0;
    let reason = '';

    switch (rules.latePenaltyType) {
      case 'FIXED':
        amount = rules.latePenaltyAmount ?? 0;
        reason = `Fixed late penalty of ${amount} ETB`;
        break;
      case 'PERCENTAGE':
        const percent = rules.latePenaltyPercent ?? 0;
        amount = (group.contributionAmount * percent) / 100;
        reason = `${percent}% late penalty on ${group.contributionAmount} ETB contribution`;
        break;
    }

    if (amount <= 0) return null;

    return {
      amount,
      type: rules.latePenaltyType,
      reason,
    };
  }

  /**
   * Calculate admin fee for a payout
   */
  async calculateAdminFee(
    groupId: string,
    grossAmount: number,
  ): Promise<number> {
    const rules = await this.getGroupRules(groupId);

    if (!rules || rules.adminFeeType === 'NONE') return 0;

    switch (rules.adminFeeType) {
      case 'FIXED':
        return rules.adminFeeAmount ?? 0;
      case 'PERCENTAGE':
        const percent = rules.adminFeePercent ?? 0;
        return (grossAmount * percent) / 100;
      default:
        return 0;
    }
  }

  /**
   * Calculate payout date based on schedule rules
   */
  async calculatePayoutDate(groupId: string): Promise<Date> {
    const rules = await this.getGroupRules(groupId);
    const now = new Date();

    if (!rules) return now;

    switch (rules.payoutSchedule) {
      case 'IMMEDIATE':
        return now;
      case 'NEXT_DAY':
        const nextDay = new Date(now);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay;
      case 'END_OF_CYCLE': {
        const activeCycle = await this.prisma.cycle.findFirst({
          where: { groupId, status: 'ACTIVE' },
        });
        return activeCycle?.endDate ?? now;
      }
      case 'CUSTOM': {
        const customDate = new Date(now);
        customDate.setDate(
          customDate.getDate() + (rules.payoutDelayDays ?? 0),
        );
        return customDate;
      }
      default:
        return now;
    }
  }

  // ─── Auto-Completion Check ──────────────────────────────────────

  /**
   * Check if all members have won in the current rotation and group should auto-complete
   */
  async shouldAutoCompleteGroup(groupId: string): Promise<boolean> {
    const rules = await this.getGroupRules(groupId);

    if (!rules?.autoCompleteGroup) return false;

    const activeMembers = await this.prisma.groupMembership.findMany({
      where: { groupId, status: 'ACTIVE' },
      select: { userId: true, shares: true },
    });

    if (activeMembers.length === 0) return false;

    // Total positions = sum of all shares
    const totalPositions = activeMembers.reduce(
      (sum, m) => sum + m.shares,
      0,
    );

    const completedDraws = await this.prisma.lotteryResult.count({
      where: {
        cycle: { groupId },
      },
    });

    return completedDraws >= totalPositions;
  }

  /**
   * Count missed payments for a member in a group
   */
  async countMissedPayments(
    groupId: string,
    userId: string,
  ): Promise<number> {
    // Count cycles where the member did NOT have a verified deposit
    const completedCycles = await this.prisma.cycle.findMany({
      where: {
        groupId,
        status: 'COMPLETED',
      },
      select: { id: true },
    });

    let missedCount = 0;
    for (const cycle of completedCycles) {
      const deposit = await this.prisma.deposit.findFirst({
        where: {
          cycleId: cycle.id,
          userId,
          verificationStatus: 'VERIFIED',
        },
      });

      if (!deposit) {
        missedCount++;
      }
    }

    return missedCount;
  }

  /**
   * Check if a member should be auto-suspended/removed based on missed payments
   */
  async shouldAutoSuspendMember(
    groupId: string,
    userId: string,
  ): Promise<{ shouldSuspend: boolean; missedCount: number; maxAllowed: number }> {
    const rules = await this.getGroupRules(groupId);

    if (!rules) {
      return { shouldSuspend: false, missedCount: 0, maxAllowed: 3 };
    }

    const missedCount = await this.countMissedPayments(groupId, userId);

    return {
      shouldSuspend: missedCount >= rules.maxMissedPayments,
      missedCount,
      maxAllowed: rules.maxMissedPayments,
    };
  }

  /**
   * Update reliability score for a user based on their overall payment behavior
   */
  async updateReliabilityScore(userId: string): Promise<number> {
    // Get all memberships
    const memberships = await this.prisma.groupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            cycles: {
              where: { status: 'COMPLETED' },
              select: { id: true },
            },
          },
        },
      },
    });

    let totalCycles = 0;
    let totalPaid = 0;

    for (const membership of memberships) {
      for (const cycle of membership.group.cycles) {
        totalCycles++;
        const deposit = await this.prisma.deposit.findFirst({
          where: {
            cycleId: cycle.id,
            userId,
            verificationStatus: 'VERIFIED',
          },
        });
        if (deposit) totalPaid++;
      }
    }

    // Get penalty count
    const totalPenalties = await this.prisma.penaltyRecord.count({
      where: { userId },
    });

    const unpaidPenalties = await this.prisma.penaltyRecord.count({
      where: { userId, status: 'PENDING' },
    });

    // Calculate score: base 100, minus deductions
    let score = 100;

    if (totalCycles > 0) {
      const paymentRate = totalPaid / totalCycles;
      score = Math.round(paymentRate * 80); // 80% weight for payment rate
    }

    // Deduct for unpaid penalties (-5 each)
    score -= unpaidPenalties * 5;

    // Bonus for no penalties ever (+10)
    if (totalPenalties === 0 && totalCycles > 0) {
      score += 10;
    }

    // Bonus for consistent payments (+10)
    if (totalCycles > 0 && totalPaid === totalCycles) {
      score += 10;
    }

    // Clamp between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Update user
    await this.prisma.user.update({
      where: { id: userId },
      data: { reliabilityScore: score },
    });

    return score;
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private getDeadlineDate(referenceDate: Date, deadlineDay: number): Date {
    const deadline = new Date(referenceDate);
    deadline.setDate(deadlineDay);
    // If deadline day has already passed this month, it's for this month still
    // (we compare against the reference date's month)
    deadline.setHours(23, 59, 59, 999);
    return deadline;
  }
}
