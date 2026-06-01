import { Module } from '@nestjs/common';
import { RulesEnforcementService } from './rules-enforcement.service';
import { PenaltiesService } from './penalties.service';
import { DisputesService } from './disputes.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [RulesEnforcementService, PenaltiesService, DisputesService],
  exports: [RulesEnforcementService, PenaltiesService, DisputesService],
})
export class RulesModule {}
