import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminsModule } from './modules/admins/admins.module';
import { GroupsModule } from './modules/groups/groups.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { LotteryModule } from './modules/lottery/lottery.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { RuleTemplatesModule } from './modules/rule-templates/rule-templates.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AdminsModule,
    AuthModule,
    UsersModule,
    GroupsModule,
    DepositsModule,
    LotteryModule,
    TelegramModule,
    OcrModule,
    DashboardModule,
    UploadsModule,
    RuleTemplatesModule,
    NotificationsModule,
  ],
})
export class AppModule {}
