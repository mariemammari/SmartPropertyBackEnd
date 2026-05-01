import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { RunSolvencyAnalysisDto } from './dto/run-solvency-analysis.dto';
import { SolvencyService } from './solvency.service';

@Controller('solvency')
export class SolvencyController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Post('application/:applicationId/analyze')
  async analyzeApplication(
    @Param('applicationId') applicationId: string,
    @Body() dto: RunSolvencyAnalysisDto,
  ) {
    const app = await this.solvencyService.analyzeAndPersist(
      applicationId,
      dto?.force ?? false,
    );

    return {
      applicationId: app._id,
      solvencyStatus: app.solvencyStatus,
      solvencyLastRunAt: app.solvencyLastRunAt,
      solvencyError: app.solvencyError,
      solvencyAnalysis: app.solvencyAnalysis,
    };
  }

  @Get('application/:applicationId')
  async getApplicationSolvency(@Param('applicationId') applicationId: string) {
    const app = await this.solvencyService.getApplicationWithSolvency(applicationId);
    return {
      applicationId: app._id,
      status: app.status,
      solvencyStatus: app.solvencyStatus,
      solvencyLastRunAt: app.solvencyLastRunAt,
      solvencyError: app.solvencyError,
      solvencyAnalysis: app.solvencyAnalysis,
    };
  }

  @Post('application/:applicationId/apply-recommendation')
  async applyRecommendation(@Param('applicationId') applicationId: string) {
    const app = await this.solvencyService.applyRecommendationToApplication(
      applicationId,
    );

    if (!app) {
      throw new BadRequestException('Could not apply recommendation');
    }

    return {
      applicationId: app._id,
      status: app.status,
      rejectionType: app.rejectionType,
      rejectionReason: app.rejectionReason,
      improveChecklist: app.improveChecklist || [],
      recommendation: app.solvencyAnalysis?.recommendation || null,
    };
  }
}
