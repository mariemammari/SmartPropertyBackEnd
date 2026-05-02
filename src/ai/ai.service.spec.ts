import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { PropertyService } from '../property/property.service';
import { BranchService } from '../branch/branch.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:8000') },
        },
        { provide: PropertyService, useValue: {} },
        { provide: BranchService, useValue: {} },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call the AI API and return estimated price', async () => {
    const mockData = { type: 'sale', size: 100 };
    const mockResponse = { data: { estimated_price: 250000 } };
    
    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const result = await service.estimatePropertyPrice(mockData);

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/estimate', mockData);
    expect(result.estimated_price).toBe(250000);
  });

  it('should throw an error if the AI API fails', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { data: { detail: 'API Error' } },
    });

    await expect(service.estimatePropertyPrice({})).rejects.toThrow(
      'Failed to estimate price: API Error',
    );
  });
});
