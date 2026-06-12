import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupsService } from './groups.service';
import { DepositsService } from '../deposits/deposits.service';
import { LotteryService } from '../lottery/lottery.service';
import { PenaltiesService } from './penalties.service';
import { DisputesService } from './disputes.service';
import { GuarantorsService } from './guarantors.service';
import { SharesCalculationService } from './shares-calculation.service';
import { MergedMembersService } from './merged-members.service';
import { FeeWaiversService } from './fee-waivers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateGroupRulesDto } from './dto/group-rules.dto';
import { DisputeType, GuarantorStatus } from '@prisma/client';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly depositsService: DepositsService,
    private readonly lotteryService: LotteryService,
    private readonly penaltiesService: PenaltiesService,
    private readonly disputesService: DisputesService,
    private readonly guarantorsService: GuarantorsService,
    private readonly sharesCalculation: SharesCalculationService,
    private readonly mergedMembersService: MergedMembersService,
    private readonly feeWaiversService: FeeWaiversService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(@Body() createGroupDto: CreateGroupDto, @Request() req: { user: { id: string } }) {
    return this.groupsService.create(createGroupDto, req.user.id);
  }

  @Get()
  findAll() {
    return this.groupsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGroupDto: UpdateGroupDto) {
    return this.groupsService.update(id, updateGroupDto);
  }

  @Get(':id/rules')
  getGroupRules(@Param('id') id: string) {
    return this.groupsService.getGroupRules(id);
  }

  @Put(':id/rules')
  updateGroupRules(@Param('id') id: string, @Body() dto: UpdateGroupRulesDto) {
    return this.groupsService.updateGroupRules(id, dto);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body('userId') userId: string) {
    return this.groupsService.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.groupsService.removeMember(id, userId);
  }

  @Post(':id/cycles')
  createCycle(@Param('id') id: string) {
    return this.groupsService.createCycle(id);
  }

  @Get(':id/deposits')
  getDeposits(@Param('id') id: string) {
    return this.depositsService.findAll({ groupId: id });
  }

  @Post(':id/lottery')
  async triggerLottery(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    const activeCycle = await this.prisma.cycle.findFirst({
      where: {
        groupId: id,
        status: 'ACTIVE',
      },
    });

    if (!activeCycle) {
      throw new NotFoundException(`No active cycle found for group with ID ${id}`);
    }

    return this.lotteryService.drawWinner(activeCycle.id, req.user.id);
  }

  // ─── Penalty Endpoints ──────────────────────────────────────────

  @Get(':id/penalties')
  getGroupPenalties(@Param('id') id: string) {
    return this.penaltiesService.findGroupPenalties(id);
  }

  @Patch('penalties/:penaltyId/pay')
  payPenalty(@Param('penaltyId') penaltyId: string) {
    return this.penaltiesService.payPenalty(penaltyId);
  }

  @Patch('penalties/:penaltyId/waive')
  waivePenalty(
    @Param('penaltyId') penaltyId: string,
    @Request() req: { user: { id: string } },
    @Body('notes') notes?: string,
  ) {
    return this.penaltiesService.waivePenalty(penaltyId, req.user.id, notes);
  }

  // ─── Dispute Endpoints ──────────────────────────────────────────

  @Post(':id/disputes')
  fileDispute(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { againstUserId?: string; type: DisputeType; description: string },
  ) {
    return this.disputesService.fileDispute({
      groupId: id,
      filedByUserId: req.user.id,
      againstUserId: body.againstUserId,
      type: body.type,
      description: body.description,
    });
  }

  @Get(':id/disputes')
  getGroupDisputes(@Param('id') id: string) {
    return this.disputesService.getGroupDisputes(id);
  }

  @Patch('disputes/:disputeId/resolve')
  resolveDispute(
    @Param('disputeId') disputeId: string,
    @Request() req: { user: { id: string } },
    @Body() body: { resolution: string; status?: any },
  ) {
    return this.disputesService.resolveDispute(disputeId, req.user.id, body);
  }

  // ─── Guarantor Endpoints ────────────────────────────────────────

  @Get(':id/guarantors')
  getGroupGuarantors(@Param('id') id: string) {
    return this.guarantorsService.findGroupGuarantors(id);
  }

  @Post(':id/guarantors')
  addGuarantor(
    @Param('id') id: string,
    @Body() body: { guarantorUserId: string; guaranteedUserId: string; notes?: string },
  ) {
    return this.guarantorsService.createGuarantor({
      groupId: id,
      guarantorUserId: body.guarantorUserId,
      guaranteedUserId: body.guaranteedUserId,
      notes: body.notes,
    });
  }

  @Patch('guarantors/:guarantorId/status')
  updateGuarantorStatus(
    @Param('guarantorId') guarantorId: string,
    @Body() body: { status: GuarantorStatus; notes?: string },
  ) {
    return this.guarantorsService.updateStatus(guarantorId, body.status, body.notes);
  }

  @Delete('guarantors/:guarantorId')
  deleteGuarantor(@Param('guarantorId') guarantorId: string) {
    return this.guarantorsService.deleteGuarantor(guarantorId);
  }

  // ─── Shares & Dues Calculation ──────────────────────────────────

  @Get(':id/member-dues')
  getGroupMemberDues(@Param('id') id: string) {
    return this.sharesCalculation.calculateAllMemberDues(id);
  }

  @Get(':id/member-dues/:userId')
  getMemberDue(@Param('id') id: string, @Param('userId') userId: string) {
    return this.sharesCalculation.calculateMemberDue(id, userId);
  }

  @Patch(':id/members/:userId/shares')
  async updateMemberShares(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('shares') shares: number,
  ) {
    return this.prisma.groupMembership.update({
      where: { groupId_userId: { groupId: id, userId } },
      data: { shares },
      include: { user: true },
    });
  }

  // ─── Merged Members Endpoints ───────────────────────────────────

  @Get(':id/merged-groups')
  getMergedGroups(@Param('id') id: string) {
    return this.mergedMembersService.getMergedGroupsByGroup(id);
  }

  @Post(':id/merged-groups')
  createMergedGroup(
    @Param('id') id: string,
    @Body() body: { name?: string; userIds: string[]; totalShares?: number },
  ) {
    return this.mergedMembersService.createMergedGroup({
      groupId: id,
      name: body.name,
      userIds: body.userIds,
      totalShares: body.totalShares,
    });
  }

  @Get('merged-groups/:mergedGroupId')
  getMergedGroupDetail(@Param('mergedGroupId') mergedGroupId: string) {
    return this.mergedMembersService.getMergedGroupDetail(mergedGroupId);
  }

  @Post('merged-groups/:mergedGroupId/members')
  addMergedGroupMember(
    @Param('mergedGroupId') mergedGroupId: string,
    @Body('userId') userId: string,
  ) {
    return this.mergedMembersService.addMemberToMergedGroup(mergedGroupId, userId);
  }

  @Delete('merged-groups/:mergedGroupId/members/:userId')
  removeMergedGroupMember(
    @Param('mergedGroupId') mergedGroupId: string,
    @Param('userId') userId: string,
  ) {
    return this.mergedMembersService.removeMemberFromMergedGroup(mergedGroupId, userId, true);
  }

  @Post('merged-groups/:mergedGroupId/dissolve')
  dissolveMergedGroup(@Param('mergedGroupId') mergedGroupId: string) {
    return this.mergedMembersService.dissolveMergedGroup(mergedGroupId);
  }

  @Patch('merged-groups/:mergedGroupId/percentages')
  updateMergedGroupPercentages(
    @Param('mergedGroupId') mergedGroupId: string,
    @Body('percentages') percentages: Array<{ userId: string; sharePercentage: number }>,
  ) {
    return this.mergedMembersService.updateSlotPercentages(mergedGroupId, percentages);
  }

  @Get('merged-groups/:mergedGroupId/deposit-status')
  getMergedGroupDepositStatus(@Param('mergedGroupId') mergedGroupId: string) {
    return this.mergedMembersService.getMergedGroupDepositStatus(mergedGroupId);
  }

  @Get('merged-groups/:mergedGroupId/deposit-history')
  getMergedGroupDepositHistory(@Param('mergedGroupId') mergedGroupId: string) {
    return this.mergedMembersService.getMergedGroupDepositHistory(mergedGroupId);
  }

  @Post('merged-groups/:mergedGroupId/enforce-compliance')
  enforceMergedMemberCompliance(@Param('mergedGroupId') mergedGroupId: string) {
    return this.mergedMembersService.enforceMergedMemberCompliance(mergedGroupId);
  }

  // ─── Fee Waiver Endpoints ───────────────────────────────────────

  @Get(':id/fee-waivers')
  getGroupFeeWaivers(@Param('id') id: string) {
    return this.feeWaiversService.getGroupWaivers(id);
  }

  @Post(':id/fee-waivers')
  grantFeeWaiver(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() body: { userId: string; reason: string; durationCycles: number },
  ) {
    return this.feeWaiversService.grantWaiver({
      groupId: id,
      userId: body.userId,
      reason: body.reason,
      durationCycles: body.durationCycles,
      grantedBy: req.user.id,
    });
  }

  @Patch('fee-waivers/:waiverId/cancel')
  cancelFeeWaiver(
    @Param('waiverId') waiverId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.feeWaiversService.cancelWaiver(waiverId, req.user.id);
  }
}
