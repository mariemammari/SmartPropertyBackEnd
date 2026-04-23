import { Controller, Post, Body, Param, Get, HttpException, HttpStatus } from '@nestjs/common';
import { CreatePreferenceDto } from './dtos/create-preference.dto';
import { UserPreferenceService } from './Services/UserPreferenceService';
import { RecommenderService } from './Services/recommender.service';

@Controller('user-preferences')
export class UserPreferenceController {
  constructor(
    private readonly preferenceService: UserPreferenceService,
    private readonly recommenderService: RecommenderService,
  ) {}

  // 1. Enregistrer ou mettre à jour les préférences (POST)
  @Post(':userId')
  async save(@Param('userId') userId: string, @Body() dto: CreatePreferenceDto) {
    return this.preferenceService.savePreferences(userId, dto);
  }

  // 2. Récupérer les préférences actuelles (GET)
  @Get(':userId')
  async get(@Param('userId') userId: string) {
    const preferences = await this.preferenceService.getPreferences(userId);
    if (!preferences) {
      throw new HttpException("Préférences non trouvées", HttpStatus.NOT_FOUND);
    }
    return preferences;
  }

  // 3. Obtenir les recommandations personnalisées de l'IA (GET)
  @Get(':userId/ai-recommendations')
  async getAiRecommendations(@Param('userId') userId: string) {
    // On récupère d'abord les préférences en base
    const preferences = await this.preferenceService.getPreferences(userId);

    if (!preferences) {
      throw new HttpException(
        "Profil incomplet. Veuillez d'abord remplir vos préférences.",
        HttpStatus.NOT_FOUND,
      );
    }

    // On envoie les préférences au moteur IA (FastAPI)
    return this.recommenderService.getRecommendations(preferences);
  }
}
