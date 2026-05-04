import { Test, TestingModule } from '@nestjs/testing';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';

describe('BranchController', () => {
  let controller: BranchController;

  const branchServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BranchController],
      providers: [
        {
          provide: BranchService,
          useValue: branchServiceMock,
        },
      ],
    }).compile();

    controller = module.get<BranchController>(BranchController);
  });

  it('create delegates to service', async () => {
    const dto: any = { name: 'Main' };
    branchServiceMock.create.mockResolvedValueOnce({});

    await controller.create(dto);

    expect(branchServiceMock.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service', async () => {
    branchServiceMock.findAll.mockResolvedValueOnce([]);

    await controller.findAll();

    expect(branchServiceMock.findAll).toHaveBeenCalled();
  });
});
