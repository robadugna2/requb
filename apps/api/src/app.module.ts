import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GroupsModule } from './modules/groups/groups.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    DepositsModule,
    LotteryModule,
    TelegramModule,
    OcrModule,
    DashboardModule,
  ],
})
export class AppModule {}
