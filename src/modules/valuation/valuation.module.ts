import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CasesModule } from '../cases/cases.module';
import { ValuationRepository } from './repositories/valuation.repository';
import { CircleRateService } from './services/circle-rate.service';
import { PdfService } from './report/pdf.service';
import { ReportService } from './report/report.service';
import { ValuationRatesService } from './services/valuation-rates.service';
import { ValuationController } from './valuation.controller';
import { ValuationService } from './valuation.service';

@Module({
  imports: [forwardRef(() => AuthModule), forwardRef(() => CasesModule)],
  controllers: [ValuationController],
  providers: [
    ValuationService,
    ValuationRepository,
    ValuationRatesService,
    CircleRateService,
    ReportService,
    PdfService,
  ],
  exports: [ValuationService, ValuationRepository],
})
export class ValuationModule {}
