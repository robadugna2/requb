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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RuleTemplatesService } from './rule-templates.service';
import {
  CreateRuleTemplateDto,
  UpdateRuleTemplateDto,
} from './dto/create-rule-template.dto';

@Controller('rule-templates')
@UseGuards(JwtAuthGuard)
export class RuleTemplatesController {
  constructor(private readonly ruleTemplatesService: RuleTemplatesService) {}

  @Post()
  create(
    @Body() dto: CreateRuleTemplateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.ruleTemplatesService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.ruleTemplatesService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ruleTemplatesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRuleTemplateDto) {
    return this.ruleTemplatesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ruleTemplatesService.remove(id);
  }

  @Post(':id/apply/:groupId')
  applyToGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
  ) {
    return this.ruleTemplatesService.applyToGroup(id, groupId);
  }
}
