import {
  Controller,
  Get,
  Post,
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
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly depositsService: DepositsService,
    private readonly lotteryService: LotteryService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  create(@Body() createGroupDto: CreateGroupDto, @Request() req: any) {
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
  async triggerLottery(@Param('id') id: string, @Request() req: any) {
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
}
