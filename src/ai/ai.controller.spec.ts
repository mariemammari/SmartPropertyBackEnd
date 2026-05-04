import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;
  let aiService: AiService;

  // Mock data
  const mockPrompt = 'What is the best property to invest in?';
  const mockHistory = [
    { role: 'user', content: 'Tell me about properties' },
    { role: 'assistant', content: 'I can help with property information' },
  ];
  const mockResponse = 'Based on your criteria, I recommend properties in downtown areas with good appreciation potential.';

  beforeEach(async () => {
    // Create a testing module with mocked AiService
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: AiService,
          useValue: {
            generateResponse: jest.fn(),
            estimateBudget: jest.fn(),
            interpretNavigationCommand: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    // Test Case 1: Should return a response when valid prompt and history are provided
    it('should return a response when valid prompt and history are provided', async () => {
      // Arrange
      const chatBody = {
        prompt: mockPrompt,
        history: mockHistory,
      };
      (aiService.generateResponse as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await controller.chat(chatBody);

      // Assert
      expect(result).toEqual({ response: mockResponse });
      expect(aiService.generateResponse).toHaveBeenCalledWith(mockPrompt, mockHistory);
      expect(aiService.generateResponse).toHaveBeenCalledTimes(1);
    });

    // Test Case 2: Should throw BadRequestException when prompt is missing
    it('should throw BadRequestException when prompt is missing', async () => {
      // Arrange
      const chatBody = {
        prompt: '',
        history: mockHistory,
      };

      // Act & Assert
      await expect(controller.chat(chatBody)).rejects.toThrow(
        new BadRequestException('Prompt is required'),
      );
      expect(aiService.generateResponse).not.toHaveBeenCalled();
    });

    // Test Case 2b: Should throw BadRequestException when prompt is undefined
    it('should throw BadRequestException when prompt is undefined', async () => {
      // Arrange
      const chatBody = {
        prompt: undefined,
        history: mockHistory,
      };

      // Act & Assert
      await expect(controller.chat(chatBody as any)).rejects.toThrow(
        new BadRequestException('Prompt is required'),
      );
      expect(aiService.generateResponse).not.toHaveBeenCalled();
    });

    // Test Case 3: Should handle empty history
    it('should handle empty history by calling service with empty array', async () => {
      // Arrange
      const chatBody = {
        prompt: mockPrompt,
        history: [],
      };
      (aiService.generateResponse as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await controller.chat(chatBody);

      // Assert
      expect(result).toEqual({ response: mockResponse });
      expect(aiService.generateResponse).toHaveBeenCalledWith(mockPrompt, []);
    });

    // Test Case 3b: Should handle missing history by defaulting to empty array
    it('should handle missing history by defaulting to empty array', async () => {
      // Arrange
      const chatBody = {
        prompt: mockPrompt,
      };
      (aiService.generateResponse as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await controller.chat(chatBody);

      // Assert
      expect(result).toEqual({ response: mockResponse });
      expect(aiService.generateResponse).toHaveBeenCalledWith(mockPrompt, []);
    });

    // Test Case 4: Should handle service errors
    it('should propagate service errors by throwing BadRequestException', async () => {
      // Arrange
      const chatBody = {
        prompt: mockPrompt,
        history: mockHistory,
      };
      const serviceError = new Error('AI service is unavailable');
      (aiService.generateResponse as jest.Mock).mockRejectedValue(serviceError);

      // Act & Assert
      await expect(controller.chat(chatBody)).rejects.toThrow(
        new BadRequestException('AI service is unavailable'),
      );
      expect(aiService.generateResponse).toHaveBeenCalledWith(mockPrompt, mockHistory);
    });

    // Test Case 4b: Should handle network errors
    it('should handle network errors gracefully', async () => {
      // Arrange
      const chatBody = {
        prompt: mockPrompt,
        history: mockHistory,
      };
      const networkError = new Error('Network timeout');
      (aiService.generateResponse as jest.Mock).mockRejectedValue(networkError);

      // Act & Assert
      await expect(controller.chat(chatBody)).rejects.toThrow(
        new BadRequestException('Network timeout'),
      );
    });
  });

  describe('estimate', () => {
    // Additional tests for estimate method for completeness
    it('should call estimateBudget with correct parameters', async () => {
      // Arrange
      const estimateBody = { salary: 50000, goal: 'buy' as const };
      const mockEstimate = { budget: 200000, recommendation: 'modest' };
      (aiService.estimateBudget as jest.Mock).mockResolvedValue(mockEstimate);

      // Act
      const result = await controller.estimate(estimateBody);

      // Assert
      expect(result).toEqual({ response: mockEstimate });
      expect(aiService.estimateBudget).toHaveBeenCalledWith(50000, 'buy');
    });

    it('should throw BadRequestException when salary is missing', async () => {
      // Arrange
      const estimateBody = { salary: 0, goal: 'buy' as const };

      // Act & Assert
      await expect(controller.estimate(estimateBody)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when goal is missing', async () => {
      // Arrange
      const estimateBody = { salary: 50000, goal: undefined };

      // Act & Assert
      await expect(controller.estimate(estimateBody as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('navigate', () => {
    // Additional tests for navigate method for completeness
    it('should call interpretNavigationCommand with correct parameters', async () => {
      // Arrange
      const navigateBody = { transcript: 'go to properties' };
      const mockNavResult = { path: '/properties', intent: 'navigate' };
      (aiService.interpretNavigationCommand as jest.Mock).mockResolvedValue(
        mockNavResult,
      );

      // Act
      const result = await controller.navigate(navigateBody);

      // Assert
      expect(result).toEqual(mockNavResult);
      expect(aiService.interpretNavigationCommand).toHaveBeenCalledWith(
        'go to properties',
        'guest',
        '/',
      );
    });

    it('should use provided role and currentPath', async () => {
      // Arrange
      const navigateBody = {
        transcript: 'go back',
        role: 'admin',
        currentPath: '/dashboard',
      };
      const mockNavResult = { path: '/', intent: 'navigate' };
      (aiService.interpretNavigationCommand as jest.Mock).mockResolvedValue(
        mockNavResult,
      );

      // Act
      const result = await controller.navigate(navigateBody);

      // Assert
      expect(result).toEqual(mockNavResult);
      expect(aiService.interpretNavigationCommand).toHaveBeenCalledWith(
        'go back',
        'admin',
        '/dashboard',
      );
    });

    it('should throw BadRequestException when transcript is missing', async () => {
      // Arrange
      const navigateBody = { transcript: '' };

      // Act & Assert
      await expect(controller.navigate(navigateBody)).rejects.toThrow(
        new BadRequestException('Transcript is required'),
      );
    });
  });
});
