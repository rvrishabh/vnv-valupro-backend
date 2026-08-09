import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ValuationEstimateController } from './valuation-estimate.controller';
import { ValuationEstimateService } from './valuation-estimate.service';
import { ValuationEstimateRepository } from './repositories/valuation-estimate.repository';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [ValuationEstimateController],
  providers: [ValuationEstimateService, ValuationEstimateRepository],
  exports: [ValuationEstimateService, ValuationEstimateRepository],
})
export class ValuationEstimateModule {}
