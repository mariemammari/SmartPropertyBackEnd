import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import axios from 'axios';
import Groq from 'groq-sdk';
import { Model, Types } from 'mongoose';
import {
  Application,
  ApplicationDocument,
  ApplicationStatus,
  RejectionType,
  SolvencyAnalysisStatus,
  SolvencyRecommendation,
} from './schemas/application.schema';
import { Property, PropertyDocument } from '../property/schemas/property.schema';

type FraudFlag =
  | 'NAME_MISMATCH'
  | 'INCOME_MISMATCH'
  | 'MISSING_NAME_IN_DOCUMENT'
  | 'MISSING_INCOME_IN_DOCUMENT'
  | 'OCR_LOW_CONFIDENCE'
  | 'ZERO_DECLARED_INCOME'
  | 'HIGH_AFFORDABILITY_RATIO'
  | 'DOCUMENT_REUSED_BY_ANOTHER_CLIENT'
  | 'OCCUPATION_SUSPICIOUS'
  | 'OCCUPATION_MISSING';

type OccupationAssessment = {
  status: 'VALID' | 'SUSPICIOUS' | 'MISSING';
  score: number;
  reason: string;
  normalizedOccupation: string;
};

type SolvencyCheck = {
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  note?: string;
};

type OcrResult = {
  provider: 'ocr_space' | 'none';
  text: string;
  confidence: number;
  extractedFullName?: string;
  extractedMonthlyIncome?: number;
};

