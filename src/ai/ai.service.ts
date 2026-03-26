import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private groq: Groq;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    } else {
      this.logger.warn('GROQ_API_KEY not found in environment variables');
    }
  }

  async generateResponse(prompt: string, history: { role: string; content: string }[] = []) {
    if (!this.groq) {
      throw new Error('Groq AI not initialized. Please check your API key.');
    }

    try {
      this.logger.log(`Generating response via Groq...`);
      
      const messages: any[] = history.map(h => ({
        role: (h.role === 'bot' || h.role === 'model' ? 'assistant' : 'user') as "assistant" | "user",
        content: h.content,
      }));

      // Add system prompt for persona
      const systemPrompt = {
        role: 'system' as const,
        content: "Tu es un expert immobilier tunisien pour l'agence SmartProperty. Tu aides les clients à estimer leur budget d'achat ou de location de manière courtoise et professionnelle. Réponds de manière concise."
      };

      const completion = await this.groq.chat.completions.create({
        messages: [systemPrompt, ...messages, { role: 'user' as const, content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 1024,
      });

      return completion.choices[0]?.message?.content || "Désolé, je ne peux pas répondre pour le moment.";
    } catch (error) {
      this.logger.error(`Error generating response from Groq: ${error.message}`);
      throw error;
    }
  }

  async estimateBudget(salary: number, goal: 'buy' | 'rent') {
    const prompt = `Mon salaire est de ${salary} DT et je souhaite ${goal === 'buy' ? 'acheter' : 'louer'}. Donne une estimation de ma capacité financière.`;
    return this.generateResponse(prompt);
  }
}
