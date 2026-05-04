import { Test, TestingModule } from '@nestjs/testing';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

describe('FinanceController', () => {
    let controller: FinanceController;

    const financeServiceMock = {
        createInvoice: jest.fn(),
        findAll: jest.fn(),
        findByAccountantId: jest.fn(),
        getStats: jest.fn(),
        findOne: jest.fn(),
        getInvoicePdfUrl: jest.fn(),
        updateInvoice: jest.fn(),
        deleteInvoice: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            controllers: [FinanceController],
            providers: [
                {
                    provide: FinanceService,
                    useValue: financeServiceMock,
                },
            ],
        }).compile();

        controller = module.get<FinanceController>(FinanceController);
    });

    it('create uses accountant id from request', async () => {
        const req: any = { user: { userId: 'acc-1' } };
        financeServiceMock.createInvoice.mockResolvedValueOnce({});

        await controller.create({ note: 'x' } as any, req);

        expect(financeServiceMock.createInvoice).toHaveBeenCalledWith(
            { note: 'x' },
            'acc-1',
        );
    });

    it('findAll uses accountant id from request', async () => {
        const req: any = { user: { userId: 'acc-2' } };
        financeServiceMock.findAll.mockResolvedValueOnce([]);

        await controller.findAll(req);

        expect(financeServiceMock.findAll).toHaveBeenCalledWith('acc-2');
    });

    it('findByAccountantId passes param', async () => {
        financeServiceMock.findByAccountantId.mockResolvedValueOnce([]);

        await controller.findByAccountantId('acc-3');

        expect(financeServiceMock.findByAccountantId).toHaveBeenCalledWith('acc-3');
    });
});
