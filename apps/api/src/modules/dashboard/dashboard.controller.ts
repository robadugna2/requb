import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Request() req: any) {
    return this.dashboardService.getStats(req.user);
  }

  @Get('activity')
  getActivity(@Request() req: any) {
    return this.dashboardService.getActivity(req.user);
  }

  @Get('deposits-chart')
  getDepositsChart(@Request() req: any) {
    return this.dashboardService.getDepositsChart(req.user);
  }
}
