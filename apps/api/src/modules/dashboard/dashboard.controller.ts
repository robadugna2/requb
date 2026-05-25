import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('activity')
  getActivity() {
    return this.dashboardService.getActivity();
  }

  @Get('deposits-chart')
  getDepositsChart() {
    return this.dashboardService.getDepositsChart();
  }
}
