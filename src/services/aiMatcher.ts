import {
  SupplierInvoiceLine,
  MasterItem,
  CandidateItem,
  AIMatchAnalysis,
} from '../types/pharmacy';

export interface AIStatus {
  available: boolean;
  hasKey: boolean;
  model: string;
  message: string;
}

export interface SingleLineAIResponse {
  success: boolean;
  modelUsed: string;
  result: {
    matchedItemId?: string;
    confidenceScore: number;
    decision: 'MATCHED' | 'REVIEW_REQUIRED' | 'UNMATCHED';
    clinicalRationale: string;
    agreementPoints: string[];
    differencePoints: string[];
    detectedActiveIngredient?: string;
    dosageFormConfirmed?: string;
    strengthConfirmed?: string;
    safetyRiskLevel: 'SAFE' | 'WARNING' | 'CRITICAL_CONFLICT';
    safetyDetails?: string;
  };
}

export interface CandidateAIExplanation {
  summaryVerdict: string;
  isSameTherapeuticEntity: boolean;
  clinicalAdvice: string;
  dosageEvaluation: string;
  formEvaluation?: string;
  confidenceScore: number;
}

class AIMatchService {
  private statusCache: AIStatus | null = null;
  private lastCheckTime = 0;

  /**
   * Check if Gemini AI server endpoints and API key are available
   */
  public async checkStatus(): Promise<AIStatus> {
    const now = Date.now();
    if (this.statusCache && now - this.lastCheckTime < 15000) {
      return this.statusCache;
    }

    try {
      const res = await fetch('/api/ai/status');
      if (!res.ok) throw new Error('Status endpoint failed');
      const data = await res.json();
      this.statusCache = {
        available: Boolean(data.hasKey),
        hasKey: Boolean(data.hasKey),
        model: data.model || 'gemini-3.8-flash',
        message: data.message || '',
      };
      this.lastCheckTime = now;
      return this.statusCache;
    } catch {
      return {
        available: false,
        hasKey: false,
        model: 'gemini-3.8-flash',
        message: 'تعذر الاتصال بخادم الذكاء الاصطناعي (يتم استخدام المحرك المحلي الفائق)',
      };
    }
  }

  /**
   * Call Gemini 3.8 Flash to evaluate a single invoice line against candidate items
   */
  public async matchLine(
    line: SupplierInvoiceLine,
    candidates: CandidateItem[]
  ): Promise<SingleLineAIResponse['result'] | null> {
    try {
      const payload = {
        supplierRawName: line.rawSupplierName,
        supplierBarcode: line.supplierBarcode,
        candidates: candidates.slice(0, 6).map(c => ({
          id: c.masterItem.id,
          name: c.masterItem.name,
          nameAr: c.masterItem.nameAr,
          barcode: c.masterItem.barcode,
          strength: c.masterItem.strength,
          dosageForm: c.masterItem.dosageForm,
          packSize: c.masterItem.packSize,
          company: c.masterItem.company,
          activeIngredient: c.masterItem.activeIngredient,
        })),
      };

      const res = await fetch('/api/ai/match-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return null;
      }

      const data: SingleLineAIResponse = await res.json();
      return data.result || null;
    } catch (err) {
      console.warn('AI Match fallback to local rule engine:', err);
      return null;
    }
  }

  /**
   * Request a deep clinical second opinion explaining why a candidate matches or differs
   */
  public async explainCandidate(
    supplierRawName: string,
    masterItem: MasterItem
  ): Promise<CandidateAIExplanation | null> {
    try {
      const res = await fetch('/api/ai/explain-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierRawName,
          masterItem: {
            id: masterItem.id,
            name: masterItem.name,
            nameAr: masterItem.nameAr,
            strength: masterItem.strength,
            dosageForm: masterItem.dosageForm,
            packSize: masterItem.packSize,
            company: masterItem.company,
            activeIngredient: masterItem.activeIngredient,
            barcode: masterItem.barcode,
          },
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.analysis || null;
    } catch (err) {
      console.warn('AI Explain error:', err);
      return null;
    }
  }
}

export const aiMatchService = new AIMatchService();