@Injectable()
export class SolvencyService {
  private readonly logger = new Logger(SolvencyService.name);
  private readonly modelVersion = 'solvency-v2';
  private groq?: Groq;

  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<ApplicationDocument>,
    @InjectModel(Property.name)
    private readonly propertyModel: Model<PropertyDocument>,
    private readonly configService: ConfigService,
  ) {
    const groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    if (groqApiKey) {
      this.groq = new Groq({ apiKey: groqApiKey });
    }
  }

  async getApplicationWithSolvency(
    applicationId: string,
  ): Promise<ApplicationDocument> {
    const app = await this.applicationModel
      .findById(applicationId)
      .populate(
        'propertyId',
        'title propertyType propertySubType price type city state size address location image images monthlyCharges',
      )
      .exec();

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    return app;
  }

  async analyzeAndPersist(
    applicationId: string,
    force = false,
  ): Promise<ApplicationDocument> {
    const app = await this.getApplicationWithSolvency(applicationId);

    if (
      !force &&
      app.solvencyStatus === SolvencyAnalysisStatus.COMPLETED &&
      app.solvencyAnalysis
    ) {
      return app;
    }

    if (!app.documentUrl) {
      throw new NotFoundException(
        'Application documentUrl is required before solvency analysis',
      );
    }

    await this.applicationModel.findByIdAndUpdate(applicationId, {
      $set: {
        solvencyStatus: SolvencyAnalysisStatus.PROCESSING,
        solvencyError: undefined,
      },
    });

    try {
      const propertyId =
        typeof app.propertyId === 'object' && (app.propertyId as any)?._id
          ? String((app.propertyId as any)._id)
          : String(app.propertyId || '');

      const property = propertyId
        ? await this.propertyModel.findById(propertyId).lean().exec()
        : null;

      const ocr = await this.extractFromDocumentUrl(app.documentUrl);
      const declaredMonthlyIncome = Number(app.monthlyIncome || 0);
      const monthlyPropertyCost = this.computeMonthlyPropertyCost(property);
      const affordabilityRatio =
        declaredMonthlyIncome > 0
          ? monthlyPropertyCost / declaredMonthlyIncome
          : null;

      const nameMatchScore = this.compareNames(
        app.fullName || '',
        ocr.extractedFullName || '',
      );

      const incomeMismatchPercent =
        declaredMonthlyIncome > 0 && ocr.extractedMonthlyIncome
          ? Math.abs(ocr.extractedMonthlyIncome - declaredMonthlyIncome) /
            declaredMonthlyIncome
          : null;

      const occupationAssessment = await this.evaluateOccupationQuality(
        String(app.occupation || ''),
      );

      const reusedByOtherClient = await this.isDocumentReusedByAnotherClient(
        applicationId,
        app.documentUrl,
        String(app.clientId || ''),
      );

      const fraudFlags = this.buildFraudFlags({
        ocr,
        declaredMonthlyIncome,
        nameMatchScore,
        incomeMismatchPercent,
        affordabilityRatio,
        reusedByOtherClient,
        occupationAssessment,
      });

      const checks = this.buildChecks({
        appFullName: app.fullName || '',
        extractedName: ocr.extractedFullName,
        declaredMonthlyIncome,
        extractedMonthlyIncome: ocr.extractedMonthlyIncome,
        affordabilityRatio,
        ocrConfidence: ocr.confidence,
        occupation: app.occupation,
        occupationAssessment,
      });

      const riskScore = this.computeRiskScore({
        affordabilityRatio,
        declaredMonthlyIncome,
        employmentStatus: app.employmentStatus,
        nameMatchScore,
        incomeMismatchPercent,
        ocrConfidence: ocr.confidence,
        fraudFlags,
        occupationAssessment,
      });

      const recommendation = this.pickRecommendation(riskScore, fraudFlags);
      const aiOpinion = await this.generateAiOpinion({
        recommendation,
        riskScore,
        affordabilityRatio,
        fraudFlags,
        declaredMonthlyIncome,
        extractedMonthlyIncome: ocr.extractedMonthlyIncome,
        occupationAssessment,
      });

      const analysis = {
        provider: ocr.provider,
        ocrConfidence: Number((ocr.confidence * 100).toFixed(2)),
        extractedFullName: ocr.extractedFullName || null,
        extractedMonthlyIncome: ocr.extractedMonthlyIncome || null,
        declaredMonthlyIncome: declaredMonthlyIncome || null,
        incomeMismatchPercent:
          incomeMismatchPercent === null
            ? null
            : Number((incomeMismatchPercent * 100).toFixed(2)),
        nameMatchScore: Number((nameMatchScore * 100).toFixed(2)),
        monthlyPropertyCost: Number(monthlyPropertyCost.toFixed(2)),
        affordabilityRatio:
          affordabilityRatio === null
            ? null
            : Number((affordabilityRatio * 100).toFixed(2)),
        riskScore,
        recommendation,
        fraudFlags,
        occupationAssessment,
        checks,
        summary: aiOpinion,
        documentTextExcerpt: this.extractExcerpt(ocr.text),
        analyzedAt: new Date(),
        modelVersion: this.modelVersion,
      };

      const updated = await this.applicationModel
        .findByIdAndUpdate(
          applicationId,
          {
            $set: {
              solvencyStatus: SolvencyAnalysisStatus.COMPLETED,
              solvencyLastRunAt: new Date(),
              solvencyError: undefined,
              solvencyAnalysis: analysis,
            },
          },
          { new: true },
        )
        .populate(
          'propertyId',
          'title propertyType propertySubType price type city state size address location image images monthlyCharges',
        )
        .exec();

      if (!updated) {
        throw new NotFoundException('Application not found after analysis update');
      }

      return updated;
    } catch (error: any) {
      const message = this.toErrorMessage(error);

      await this.applicationModel.findByIdAndUpdate(applicationId, {
        $set: {
          solvencyStatus: SolvencyAnalysisStatus.FAILED,
          solvencyLastRunAt: new Date(),
          solvencyError: message,
        },
      });

      this.logger.error(`Solvency analysis failed: ${message}`);
      throw error;
    }
  }

  async applyRecommendationToApplication(
    applicationId: string,
  ): Promise<ApplicationDocument> {
    const app = await this.getApplicationWithSolvency(applicationId);

    const recommendation = app?.solvencyAnalysis?.recommendation;
    if (!recommendation) {
      throw new NotFoundException(
        'No solvency recommendation found. Run analysis first.',
      );
    }

    const updatePayload: Record<string, any> = {};

    if (recommendation === SolvencyRecommendation.APPROVE) {
      updatePayload.status = ApplicationStatus.APPROVED;
      updatePayload.rejectionType = undefined;
      updatePayload.rejectionReason = undefined;
      updatePayload.improveChecklist = [];
    } else if (recommendation === SolvencyRecommendation.REVIEW) {
      updatePayload.status = ApplicationStatus.REQUEST_MORE_DOCUMENTS;
      updatePayload.rejectionType = undefined;
      updatePayload.rejectionReason = app.solvencyAnalysis?.summary ||
        'Additional supporting documents are required after solvency analysis.';
      updatePayload.improveChecklist = this.flagsToChecklist(
        app.solvencyAnalysis?.fraudFlags || [],
      );
    } else {
      updatePayload.status = ApplicationStatus.REJECTED;
      updatePayload.rejectionType = RejectionType.CAN_REAPPLY;
      updatePayload.rejectionReason = app.solvencyAnalysis?.summary ||
        'Solvency analysis indicates high risk for this property.';
      updatePayload.improveChecklist = this.flagsToChecklist(
        app.solvencyAnalysis?.fraudFlags || [],
      );
    }

    const updated = await this.applicationModel
      .findByIdAndUpdate(applicationId, { $set: updatePayload }, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException('Application not found');
    }

    return updated;
  }

  private async extractFromDocumentUrl(documentUrl: string): Promise<OcrResult> {
    const apiKey =
      this.configService.get<string>('OCR_SPACE_API_KEY') ||
      this.configService.get<string>('OCR_API_KEY');
    const endpoint =
      this.configService.get<string>('OCR_SPACE_ENDPOINT') ||
      this.configService.get<string>('OCR_ENDPOINT') ||
      'https://api.ocr.space/parse/image';

    if (!apiKey) {
      this.logger.warn(
        'OCR_SPACE_API_KEY/OCR_API_KEY is not configured. Falling back to manual review mode.',
      );
      return {
        provider: 'none',
        text: '',
        confidence: 0,
      };
    }

    const params = new URLSearchParams();
    params.append('apikey', apiKey);
    params.append('url', documentUrl);
    params.append('language', 'eng');
    params.append('isOverlayRequired', 'true');
    params.append('detectOrientation', 'true');
    params.append('scale', 'true');
    params.append('OCREngine', '2');

    const response = await axios.post(endpoint, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 45000,
    });

    const payload = response?.data || {};
    if (payload?.IsErroredOnProcessing) {
      const errors = Array.isArray(payload?.ErrorMessage)
        ? payload.ErrorMessage.join(' | ')
        : String(payload?.ErrorMessage || 'OCR processing failed');

      if (this.isOcrFileTooLargeError(errors)) {
        this.logger.warn(
          `OCR provider rejected document due size limits (${errors}). Falling back to manual review mode.`,
        );
        return {
          provider: 'none',
          text: '',
          confidence: 0,
        };
      }

      throw new Error(errors);
    }

    const parsedResults = Array.isArray(payload?.ParsedResults)
      ? payload.ParsedResults
      : [];

    const text = parsedResults
      .map((result: any) => String(result?.ParsedText || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    const confidence = this.computeOcrConfidence(parsedResults, text);
    const extractedFullName = this.extractName(text);
    const extractedMonthlyIncome = this.extractIncome(text);

    return {
      provider: 'ocr_space',
      text,
      confidence,
      extractedFullName,
      extractedMonthlyIncome,
    };
  }

  private computeOcrConfidence(parsedResults: any[], text: string): number {
    const scores: number[] = [];

    for (const result of parsedResults) {
      const lines = result?.TextOverlay?.Lines;
      if (!Array.isArray(lines)) continue;

      for (const line of lines) {
        const words = Array.isArray(line?.Words) ? line.Words : [];
        for (const word of words) {
          const confidenceRaw = Number(word?.Confidence);
          if (Number.isFinite(confidenceRaw)) {
            scores.push(Math.max(0, Math.min(100, confidenceRaw)) / 100);
          }
        }
      }
    }

    if (scores.length > 0) {
      const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
      return Number(avg.toFixed(4));
    }

    if (text.length > 250) return 0.75;
    if (text.length > 100) return 0.62;
    if (text.length > 30) return 0.5;
    return 0.3;
  }

  private extractName(text: string): string | undefined {
    if (!text) return undefined;

    const compact = text.replace(/\s+/g, ' ').trim();

    const patterns = [
      // Template-aware: "Full Name Wael Gassab Date of Birth ..."
      /(?:full\s*name)\s*[:\-]?\s*([A-Za-z├Ç-├┐][A-Za-z├Ç-├┐\s'\-]{2,80}?)(?=\s+(?:date\s*of\s*birth|national\s*id(?:\s*\/\s*passport)?|phone|email|current\s*address)\b)/i,
      // Template-aware: "Signature Wael Gassab Date ..."
      /(?:signature)\s*[:\-]?\s*([A-Za-z├Ç-├┐][A-Za-z├Ç-├┐\s'\-]{2,80}?)(?=\s+(?:date)\b)/i,
      // Generic field-style fallbacks.
      /(?:full\s*name|name|nom\s*complet|nom)\s*[:\-]\s*([A-Za-z├Ç-├┐][A-Za-z├Ç-├┐\s'\-]{2,80})/i,
      /(?:employee|employe|worker|applicant)\s*[:\-]\s*([A-Za-z├Ç-├┐][A-Za-z├Ç-├┐\s'\-]{2,80})/i,
    ];

    for (const pattern of patterns) {
      const match = compact.match(pattern);
      if (match?.[1]) {
        const candidate = this.cleanCandidateName(match[1]);
        if (this.isLikelyPersonName(candidate)) {
          return candidate;
        }
      }
    }

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 24);

    for (const line of lines) {
      if (/\d/.test(line)) continue;
      if (line.length < 5 || line.length > 60) continue;
      const words = line.split(/\s+/).filter(Boolean);
      if (words.length < 2 || words.length > 5) continue;

      const alphaRatio = line.replace(/[^A-Za-z├Ç-├┐\s'\-]/g, '').length / line.length;
      if (alphaRatio < 0.8) continue;

      const candidate = this.cleanCandidateName(line);
      if (!this.isLikelyPersonName(candidate)) continue;

      return candidate;
    }

    return undefined;
  }

  private cleanCandidateName(name: string): string {
    return String(name)
      .replace(/\s+/g, ' ')
      .replace(/[^A-Za-z├Ç-├┐\s'\-]/g, '')
      .trim();
  }

  private isLikelyPersonName(name: string): boolean {
    const candidate = String(name || '').trim();
    if (!candidate) return false;
    if (/\d/.test(candidate)) return false;

    const compact = candidate.replace(/\s+/g, ' ');
    if (compact.length < 4 || compact.length > 60) return false;

    const lower = compact.toLowerCase();
    const blocked = [
      'smartproperty',
      'rental',
      'application',
      'form',
      'generated',
      'identity',
      'employment',
      'income',
      'guarantor',
      'declaration',
      'checklist',
      'confidential',
      'applicant',
      'signature',
      'date',
      'page',
    ];

    if (blocked.some((word) => lower.includes(word))) return false;

    const parts = compact.split(' ').filter(Boolean);
    if (parts.length < 2 || parts.length > 5) return false;
    if (parts.some((part) => part.length < 2)) return false;

    return true;
  }

  private extractIncome(text: string): number | undefined {
    if (!text) return undefined;

    const patterns = [
      /(?:monthly\s*net\s*income)\s*[:\-]?\s*(?:\(\s*tnd\s*\))?\s*(?:tnd|dt|dinar)?\s*([0-9][0-9\s.,]{2,})/gi,
      /(?:monthly\s*income|income|salary|net\s*salary|gross\s*salary|salaire\s*net|salaire|revenu\s*mensuel)\s*[:\-]?\s*(?:tnd|dt|dinar)?\s*([0-9][0-9\s.,]{2,})/gi,
      /([0-9][0-9\s.,]{2,})\s*(?:tnd|dt|dinar|dinars)\b/gi,
    ];

    const candidates: number[] = [];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null = null;
      while ((match = pattern.exec(text)) !== null) {
        const parsed = this.parseAmount(match[1]);
        if (parsed !== null && parsed >= 150 && parsed <= 100000) {
          candidates.push(parsed);
        }
      }
    }

    if (candidates.length === 0) return undefined;

    // Use the maximum salary-looking value to reduce under-extraction bias.
    return Math.max(...candidates);
  }

  private parseAmount(raw: string): number | null {
    const cleaned = String(raw).replace(/[^0-9,\.]/g, '');
    if (!cleaned) return null;

    const commas = (cleaned.match(/,/g) || []).length;
    const dots = (cleaned.match(/\./g) || []).length;

    let normalized = cleaned;

    if (commas > 0 && dots > 0) {
      // Keep the last separator as decimal if needed; remove the other.
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        normalized = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = cleaned.replace(/,/g, '');
      }
    } else if (commas > 0 && dots === 0) {
      // Many OCR docs use comma for thousands; strip commas.
      normalized = cleaned.replace(/,/g, '');
    } else {
      normalized = cleaned;
    }

    const amount = Number(normalized);
    if (!Number.isFinite(amount)) return null;
    return amount;
  }

  private computeMonthlyPropertyCost(property: any): number {
    if (!property) return 0;

    const basePrice = Number(property?.price || 0);
    const monthlyCharges = Number(property?.monthlyCharges || 0);
    const txType = String(property?.type || '').toLowerCase();

    if (txType === 'rent') {
      return Math.max(0, basePrice + monthlyCharges);
    }

    // Fallback for non-rent listings: approximate monthly burden.
    return Math.max(0, basePrice / 240 + monthlyCharges);
  }

  private buildFraudFlags(input: {
    ocr: OcrResult;
    declaredMonthlyIncome: number;
    nameMatchScore: number;
    incomeMismatchPercent: number | null;
    affordabilityRatio: number | null;
    reusedByOtherClient: boolean;
    occupationAssessment: OccupationAssessment;
  }): FraudFlag[] {
    const flags: FraudFlag[] = [];

    if (!input.ocr.extractedFullName) {
      flags.push('MISSING_NAME_IN_DOCUMENT');
    } else if (input.nameMatchScore < 0.72) {
      flags.push('NAME_MISMATCH');
    }

    if (!input.ocr.extractedMonthlyIncome) {
      flags.push('MISSING_INCOME_IN_DOCUMENT');
    } else if (
      input.incomeMismatchPercent !== null &&
      input.incomeMismatchPercent >= 0.2
    ) {
      flags.push('INCOME_MISMATCH');
    }

    if (input.ocr.confidence < 0.5) {
      flags.push('OCR_LOW_CONFIDENCE');
    }

    if (input.declaredMonthlyIncome <= 0) {
      flags.push('ZERO_DECLARED_INCOME');
    }

    if (input.affordabilityRatio !== null && input.affordabilityRatio > 0.55) {
      flags.push('HIGH_AFFORDABILITY_RATIO');
    }

    if (input.reusedByOtherClient) {
      flags.push('DOCUMENT_REUSED_BY_ANOTHER_CLIENT');
    }

    if (input.occupationAssessment.status === 'MISSING') {
      flags.push('OCCUPATION_MISSING');
    } else if (input.occupationAssessment.status === 'SUSPICIOUS') {
      flags.push('OCCUPATION_SUSPICIOUS');
    }

    return flags;
  }

  private buildChecks(input: {
    appFullName: string;
    extractedName?: string;
    declaredMonthlyIncome: number;
    extractedMonthlyIncome?: number;
    affordabilityRatio: number | null;
    ocrConfidence: number;
    occupation?: string;
    occupationAssessment: OccupationAssessment;
  }): SolvencyCheck[] {
    const checks: SolvencyCheck[] = [];

    const nameMatch = this.compareNames(
      input.appFullName,
      input.extractedName || '',
    );

    checks.push({
      name: 'Name verification',
      passed: !!input.extractedName && nameMatch >= 0.72,
      expected: input.appFullName || 'N/A',
      actual: input.extractedName || 'N/A',
      note: `Similarity: ${Math.round(nameMatch * 100)}%`,
    });

    const incomeMismatch =
      input.declaredMonthlyIncome > 0 && input.extractedMonthlyIncome
        ? Math.abs(input.extractedMonthlyIncome - input.declaredMonthlyIncome) /
          input.declaredMonthlyIncome
        : null;

    checks.push({
      name: 'Income verification',
      passed:
        !!input.extractedMonthlyIncome &&
        incomeMismatch !== null &&
        incomeMismatch < 0.2,
      expected:
        input.declaredMonthlyIncome > 0
          ? `${input.declaredMonthlyIncome.toFixed(2)} TND`
          : 'N/A',
      actual: input.extractedMonthlyIncome
        ? `${input.extractedMonthlyIncome.toFixed(2)} TND`
        : 'N/A',
      note:
        incomeMismatch === null
          ? 'Could not compute mismatch'
          : `Mismatch: ${(incomeMismatch * 100).toFixed(2)}%`,
    });

    checks.push({
      name: 'OCR quality',
      passed: input.ocrConfidence >= 0.5,
      expected: '>= 50%',
      actual: `${(input.ocrConfidence * 100).toFixed(2)}%`,
    });

    checks.push({
      name: 'Affordability ratio',
      passed:
        input.affordabilityRatio !== null && input.affordabilityRatio <= 0.5,
      expected: '<= 50%',
      actual:
        input.affordabilityRatio === null
          ? 'N/A'
          : `${(input.affordabilityRatio * 100).toFixed(2)}%`,
    });

    checks.push({
      name: 'Occupation quality',
      passed: input.occupationAssessment.status === 'VALID',
      expected: 'Meaningful real occupation',
      actual: input.occupation || 'N/A',
      note: `${input.occupationAssessment.reason} (score ${Math.round(input.occupationAssessment.score * 100)}%)`,
    });

    return checks;
  }

  private computeRiskScore(input: {
    affordabilityRatio: number | null;
    declaredMonthlyIncome: number;
    employmentStatus?: string;
    nameMatchScore: number;
    incomeMismatchPercent: number | null;
    ocrConfidence: number;
    fraudFlags: FraudFlag[];
    occupationAssessment: OccupationAssessment;
  }): number {
    let risk = 0;

    if (input.declaredMonthlyIncome <= 0) {
      risk += 40;
    }

    if (input.affordabilityRatio !== null) {
      const ratio = input.affordabilityRatio;
      if (ratio <= 0.3) risk += 6;
      else if (ratio <= 0.4) risk += 14;
      else if (ratio <= 0.5) risk += 24;
      else if (ratio <= 0.6) risk += 36;
      else risk += 50;
    } else {
      risk += 15;
    }

    const status = String(input.employmentStatus || '').toUpperCase();
    if (status.includes('UNEMPLOY')) risk += 20;
    else if (status.includes('STUDENT')) risk += 12;
    else if (status.includes('PART_TIME')) risk += 8;
    else if (status.includes('SELF')) risk += 6;
    else if (status.includes('FULL_TIME')) risk -= 4;

    if (input.nameMatchScore < 0.7) risk += 22;
    else if (input.nameMatchScore < 0.82) risk += 10;

    if (input.incomeMismatchPercent !== null) {
      if (input.incomeMismatchPercent >= 0.4) risk += 26;
      else if (input.incomeMismatchPercent >= 0.25) risk += 16;
      else if (input.incomeMismatchPercent >= 0.1) risk += 8;
    }

    if (input.ocrConfidence < 0.45) risk += 12;
    else if (input.ocrConfidence < 0.65) risk += 6;

    if (input.fraudFlags.includes('DOCUMENT_REUSED_BY_ANOTHER_CLIENT')) risk += 20;
    if (input.fraudFlags.includes('NAME_MISMATCH')) risk += 12;
    if (input.fraudFlags.includes('INCOME_MISMATCH')) risk += 10;
    if (input.fraudFlags.includes('OCCUPATION_MISSING')) risk += 8;
    if (input.fraudFlags.includes('OCCUPATION_SUSPICIOUS')) risk += 14;

    if (input.occupationAssessment.status === 'SUSPICIOUS') risk += 8;

    const clamped = Math.max(0, Math.min(100, Math.round(risk)));
    return clamped;
  }

  private pickRecommendation(
    riskScore: number,
    fraudFlags: FraudFlag[],
  ): SolvencyRecommendation {
    const critical =
      fraudFlags.includes('DOCUMENT_REUSED_BY_ANOTHER_CLIENT') ||
      (fraudFlags.includes('NAME_MISMATCH') &&
        fraudFlags.includes('INCOME_MISMATCH'));

    if (critical || riskScore > 60) {
      return SolvencyRecommendation.REJECT;
    }

    if (riskScore > 35 || fraudFlags.length > 0) {
      return SolvencyRecommendation.REVIEW;
    }

    return SolvencyRecommendation.APPROVE;
  }

  private compareNames(expected: string, actual: string): number {
    const a = this.normalizeText(expected);
    const b = this.normalizeText(actual);

    if (!a || !b) return 0;
    if (a === b) return 1;

    if (a.length >= 4 && b.includes(a)) return 0.94;
    if (b.length >= 4 && a.includes(b)) return 0.9;

    const tokenScore = this.tokenOverlap(a, b);
    const dice = this.diceBigrams(a, b);

    return Math.max(tokenScore, dice);
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenOverlap(a: string, b: string): number {
    const aTokens = new Set(a.split(/\s+/).filter((word) => word.length > 1));
    const bTokens = new Set(b.split(/\s+/).filter((word) => word.length > 1));
    if (!aTokens.size || !bTokens.size) return 0;

    let inter = 0;
    for (const token of aTokens) {
      if (bTokens.has(token)) inter += 1;
    }

    return (2 * inter) / (aTokens.size + bTokens.size);
  }

  private diceBigrams(a: string, b: string): number {
    const x = a.replace(/\s+/g, '');
    const y = b.replace(/\s+/g, '');

    if (x.length < 2 || y.length < 2) return 0;

    const make = (source: string) => {
      const map = new Map<string, number>();
      for (let i = 0; i < source.length - 1; i++) {
        const gram = source.slice(i, i + 2);
        map.set(gram, (map.get(gram) || 0) + 1);
      }
      return map;
    };

    const A = make(x);
    const B = make(y);

    let inter = 0;
    for (const [gram, count] of A) {
      inter += Math.min(count, B.get(gram) || 0);
    }

    return (2 * inter) / Math.max(1, x.length - 1 + (y.length - 1));
  }

  private async isDocumentReusedByAnotherClient(
    applicationId: string,
    documentUrl: string,
    currentClientId: string,
  ): Promise<boolean> {
    if (!documentUrl) return false;

    const other = await this.applicationModel
      .findOne({
        _id: { $ne: new Types.ObjectId(applicationId) },
        documentUrl,
        clientId: { $ne: new Types.ObjectId(currentClientId) },
      })
      .select('_id')
      .lean()
      .exec();

    return !!other;
  }

  private flagsToChecklist(flags: string[]): string[] {
    const dictionary: Record<string, string> = {
      NAME_MISMATCH:
        'Upload a clearer ID/salary document where full name exactly matches your profile.',
      INCOME_MISMATCH:
        'Upload a recent payslip that matches the declared monthly income.',
      MISSING_NAME_IN_DOCUMENT:
        'Upload a document where the applicant full name is visible.',
      MISSING_INCOME_IN_DOCUMENT:
        'Upload a document where monthly income is clearly visible.',
      OCR_LOW_CONFIDENCE:
        'Upload a higher-quality scan (flat, high resolution, readable text).',
      ZERO_DECLARED_INCOME:
        'Complete your declared monthly income before re-submitting.',
      HIGH_AFFORDABILITY_RATIO:
        'Consider applying for a lower monthly rent or adding a guarantor document.',
      DOCUMENT_REUSED_BY_ANOTHER_CLIENT:
        'Upload your own personal document; reused documents are not accepted.',
      OCCUPATION_MISSING:
        'Provide a clear occupation/job title in your application profile.',
      OCCUPATION_SUSPICIOUS:
        'Replace unclear or random occupation text with a real job title and employer context.',
    };

    return Array.from(new Set(flags.map((flag) => dictionary[flag]).filter(Boolean)));
  }

  private extractExcerpt(text: string): string {
    if (!text) return '';
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.slice(0, 1800);
  }

  private async generateAiOpinion(input: {
    recommendation: SolvencyRecommendation;
    riskScore: number;
    affordabilityRatio: number | null;
    fraudFlags: FraudFlag[];
    declaredMonthlyIncome: number;
    extractedMonthlyIncome?: number;
    occupationAssessment: OccupationAssessment;
  }): Promise<string> {
    const fallback = this.generateFallbackOpinion(input);

    if (!this.groq) return fallback;

    try {
      const ratioText =
        input.affordabilityRatio === null
          ? 'N/A'
          : `${(input.affordabilityRatio * 100).toFixed(2)}%`;

      const prompt = [
        'You are a solvency analyst for a rental application.',
        `Recommendation: ${input.recommendation}`,
        `Risk score (0 low risk, 100 high risk): ${input.riskScore}`,
        `Affordability ratio: ${ratioText}`,
        `Declared monthly income: ${input.declaredMonthlyIncome || 0} TND`,
        `Extracted monthly income from OCR: ${input.extractedMonthlyIncome || 0} TND`,
        `Occupation quality: ${input.occupationAssessment.status} (${Math.round(input.occupationAssessment.score * 100)}%) - ${input.occupationAssessment.reason}`,
        `Fraud flags: ${input.fraudFlags.length ? input.fraudFlags.join(', ') : 'none'}`,
        'Write a concise (max 70 words) decision rationale for a property agent. Mention the most critical points only.',
      ].join('\n');

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        max_tokens: 140,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = String(completion.choices?.[0]?.message?.content || '').trim();
      return content || fallback;
    } catch (error: any) {
      this.logger.warn(
        `Failed to generate Groq solvency opinion, using fallback. ${this.toErrorMessage(error)}`,
      );
      return fallback;
    }
  }

  private generateFallbackOpinion(input: {
    recommendation: SolvencyRecommendation;
    riskScore: number;
    affordabilityRatio: number | null;
    fraudFlags: FraudFlag[];
    declaredMonthlyIncome: number;
    extractedMonthlyIncome?: number;
    occupationAssessment: OccupationAssessment;
  }): string {
    const ratioText =
      input.affordabilityRatio === null
        ? 'N/A'
        : `${(input.affordabilityRatio * 100).toFixed(2)}%`;

    const keyFlags = input.fraudFlags.slice(0, 3).join(', ') || 'none';

    return [
      `Recommendation: ${input.recommendation}.`,
      `Risk score: ${input.riskScore}/100.`,
      `Affordability ratio: ${ratioText}.`,
      `Declared income: ${input.declaredMonthlyIncome || 0} TND; OCR income: ${input.extractedMonthlyIncome || 0} TND.`,
      `Occupation quality: ${input.occupationAssessment.status} (${Math.round(input.occupationAssessment.score * 100)}%).`,
      `Key flags: ${keyFlags}.`,
    ].join(' ');
  }

  private async evaluateOccupationQuality(
    rawOccupation: string,
  ): Promise<OccupationAssessment> {
    const normalized = this.normalizeText(rawOccupation);

    if (!normalized) {
      return {
        status: 'MISSING',
        score: 0,
        reason: 'Occupation is empty.',
        normalizedOccupation: '',
      };
    }

    const quick = this.quickOccupationHeuristic(normalized);

    // When obviously invalid, skip external call and fail fast.
    if (quick.status !== 'VALID' && quick.score <= 0.25) {
      return {
        ...quick,
        normalizedOccupation: normalized,
      };
    }

    if (!this.groq) {
      return {
        ...quick,
        normalizedOccupation: normalized,
      };
    }

    try {
      const prompt = [
        'Classify if this is a meaningful real-world job/occupation title for a rental application.',
        `occupation: "${rawOccupation}"`,
        'Respond ONLY as JSON with fields:',
        '{"label":"VALID|SUSPICIOUS","confidence":0.0-1.0,"reason":"short reason"}',
      ].join('\n');

      const completion = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = String(completion.choices?.[0]?.message?.content || '').trim();
      const parsed = this.parseJsonObject(content);

      const aiLabel = String(parsed?.label || '').toUpperCase();
      const aiConfidence = Number(parsed?.confidence);
      const aiReason = String(parsed?.reason || '').trim() || 'AI occupation check result.';

      if (aiLabel === 'VALID' || aiLabel === 'SUSPICIOUS') {
        const score = Number.isFinite(aiConfidence)
          ? Math.max(0, Math.min(1, aiConfidence))
          : quick.score;

        return {
          status: aiLabel as 'VALID' | 'SUSPICIOUS',
          score,
          reason: aiReason,
          normalizedOccupation: normalized,
        };
      }

      return {
        ...quick,
        normalizedOccupation: normalized,
      };
    } catch (error: any) {
      this.logger.warn(
        `Occupation AI check failed, fallback to heuristic. ${this.toErrorMessage(error)}`,
      );
      return {
        ...quick,
        normalizedOccupation: normalized,
      };
    }
  }

  private quickOccupationHeuristic(
    normalizedOccupation: string,
  ): Omit<OccupationAssessment, 'normalizedOccupation'> {
    const raw = normalizedOccupation.trim();
    const tokens = raw.split(/\s+/).filter(Boolean);
    const alphaOnly = raw.replace(/[^a-z]/g, '');
    const digits = raw.replace(/[^0-9]/g, '');

    if (raw.length < 3) {
      return { status: 'SUSPICIOUS', score: 0.08, reason: 'Occupation text is too short.' };
    }

    if (raw.length > 80) {
      return { status: 'SUSPICIOUS', score: 0.2, reason: 'Occupation text is unusually long.' };
    }

    if (digits.length > alphaOnly.length) {
      return { status: 'SUSPICIOUS', score: 0.1, reason: 'Occupation contains too many digits.' };
    }

    const suspiciousTokens = new Set([
      'asdf',
      'qwerty',
      'random',
      'test',
      'none',
      'n/a',
      'na',
      'xxx',
      'lorem',
      'ipsum',
      'blah',
      'aaaa',
      'bbbbb',
    ]);

    if (tokens.some((token) => suspiciousTokens.has(token))) {
      return { status: 'SUSPICIOUS', score: 0.15, reason: 'Occupation contains placeholder/random words.' };
    }

    const hasVowel = /[aeiou]/.test(alphaOnly);
    if (!hasVowel || alphaOnly.length < 3) {
      return { status: 'SUSPICIOUS', score: 0.2, reason: 'Occupation text does not look like a real title.' };
    }

    if (tokens.length > 8) {
      return { status: 'SUSPICIOUS', score: 0.3, reason: 'Occupation text looks like a sentence, not a title.' };
    }

    return { status: 'VALID', score: 0.78, reason: 'Occupation format looks valid.' };
  }

  private parseJsonObject(raw: string): any {
    if (!raw) return null;

    const direct = raw.trim();
    try {
      return JSON.parse(direct);
    } catch {
      // Continue with extraction fallback.
    }

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  private isOcrFileTooLargeError(message: string): boolean {
    const value = String(message || '').toLowerCase();

    return (
      value.includes('e214') ||
      (value.includes('file failed validation') && value.includes('maximum size')) ||
      (value.includes('size limit') && value.includes('1024 kb'))
    );
  }

  private toErrorMessage(error: any): string {
    if (!error) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error?.response?.data?.ErrorMessage) {
      return String(error.response.data.ErrorMessage);
    }
    return String(error?.message || 'Unknown error');
  }
}
