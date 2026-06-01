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
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateGroupRulesDto } from './dto/group-rules.dto';
import { DisputeType } from '@prisma/client';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly depositsService: DepositsService,
    private readonly lotteryService: LotteryService,
    private readonly penaltiesService: PenaltiesService,
    private readonly disputesService: DisputesService,
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
}
