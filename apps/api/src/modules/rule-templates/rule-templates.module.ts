import { Module } from '@nestjs/common';
import { RuleTemplatesController } from './rule-templates.controller';
import { RuleTemplatesService } from './rule-templates.service';

@Module({
  controllers: [RuleTemplatesController],
  providers: [RuleTemplatesService],
  exports: [RuleTemplatesService],
})
export class RuleTemplatesModule {}
