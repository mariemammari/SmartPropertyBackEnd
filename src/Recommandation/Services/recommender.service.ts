import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config'; // <-- Importez ceci
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RecommenderService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService // <-- Injectez ceci
  ) { }


  // ... reste du code ...


  //hana u should verifier ccccccccccca sil ya du code manquant 

  async getRecommendations(userProfile: any, limit = 10) {
    try {
      const recommendationServiceUrl = this.configService.get<string>(
        'RECOMMENDATION_SERVICE_URL'
      );

      if (!recommendationServiceUrl) {
        throw new HttpException(
          'RECOMMENDATION_SERVICE_URL is not set',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10;

      const payload = {
        budgetMin_tnd: userProfile.budgetMin,
        budgetMax_tnd: userProfile.budgetMax,
        preferredPropertyType: userProfile.preferredPropertyType,
        preferredCity: userProfile.preferredCity,
        preferredPurpose: userProfile.preferredPurpose ?? 'rent',
        monthlyIncome_tnd: userProfile.monthlyIncome,
      };

      const response: any = await lastValueFrom(
        this.httpService.post(`${recommendationServiceUrl}/recommend`, payload, {
          params: { limit: safeLimit },
        })
      );

      return response.data.results;

    } catch (error: any) {
      console.error('Recommendation service error:', error.response?.data);

      throw new HttpException(
        'Erreur du moteur de recommandation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


}
