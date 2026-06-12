import { Module } from '@nestjs/common';
import { RulesEnforcementService } from './rules-enforcement.service';
import { PenaltiesService } from './penalties.service';
import { DisputesService } from './disputes.service';
import { GuarantorsService } from './guarantors.service';
import { SharesCalculationService } from './shares-calculation.service';
import { MergedMembersService } from './merged-members.service';
import { FeeWaiversService } from './fee-waivers.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [
    RulesEnforcementService,
    PenaltiesService,
    DisputesService,
    GuarantorsService,
    SharesCalculationService,
    MergedMembersService,
    FeeWaiversService,
  ],
  exports: [
    RulesEnforcementService,
    PenaltiesService,
    DisputesService,
    GuarantorsService,
    SharesCalculationService,
    MergedMembersService,
    FeeWaiversService,
  ],
})
export class RulesModule {}
