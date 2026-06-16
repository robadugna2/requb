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
} from '@nestjs/common';
import { AdminsService } from './admins.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AssignGroupDto } from './dto/assign-group.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admins')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminsController {
  constructor(private readonly adminsService: AdminsService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  createAdmin(@Request() req: any, @Body() dto: CreateAdminDto) {
    return this.adminsService.createAdmin(req.user.id, req.user.role, dto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getAdmins(@Request() req: any) {
    return this.adminsService.getAdmins(req.user.id, req.user.role);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  getAdminById(@Request() req: any, @Param('id') id: string) {
    return this.adminsService.getAdminById(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  updateAdmin(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminsService.updateAdmin(id, req.user.id, req.user.role, dto);
  }

  @Post(':id/suspend')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  suspendAdmin(@Request() req: any, @Param('id') id: string) {
    return this.adminsService.suspendAdmin(id, req.user.id, req.user.role);
  }

  @Post(':id/reactivate')
  @Roles(Role.SUPER_ADMIN)
  reactivateAdmin(@Request() req: any, @Param('id') id: string) {
    return this.adminsService.reactivateAdmin(id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  deleteAdmin(@Request() req: any, @Param('id') id: string) {
    return this.adminsService.deleteAdmin(id, req.user.id, req.user.role);
  }

  @Post(':id/groups')
  @Roles(Role.ADMIN)
  assignGroup(@Request() req: any, @Param('id') id: string, @Body() dto: AssignGroupDto) {
    return this.adminsService.assignSubAdminToGroup(id, req.user.id, req.user.role, dto);
  }

  @Delete(':id/groups/:groupId')
  @Roles(Role.ADMIN)
  removeGroup(@Request() req: any, @Param('id') id: string, @Param('groupId') groupId: string) {
    return this.adminsService.removeSubAdminFromGroup(id, groupId, req.user.id, req.user.role);
  }
}
