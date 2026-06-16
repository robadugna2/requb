import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AssignGroupDto } from './dto/assign-group.dto';
import { Role, AdminStatus } from '@prisma/client';

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async createAdmin(creatorId: string, creatorRole: Role, dto: CreateAdminDto) {
    // Determine the role of the new admin based on the creator's role
    let newAdminRole: Role;
    if (creatorRole === Role.SUPER_ADMIN) {
      newAdminRole = Role.ADMIN;
    } else if (creatorRole === Role.ADMIN) {
      newAdminRole = Role.SUB_ADMIN;
    } else {
      throw new ForbiddenException('You do not have permission to create admins');
    }

    // Check if email is already taken
    const existingAdmin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });
    if (existingAdmin) {
      throw new ConflictException('Email already registered');
    }



    // Validate group assignments if provided (especially for SUB_ADMIN)
    if (dto.assignedGroups && dto.assignedGroups.length > 0) {
      for (const assignment of dto.assignedGroups) {
        const group = await this.prisma.equbGroup.findUnique({
          where: { id: assignment.groupId },
        });
        if (!group) {
          throw new NotFoundException(`Group with ID ${assignment.groupId} not found`);
        }
        
        // If the creator is an ADMIN, verify they have leadership over this group
        if (creatorRole === Role.ADMIN) {
            const isLeader = await this.prisma.groupLeader.findUnique({
                where: { groupId_adminId: { groupId: assignment.groupId, adminId: creatorId } }
            });
            if (!isLeader) {
                 throw new ForbiddenException(`You can only assign admins to groups you lead. Access denied for group ${assignment.groupId}`);
            }
        }
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const newAdmin = await this.prisma.$transaction(async (prisma) => {
      const created = await prisma.admin.create({
        data: {
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          role: newAdminRole,
          createdById: creatorId,
          status: AdminStatus.ACTIVE,
        },
      });

      if (dto.assignedGroups && dto.assignedGroups.length > 0) {
        const leaderData = dto.assignedGroups.map((g) => ({
          groupId: g.groupId,
          adminId: created.id,
          canManageMembers: g.canManageMembers ?? false,
          canManageDeposits: g.canManageDeposits ?? false,
          canTriggerLottery: g.canTriggerLottery ?? false,
          canManageRules: g.canManageRules ?? false,
        }));
        await prisma.groupLeader.createMany({
          data: leaderData,
        });
      }

      return created;
    });

    const { passwordHash: _, ...result } = newAdmin;
    return result;
  }

  async getAdmins(requesterId: string, requesterRole: Role) {
    const whereClause: any = {};

    if (requesterRole === Role.SUPER_ADMIN) {
        // Super Admin sees all admins and sub-admins
        whereClause.role = { in: [Role.ADMIN, Role.SUB_ADMIN] };
    } else if (requesterRole === Role.ADMIN) {
        // Admin sees only sub-admins they created
        whereClause.createdById = requesterId;
        whereClause.role = Role.SUB_ADMIN;
    } else {
        throw new ForbiddenException('You do not have permission to view admins');
    }

    return this.prisma.admin.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        createdById: true,
        createdBy: {
           select: { id: true, name: true, email: true }
        },
        _count: {
          select: { groupLeadership: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAdminById(id: string, requesterId: string, requesterRole: Role) {
    const admin = await this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        createdById: true,
        createdBy: { select: { id: true, name: true } },
        groupLeadership: {
            include: {
                group: { select: { id: true, name: true, status: true } }
            }
        }
      },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with ID ${id} not found`);
    }

    if (requesterRole === Role.ADMIN && admin.createdById !== requesterId) {
        throw new ForbiddenException('You can only view admins you created');
    }

    return admin;
  }

  async updateAdmin(id: string, requesterId: string, requesterRole: Role, dto: UpdateAdminDto) {
    const admin = await this.getAdminById(id, requesterId, requesterRole); // Also handles permissions

    const dataToUpdate: any = { ...dto };
    
    if (dto.email && dto.email !== admin.email) {
         const existingAdmin = await this.prisma.admin.findUnique({
             where: { email: dto.email },
         });
         if (existingAdmin) {
             throw new ConflictException('Email already registered');
         }
    }

    const updated = await this.prisma.admin.update({
      where: { id },
      data: dataToUpdate,
      select: {
          id: true, name: true, email: true, phone: true, role: true, status: true
      }
    });

    return updated;
  }

  async suspendAdmin(id: string, requesterId: string, requesterRole: Role) {
    await this.getAdminById(id, requesterId, requesterRole); 
    
    return this.prisma.admin.update({
        where: { id },
        data: { status: AdminStatus.SUSPENDED },
        select: { id: true, name: true, status: true }
    });
  }

  async reactivateAdmin(id: string, requesterId: string, requesterRole: Role) {
     if (requesterRole !== Role.SUPER_ADMIN) {
         throw new ForbiddenException('Only SUPER_ADMIN can reactivate suspended admins');
     }
     await this.getAdminById(id, requesterId, requesterRole);
     
     return this.prisma.admin.update({
        where: { id },
        data: { status: AdminStatus.ACTIVE },
        select: { id: true, name: true, status: true }
    });
  }

  async deleteAdmin(id: string, requesterId: string, requesterRole: Role) {
    if (requesterRole !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Only SUPER_ADMIN can permanently delete admins');
    }
    
    const admin = await this.getAdminById(id, requesterId, requesterRole);
    
    return this.prisma.admin.delete({
        where: { id }
    });
  }

  async assignSubAdminToGroup(subAdminId: string, requesterId: string, requesterRole: Role, dto: AssignGroupDto) {
      if (requesterRole !== Role.ADMIN && requesterRole !== Role.SUPER_ADMIN) {
          throw new ForbiddenException('Only ADMINs or SUPER_ADMINs can assign SUB_ADMINs to groups');
      }

      const subAdmin = await this.getAdminById(subAdminId, requesterId, requesterRole);
      
      if (subAdmin.role !== Role.SUB_ADMIN) {
          throw new BadRequestException('Can only assign SUB_ADMINs to groups through this endpoint');
      }

      // Verify the group exists
      const group = await this.prisma.equbGroup.findUnique({
          where: { id: dto.groupId },
      });
      if (!group) {
          throw new NotFoundException(`Group with ID ${dto.groupId} not found`);
      }

      // For standard ADMINs: verify they own or lead this group
      if (requesterRole === Role.ADMIN) {
          const isOwner = group.createdById === requesterId;
          const isLeader = await this.prisma.groupLeader.findUnique({
              where: { groupId_adminId: { groupId: dto.groupId, adminId: requesterId } }
          });
          if (!isOwner && !isLeader) {
              throw new ForbiddenException('You can only assign sub-admins to groups you created or manage');
          }
      }

      return this.prisma.groupLeader.upsert({
          where: { groupId_adminId: { groupId: dto.groupId, adminId: subAdminId } },
          create: {
              groupId: dto.groupId,
              adminId: subAdminId,
              canManageMembers: dto.canManageMembers ?? false,
              canManageDeposits: dto.canManageDeposits ?? false,
              canTriggerLottery: dto.canTriggerLottery ?? false,
              canManageRules: dto.canManageRules ?? false,
          },
          update: {
              canManageMembers: dto.canManageMembers ?? false,
              canManageDeposits: dto.canManageDeposits ?? false,
              canTriggerLottery: dto.canTriggerLottery ?? false,
              canManageRules: dto.canManageRules ?? false,
          }
      });
  }

  async removeSubAdminFromGroup(subAdminId: string, groupId: string, requesterId: string, requesterRole: Role) {
      if (requesterRole !== Role.ADMIN && requesterRole !== Role.SUPER_ADMIN) {
          throw new ForbiddenException('Only ADMINs or SUPER_ADMINs can remove SUB_ADMINs from groups');
      }

      await this.getAdminById(subAdminId, requesterId, requesterRole); // Ownership check

      // For standard ADMINs: verify they own or lead this group
      if (requesterRole === Role.ADMIN) {
          const group = await this.prisma.equbGroup.findUnique({ where: { id: groupId } });
          const isOwner = group?.createdById === requesterId;
          const isLeader = await this.prisma.groupLeader.findUnique({
            where: { groupId_adminId: { groupId, adminId: requesterId } }
          });
          if (!isOwner && !isLeader) {
            throw new ForbiddenException('You do not have access to this group');
          }
      }

      // Check if the subadmin is actually assigned to this group
      const assignment = await this.prisma.groupLeader.findUnique({
          where: { groupId_adminId: { groupId, adminId: subAdminId } }
      });

      if (!assignment) {
          throw new NotFoundException('Sub-admin is not assigned to this group');
      }

      return this.prisma.groupLeader.delete({
          where: { groupId_adminId: { groupId, adminId: subAdminId } }
      });
  }
}
