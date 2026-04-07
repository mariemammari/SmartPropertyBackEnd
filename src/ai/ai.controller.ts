import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @Body()
    body: {
      prompt: string;
      history?: { role: string; content: string }[];
    },
  ) {
    const { prompt, history } = body;
    if (!prompt) {
      throw new BadRequestException('Prompt is required');
    }

    try {
      const response = await this.aiService.generateResponse(
        prompt,
        history || [],
      );
      return { response };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('estimate')
  async estimate(@Body() body: { salary: number; goal: 'buy' | 'rent' }) {
    const { salary, goal } = body;
    if (!salary || !goal) {
      throw new BadRequestException('Salary and goal are required');
    }

    try {
      const response = await this.aiService.estimateBudget(salary, goal);
      return { response };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('navigate')
  async navigate(
    @Body() body: { transcript: string; role?: string; currentPath?: string },
  ) {
    const { transcript, role, currentPath } = body;
    if (!transcript) {
      throw new BadRequestException('Transcript is required');
    }

    try {
      const result = await this.aiService.interpretNavigationCommand(
        transcript,
        role || 'guest',
        currentPath || '/',
      );
      return result;
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
