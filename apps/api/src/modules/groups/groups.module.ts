import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { RulesModule } from './rules.module';
import { DepositsModule } from '../deposits/deposits.module';
import { LotteryModule } from '../lottery/lottery.module';

@Module({
  imports: [DepositsModule, LotteryModule, RulesModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService, RulesModule],
})
export class GroupsModule {}
