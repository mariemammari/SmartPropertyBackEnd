import { BranchService } from './branch.service';

describe('BranchService', () => {
    let service: BranchService;

    const branchModelMock = Object.assign(
        jest.fn().mockImplementation((data: unknown) => ({
            save: jest.fn().mockResolvedValue(data),
        })),
        {
            find: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndDelete: jest.fn(),
        },
    );

    beforeEach(() => {
        jest.clearAllMocks();
        service = new BranchService(branchModelMock as any);
    });

    it('create saves branch', async () => {
        await service.create({ name: 'Main' } as any);

        expect(branchModelMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Main' }),
        );
    });

    it('findAll returns list', async () => {
        branchModelMock.find.mockReturnValueOnce({
            exec: jest.fn().mockResolvedValue([{ _id: 'b1' }]),
        });

        const result = await service.findAll();

        expect(result).toEqual([{ _id: 'b1' }]);
    });
});
