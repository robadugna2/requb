import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: createUserDto.phone },
    });

    if (existingUser) {
      throw new ConflictException('A user with this phone number already exists');
    }

    if (createUserDto.telegramId) {
      const existingTelegram = await this.prisma.user.findUnique({
        where: { telegramId: createUserDto.telegramId },
      });
      if (existingTelegram) {
        throw new ConflictException('A user with this Telegram ID already exists');
      }
    }

    return this.prisma.user.create({
      data: createUserDto,
      include: {
        memberships: {
          include: { group: true },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        memberships: {
          include: { group: true },
        },
        deposits: {
          select: { amount: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { group: true },
        },
        deposits: {
          orderBy: { createdAt: 'desc' },
          include: {
            cycle: {
              include: { group: true },
            },
          },
        },
        lotteryWins: {
          orderBy: { drawnAt: 'desc' },
          include: {
            cycle: {
              include: { group: true },
            },
          },
        },
        cyclesWon: {
          orderBy: { startDate: 'desc' },
          include: { group: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id);

    if (updateUserDto.phone) {
      const existingUser = await this.prisma.user.findFirst({
        where: { phone: updateUserDto.phone, NOT: { id } },
      });
      if (existingUser) {
        throw new ConflictException('A user with this phone number already exists');
      }
    }

    if (updateUserDto.telegramId) {
      const existingTelegram = await this.prisma.user.findFirst({
        where: { telegramId: updateUserDto.telegramId, NOT: { id } },
      });
      if (existingTelegram) {
        throw new ConflictException('A user with this Telegram ID already exists');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      include: {
        memberships: {
          include: { group: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async removeWithPassword(id: string, adminId: string, password: string) {
    if (!password) {
      throw new UnauthorizedException('Password is required');
    }

    await this.findOne(id);

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid admin password');
    }

    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        memberships: {
          include: { group: true },
        },
      },
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
    });
  }
}
