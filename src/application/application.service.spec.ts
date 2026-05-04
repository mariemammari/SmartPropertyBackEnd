import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationService } from './application.service';
import { getModelToken } from '@nestjs/mongoose';
import { Application } from './schemas/application.schema';
import { SolvencyService } from './solvency.service';
import { ApplicationStatus } from './schemas/application.schema';

describe('ApplicationService', () => {
  let service: ApplicationService;

  const mockApplicationModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const mockSolvencyService = {
    analyzeAndPersist: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationService,
        {
          provide: getModelToken(Application.name),
          useValue: mockApplicationModel,
        },
        {
          provide: SolvencyService,
          useValue: mockSolvencyService,
        },
      ],
    }).compile();

    service = module.get<ApplicationService>(ApplicationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should allow accept/reject updates (basic test)', async () => {
    // Just a placeholder test to validate the task
    const mockApplication = { _id: '1', status: ApplicationStatus.PENDING };
    mockApplicationModel.findByIdAndUpdate.mockResolvedValue({
      ...mockApplication,
      status: ApplicationStatus.APPROVED
    });

    const result = await service.updateStatus('1', { status: ApplicationStatus.APPROVED });
    expect(mockApplicationModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
