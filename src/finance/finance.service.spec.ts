import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  it('createInvoice throws when required fields are missing', async () => {
    const service = new FinanceService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.createInvoice({} as any)).rejects.toThrow(
      BadRequestException,
    );
  });
});
