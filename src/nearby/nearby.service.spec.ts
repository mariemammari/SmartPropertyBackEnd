import { BadRequestException } from '@nestjs/common';
import { NearbyService } from './nearby.service';

describe('NearbyService', () => {
  let service: NearbyService;

  beforeEach(() => {
    service = new NearbyService();
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('throws for missing coordinates', async () => {
    await expect(service.getNearby(undefined as any, 10)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns empty categories when no POIs found', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ elements: [] }),
      text: async () => '',
    });

    const result = await service.getNearby(10, 10, 500);

    expect(result).toEqual({
      Education: [],
      Transport: [],
      'Dining & Café': [],
      Shopping: [],
      Nature: [],
      Sport: [],
    });
  });
});
