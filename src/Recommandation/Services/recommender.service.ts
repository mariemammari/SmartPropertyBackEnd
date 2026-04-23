import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config'; // <-- Importez ceci
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RecommenderService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService // <-- Injectez ceci
  ) {}


// ... reste du code ...


//hana u should verifier ccccccccccca sil ya du code manquant 

  async getRecommendations(userProfile: any) {
    try {
      const aiApiUrl = this.configService.get<string>('AI_ENGINE_URL');
      
      const payload = {
        budgetMin_tnd: userProfile.budgetMin,
        budgetMax_tnd: userProfile.budgetMax,
        preferredPropertyType: userProfile.preferredPropertyType,
        preferredCity: userProfile.preferredCity,
        monthlyIncome_tnd: userProfile.monthlyIncome,
      };

      const response = await lastValueFrom(
        this.httpService.post(`${aiApiUrl}/recommend`, payload)
      );

      return response.data.results;

    } catch (error: any) { // <-- Ajoutez ": any" ici pour corriger l'erreur TS
      // Maintenant vous pouvez accéder à error.response sans erreur
      console.error('Détails de l\'erreur FastAPI:', error.response?.data);
      
      throw new HttpException(
        'Erreur du moteur de recommandation',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


}
