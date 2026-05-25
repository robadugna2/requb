import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { DepositsModule } from '../deposits/deposits.module';
import { LotteryModule } from '../lottery/lottery.module';

@Module({
  imports: [DepositsModule, LotteryModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
