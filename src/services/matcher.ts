/**
 * Advanced Multi-Stage Pharmaceutical Match Engine (V2 - Strict Clinical Invariant Edition)
 */

import {
  MasterItem,
  SupplierInvoiceLine,
  MatchResult,
  CandidateItem,
  ScoreBreakdown,
  ConfirmedMapping,
  PharmaEntity,
  MatchStatus,
  ScoringWeights,
} from '../types/pharmacy';
import { normalizeText, cleanOcrArtifacts, dsim, phoneticArabic } from './normalizer';
import { extractPharmaEntity, compareStrengths } from './extractor';
import {
  normalizeTradeNameCompound,
  getAllTradeNameAliases,
} from './dictionaryService';
import {
  normalizeArabicMedicalText,
  tokenSortRatio,
  sequenceMatcherRatio,
  cleanTextPython,
} from './medicalInvoiceMatcher';

// Text Similarity Algorithms
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  // Substring check
  if (longer.includes(shorter) && shorter.length >= 3) {
    const ratio = shorter.length / longer.length;
    return 0.75 + 0.25 * ratio;
  }

  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (longerLength - dist) / longerLength);
}

function tokenJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  let intersection = 0;
  set1.forEach(token => {
    if (set2.has(token)) intersection++;
  });
  const union = new Set([...tokens1, ...tokens2]).size;
  return union === 0 ? 0 : intersection / union;
}

export class PharmacyMatchEngine {
  private masterItems: MasterItem[] = [];
  private barcodeIndex: Map<string, MasterItem> = new Map();
  private nameIndex: Map<string, MasterItem[]> = new Map();
  private tokenIndex: Map<string, Set<MasterItem>> = new Map();
  private parsedMasterCache: Map<string, PharmaEntity> = new Map();
  private confirmedMappings: Map<string, ConfirmedMapping> = new Map();
  private highConfidenceThreshold = 90;
  private reviewThreshold = 70;
  private weights: ScoringWeights = {
    coreNameWeight: 35,
    strengthWeight: 25,
    formWeight: 15,
    packWeight: 10,
    companyWeight: 10,
    barcodeWeight: 25,
  };

  constructor(
    masterItems: MasterItem[],
    confirmedMappings: ConfirmedMapping[] = [],
    options?: {
      highConfidenceThreshold?: number;
      reviewThreshold?: number;
      weights?: Partial<ScoringWeights>;
    }
  ) {
    if (options?.highConfidenceThreshold) this.highConfidenceThreshold = options.highConfidenceThreshold;
    if (options?.reviewThreshold) this.reviewThreshold = options.reviewThreshold;
    if (options?.weights) {
      this.weights = { ...this.weights, ...options.weights };
    }
    this.updateMasterDatabase(masterItems);
    this.updateConfirmedMappings(confirmedMappings);
  }

  public setWeights(newWeights: Partial<ScoringWeights>): void {
    this.weights = { ...this.weights, ...newWeights };
  }

  public getWeights(): ScoringWeights {
    return { ...this.weights };
  }

  public updateMasterDatabase(masterItems: MasterItem[]): void {
    this.masterItems = masterItems;
    this.barcodeIndex.clear();
    this.nameIndex.clear();
    this.tokenIndex.clear();
    this.parsedMasterCache.clear();

    for (const item of masterItems) {
      // 1. Index Barcode
      if (item.barcode) {
        const cleanBc = item.barcode.trim();
        if (cleanBc) {
          this.barcodeIndex.set(cleanBc, item);
        }
      }

      // 2. Parse & Cache Entity
      const entity = extractPharmaEntity(
        `${item.name} ${item.nameAr || ''} ${item.dosageForm || ''} ${item.strength || ''} ${item.company || ''}`
      );
      this.parsedMasterCache.set(item.id, entity);

      // 3. Index Normalized Names
      const normName = normalizeText(item.name);
      if (!this.nameIndex.has(normName)) {
        this.nameIndex.set(normName, []);
      }
      this.nameIndex.get(normName)!.push(item);

      if (item.nameAr) {
        const normAr = normalizeText(item.nameAr);
        if (!this.nameIndex.has(normAr)) {
          this.nameIndex.set(normAr, []);
        }
        this.nameIndex.get(normAr)!.push(item);
      }

      // 4. Token Inverted Index
      const tokens = new Set([
        ...entity.coreTokens,
        normalizeText(entity.coreName),
        normalizeTradeNameCompound(entity.coreName),
      ]);
      tokens.forEach(tok => {
        if (tok && tok.length >= 2) {
          if (!this.tokenIndex.has(tok)) {
            this.tokenIndex.set(tok, new Set());
          }
          this.tokenIndex.get(tok)!.add(item);
        }
      });
    }
  }

  public updateConfirmedMappings(mappings: ConfirmedMapping[]): void {
    this.confirmedMappings.clear();
    mappings.forEach(m => {
      this.confirmedMappings.set(normalizeText(m.supplierNameCleaned || m.supplierNameOriginal), m);
    });
  }

  public setConfidenceThreshold(threshold: number): void {
    this.highConfidenceThreshold = threshold;
  }

  public updateData(masterItems?: MasterItem[], confirmedMappings?: ConfirmedMapping[]): void {
    if (masterItems) this.updateMasterDatabase(masterItems);
    if (confirmedMappings) this.updateConfirmedMappings(confirmedMappings);
  }

  public matchInvoice(lines: SupplierInvoiceLine[]): MatchResult[] {
    return lines.map(line => this.matchLine(line));
  }

  public matchLine(line: SupplierInvoiceLine): MatchResult {
    const rawName = line.rawSupplierName || '';
    const cleanRaw = cleanOcrArtifacts(rawName);
    const normalizedSupplierName = normalizeText(cleanRaw);
    const compoundName = normalizeTradeNameCompound(normalizedSupplierName);

    const qty = line.quantity || 1;
    const supplierUnitPrice = line.unitPrice || 0;
    const totalSupplierCost = supplierUnitPrice * qty;

    // ==========================================
    // STAGE 1: Exact Barcode Match
    // ==========================================
    if (line.supplierBarcode && line.supplierBarcode.trim()) {
      const cleanBc = line.supplierBarcode.trim();
      const barcodeMatch = this.barcodeIndex.get(cleanBc);
      if (barcodeMatch) {
        const masterPrice = barcodeMatch.price;
        const totalMasterCost = masterPrice * qty;
        const priceDiff = supplierUnitPrice - masterPrice;
        const priceDiffPct = masterPrice > 0 ? (priceDiff / masterPrice) * 100 : 0;

        const cand: CandidateItem = {
          masterItem: barcodeMatch,
          score: 100,
          confidenceLevel: 'VERY_HIGH',
          matchReason: `مطابقة تامة ومؤكدة عبر الباركود الرسمي (${cleanBc})`,
          agreementPoints: ['تطابق باركود رسمي 100%'],
          differencePoints: [],
          scoreBreakdown: {
            coreNameScore: 100,
            tokenScore: 100,
            strengthScore: 100,
            unitScore: 100,
            companyScore: 100,
            formScore: 100,
            packScore: 100,
            barcodeScore: 100,
            aliasScore: 100,
            finalCompositeScore: 100,
          },
          hasBarcodeMatch: true,
          hasStrengthMatch: true,
          hasFormMatch: true,
          hasCompanyMatch: true,
          hardRulePassed: true,
          hardRuleViolations: [],
        };

        return {
          rowNumber: line.rowNumber,
          invoiceLine: line,
          status: 'MATCHED',
          confidenceScore: 100,
          matchedItem: barcodeMatch,
          candidates: [cand],
          priceDifference: Math.round(priceDiff * 100) / 100,
          priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
          totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
          totalMasterCost: Math.round(totalMasterCost * 100) / 100,
          totalDifference: Math.round((totalSupplierCost - totalMasterCost) * 100) / 100,
          notes: 'مطابقة عبر الباركود',
        };
      }
    }

    // ==========================================
    // STAGE 2: Historical Confirmed Manual Mappings
    // ==========================================
    const confirmed =
      this.confirmedMappings.get(normalizedSupplierName) ||
      this.confirmedMappings.get(compoundName);
    if (confirmed) {
      const targetMaster = this.masterItems.find(
        m => m.id === confirmed.masterItemId || (confirmed.officialBarcode && m.barcode === confirmed.officialBarcode)
      );
      if (targetMaster) {
        const masterPrice = targetMaster.price;
        const totalMasterCost = masterPrice * qty;
        const priceDiff = supplierUnitPrice - masterPrice;
        const priceDiffPct = masterPrice > 0 ? (priceDiff / masterPrice) * 100 : 0;

        const cand: CandidateItem = {
          masterItem: targetMaster,
          score: 100,
          confidenceLevel: 'VERY_HIGH',
          matchReason: `مطابقة معتمدة سابقاً من الصيدلي (استخدمت ${confirmed.timesUsed || 1} مرة)`,
          agreementPoints: ['مطابقة يدوية تاريخية معتمدة'],
          differencePoints: [],
          scoreBreakdown: {
            coreNameScore: 100,
            tokenScore: 100,
            strengthScore: 100,
            unitScore: 100,
            companyScore: 100,
            formScore: 100,
            packScore: 100,
            barcodeScore: 100,
            aliasScore: 100,
            finalCompositeScore: 100,
          },
          hasBarcodeMatch: Boolean(line.supplierBarcode && line.supplierBarcode === targetMaster.barcode),
          hasStrengthMatch: true,
          hasFormMatch: true,
          hasCompanyMatch: true,
          hardRulePassed: true,
          hardRuleViolations: [],
        };

        return {
          rowNumber: line.rowNumber,
          invoiceLine: line,
          status: 'MATCHED',
          confidenceScore: 100,
          matchedItem: targetMaster,
          candidates: [cand],
          isManuallyConfirmed: true,
          priceDifference: Math.round(priceDiff * 100) / 100,
          priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
          totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
          totalMasterCost: Math.round(totalMasterCost * 100) / 100,
          totalDifference: Math.round((totalSupplierCost - totalMasterCost) * 100) / 100,
          notes: 'مطابقة تاريخية معتمدة',
        };
      }
    }

    // ==========================================
    // STAGE 3: Extract Supplier Entity
    // ==========================================
    const supplierEntity = extractPharmaEntity(cleanRaw);

    // ==========================================
    // STAGE 4: Candidate Generation (Blocking)
    // ==========================================
    const candidateSet = new Set<MasterItem>();

    // 4.1 Lookup by normalized name exact
    const exactMatches = this.nameIndex.get(normalizedSupplierName) || [];
    exactMatches.forEach(item => candidateSet.add(item));

    // 4.2 Lookup by token overlap
    const searchTokens = new Set([
      ...supplierEntity.coreTokens,
      normalizeText(supplierEntity.coreName),
      normalizeTradeNameCompound(supplierEntity.coreName),
      ...getAllTradeNameAliases(supplierEntity.coreName),
    ]);

    searchTokens.forEach(tok => {
      if (tok && tok.length >= 2) {
        const matches = this.tokenIndex.get(tok);
        if (matches) {
          matches.forEach(item => candidateSet.add(item));
        }
      }
    });

    // 4.3 Fallback partial text search if candidate pool is too small
    if (candidateSet.size < 5) {
      const searchWord = normalizeText(supplierEntity.coreName);
      if (searchWord.length >= 3) {
        for (const item of this.masterItems) {
          const itemText = normalizeText(`${item.name} ${item.nameAr || ''}`);
          if (itemText.includes(searchWord)) {
            candidateSet.add(item);
          }
        }
      }
    }

    // 4.4 RapidFuzz Token Sort Ratio & SequenceMatcher candidate match (Medical normalization with dosage forms)
    const normMed = normalizeArabicMedicalText(cleanRaw);
    const cleanPy = cleanTextPython(cleanRaw);
    if (candidateSet.size < 8 && (normMed.length >= 3 || cleanPy.length >= 3)) {
      for (const item of this.masterItems) {
        if (candidateSet.has(item)) continue;
        const itemNormMed = normalizeArabicMedicalText(`${item.name} ${item.nameAr || ''}`);
        const itemCleanPy = cleanTextPython(`${item.name} ${item.nameAr || ''}`);
        const tsRatio = tokenSortRatio(normMed, itemNormMed);
        const seqRatio = sequenceMatcherRatio(cleanPy, itemCleanPy) * 100;

        if (tsRatio >= 55 || seqRatio >= 55) {
          candidateSet.add(item);
        }
      }
    }

    // 4.5 Price Tolerance Fallback candidate generation:
    // If candidateSet is still empty or small, search for items matching unit_price within 5%
    if (candidateSet.size < 3 && supplierUnitPrice > 0) {
      for (const item of this.masterItems) {
        const itemPrice = item.price || 0;
        if (itemPrice > 0) {
          const diffPct = (Math.abs(supplierUnitPrice - itemPrice) / itemPrice) * 100;
          if (diffPct <= 5.0) {
            candidateSet.add(item);
          }
        }
      }
    }

    // If still no candidates found
    if (candidateSet.size === 0) {
      return {
        rowNumber: line.rowNumber,
        invoiceLine: line,
        status: 'UNMATCHED',
        confidenceScore: 0,
        candidates: [],
        unmatchedReason: 'لم يتم العثور على أي صنف مرشح في قاعدة البيانات الرسمية',
        priceDifference: 0,
        priceDiffPercentage: 0,
        totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
        totalMasterCost: 0,
        totalDifference: 0,
        parsedSupplierEntity: supplierEntity,
      };
    }

    // ==========================================
    // STAGE 5: Multi-Faceted Scoring & Clinical Invariants
    // ==========================================
    const evaluatedCandidates: CandidateItem[] = [];

    for (const masterItem of candidateSet) {
      const masterEntity =
        this.parsedMasterCache.get(masterItem.id) ||
        extractPharmaEntity(`${masterItem.name} ${masterItem.nameAr || ''} ${masterItem.dosageForm || ''} ${masterItem.strength || ''}`);

      const candidate = this.evaluateCandidate(supplierEntity, masterEntity, masterItem, line);
      evaluatedCandidates.push(candidate);
    }

    // Sort descending by score
    evaluatedCandidates.sort((a, b) => b.score - a.score);

    const bestCandidate = evaluatedCandidates[0];

    // Calculate prices for the best candidate
    let masterPrice = 0;
    let totalMasterCost = 0;
    let priceDiff = 0;
    let priceDiffPct = 0;

    if (bestCandidate?.masterItem) {
      masterPrice = bestCandidate.masterItem.price || 0;
      totalMasterCost = masterPrice * qty;
      priceDiff = supplierUnitPrice - masterPrice;
      priceDiffPct = masterPrice > 0 ? (priceDiff / masterPrice) * 100 : 0;
    }

    // ==========================================
    // STAGE 5.5: Smart Price & Quantity Fallback (خط الدفاع الأخير بالسعر والكمية)
    // ==========================================
    // When the top name match has low confidence (< 70%), but supplier price matches an item within 5% tolerance
    if ((!bestCandidate || bestCandidate.score < 70) && supplierUnitPrice > 0) {
      const priceTolerance = 5.0; // 5% price tolerance
      let bestPriceItem: MasterItem | null = null;
      let minPriceDiffPct = 999;
      let bestPriceNameScore = 0;

      for (const item of this.masterItems) {
        const itemPrice = item.price || 0;
        if (itemPrice <= 0) continue;
        const diffPct = (Math.abs(supplierUnitPrice - itemPrice) / itemPrice) * 100;
        if (diffPct <= priceTolerance) {
          const nameScore = tokenSortRatio(cleanRaw, item.name);
          if (diffPct < minPriceDiffPct || (Math.abs(diffPct - minPriceDiffPct) < 0.01 && nameScore > bestPriceNameScore)) {
            minPriceDiffPct = diffPct;
            bestPriceItem = item;
            bestPriceNameScore = nameScore;
          }
        }
      }

      if (bestPriceItem) {
        const itemPrice = bestPriceItem.price || 0;
        const diffCost = supplierUnitPrice - itemPrice;
        const diffCostPct = itemPrice > 0 ? (diffCost / itemPrice) * 100 : 0;
        const priceStatus = minPriceDiffPct < 0.01 ? 'تطابق تام' : `فارق بسيط (${minPriceDiffPct.toFixed(2)}%)`;
        const priceScore = minPriceDiffPct < 0.01 ? 100 : 90;
        const qtyScore = 100; // Invoice has quantity
        const weightedConfidence = (bestPriceNameScore * 0.50) + (priceScore * 0.30) + (qtyScore * 0.20);
        const finalConfidence = Math.max(Math.round(weightedConfidence), 80);

        const priceFallbackCand: CandidateItem = {
          masterItem: bestPriceItem,
          score: finalConfidence,
          confidenceLevel: 'HIGH',
          matchReason: `مطابق محتمل (بناءً على السعر والكمية): الاسم مختلف (${Math.round(bestPriceNameScore)}%) ولكن السعر (${priceStatus}) والكمية متطابقان. يحتاج تأكيد سريع.`,
          agreementPoints: [
            `تطابق السعر (${priceStatus})`,
            `تطابق الكمية (${qty})`,
            'تم اقتراحه عبر خط الدفاع الأخير لمطابقة الأسعار والكمية'
          ],
          differencePoints: [
            `اختلاف في الاسم النصي (تشابه ${Math.round(bestPriceNameScore)}%)`
          ],
          scoreBreakdown: {
            coreNameScore: Math.round(bestPriceNameScore),
            tokenScore: Math.round(bestPriceNameScore),
            strengthScore: 75,
            unitScore: 75,
            companyScore: 70,
            formScore: 70,
            packScore: 70,
            barcodeScore: 0,
            aliasScore: Math.round(bestPriceNameScore),
            finalCompositeScore: finalConfidence,
          },
          hasBarcodeMatch: false,
          hasStrengthMatch: false,
          hasFormMatch: false,
          hasCompanyMatch: false,
          hardRulePassed: true,
          hardRuleViolations: [],
        };

        return {
          rowNumber: line.rowNumber,
          invoiceLine: line,
          status: 'REVIEW_REQUIRED',
          confidenceScore: finalConfidence,
          matchedItem: bestPriceItem,
          candidates: [priceFallbackCand, ...evaluatedCandidates].slice(0, 8),
          isPriceFallbackMatch: true,
          priceToleranceScore: priceScore,
          priceMatchStatus: priceStatus,
          nameSimilarityScore: Math.round(bestPriceNameScore),
          quantityMatchScore: qtyScore,
          reviewReason: `مطابق محتمل (بناءً على السعر والكمية): الاسم مختلف (${Math.round(bestPriceNameScore)}%) ولكن السعر (${priceStatus}) والكمية متطابقان.`,
          priceDifference: Math.round(diffCost * 100) / 100,
          priceDiffPercentage: Math.round(diffCostPct * 10) / 10,
          totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
          totalMasterCost: Math.round((itemPrice * qty) * 100) / 100,
          totalDifference: Math.round((totalSupplierCost - (itemPrice * qty)) * 100) / 100,
          notes: 'مطابقة عبر خط الدفاع الأخير بالسعر والكمية (Price Fallback)',
          parsedSupplierEntity: supplierEntity,
        };
      }
    }

    // ==========================================
    // STAGE 6: Decision Categorization
    // ==========================================
    if (!bestCandidate || bestCandidate.score < 40) {
      return {
        rowNumber: line.rowNumber,
        invoiceLine: line,
        status: 'UNMATCHED',
        confidenceScore: bestCandidate ? bestCandidate.score : 0,
        candidates: evaluatedCandidates.slice(0, 8),
        unmatchedReason: 'نسبة التطابق ضعيفة جداً (أقل من 40%) - الصنف غير معروف',
        priceDifference: 0,
        priceDiffPercentage: 0,
        totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
        totalMasterCost: 0,
        totalDifference: 0,
        parsedSupplierEntity: supplierEntity,
      };
    }

    // CRITICAL CLINICAL SAFETY CHECK:
    // If the best candidate failed hard rules (strength mismatch, severe form conflict)
    // NEVER match automatically! Force REVIEW_REQUIRED or UNMATCHED.
    if (!bestCandidate.hardRulePassed) {
      return {
        rowNumber: line.rowNumber,
        invoiceLine: line,
        status: 'REVIEW_REQUIRED',
        confidenceScore: bestCandidate.score,
        matchedItem: bestCandidate.masterItem,
        candidates: evaluatedCandidates.slice(0, 8),
        reviewReason: `تعارض إكلينيكي حرج: ${bestCandidate.hardRuleViolations.join(' | ')}`,
        priceDifference: Math.round(priceDiff * 100) / 100,
        priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
        totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
        totalMasterCost: Math.round(totalMasterCost * 100) / 100,
        totalDifference: Math.round((totalSupplierCost - totalMasterCost) * 100) / 100,
        notes: `تحذير سريري: ${bestCandidate.hardRuleViolations.join(' - ')}`,
        parsedSupplierEntity: supplierEntity,
      };
    }

    // Check Close Competitor Ambiguity: if candidate #2 is within 4% of candidate #1
    if (evaluatedCandidates.length > 1) {
      const secondCandidate = evaluatedCandidates[1];
      if (bestCandidate.score - secondCandidate.score < 4 && bestCandidate.score < 96) {
        return {
          rowNumber: line.rowNumber,
          invoiceLine: line,
          status: 'REVIEW_REQUIRED',
          confidenceScore: bestCandidate.score,
          matchedItem: bestCandidate.masterItem,
          candidates: evaluatedCandidates.slice(0, 8),
          reviewReason: `تشابه متقارب بين (${bestCandidate.masterItem.name}) و (${secondCandidate.masterItem.name})`,
          priceDifference: Math.round(priceDiff * 100) / 100,
          priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
          totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
          totalMasterCost: Math.round(totalMasterCost * 100) / 100,
          totalDifference: Math.round((totalSupplierCost - totalMasterCost) * 100) / 100,
          notes: 'تعدد المرشحين المتقاربين يتطلب تأكيد يدوي',
          parsedSupplierEntity: supplierEntity,
        };
      }
    }

    // High confidence Match (No conflicts, high score)
    if (bestCandidate.score >= this.highConfidenceThreshold) {
      return {
        rowNumber: line.rowNumber,
        invoiceLine: line,
        status: 'MATCHED',
        confidenceScore: bestCandidate.score,
        matchedItem: bestCandidate.masterItem,
        candidates: evaluatedCandidates.slice(0, 8),
        priceDifference: Math.round(priceDiff * 100) / 100,
        priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
        totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
        totalMasterCost: Math.round(totalMasterCost * 100) / 100,
        totalDifference: Math.round((totalSupplierCost - totalMasterCost) * 100) / 100,
        notes: bestCandidate.agreementPoints.join('، '),
        parsedSupplierEntity: supplierEntity,
      };
    }

    // Moderate confidence -> REVIEW_REQUIRED
    return {
      rowNumber: line.rowNumber,
      invoiceLine: line,
      status: 'REVIEW_REQUIRED',
      confidenceScore: bestCandidate.score,
      matchedItem: bestCandidate.masterItem,
      candidates: evaluatedCandidates.slice(0, 8),
      reviewReason: `مطابقة متوسطة الثقة (${bestCandidate.score}%) - يرجى مراجعة الصنف وتأكيده`,
      priceDifference: Math.round(priceDiff * 100) / 100,
      priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
      totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
      totalMasterCost: Math.round(totalMasterCost * 100) / 100,
      totalDifference: Math.round((totalSupplierCost - totalMasterCost) * 100) / 100,
      notes: 'يحتاج تأكيد الصيدلي',
      parsedSupplierEntity: supplierEntity,
    };
  }

  private evaluateCandidate(
    supplier: PharmaEntity,
    master: PharmaEntity,
    masterItem: MasterItem,
    line: SupplierInvoiceLine
  ): CandidateItem {
    const agreementPoints: string[] = [];
    const differencePoints: string[] = [];
    const hardRuleViolations: string[] = [];
    let hardRulePassed = true;

    // 1. BRAND & CORE NAME
    let coreNameScore = 0;
    const supCore = normalizeText(supplier.coreName);
    const masCore = normalizeText(master.coreName);
    const supAliases = getAllTradeNameAliases(supCore);

    if (supCore === masCore || supAliases.includes(masCore)) {
      coreNameScore = 100;
      agreementPoints.push('تطابق الاسم التجاري الأساسي');
    } else {
      const sim = stringSimilarity(supCore, masCore);
      const seqSim = sequenceMatcherRatio(cleanTextPython(supplier.coreName), cleanTextPython(master.coreName));
      const phonSim = stringSimilarity(phoneticArabic(supCore), phoneticArabic(masCore)) * 0.95;
      const bestNameSim = Math.max(sim, seqSim, phonSim);
      coreNameScore = Math.round(bestNameSim * 100);
      if (coreNameScore > 80) {
        agreementPoints.push('تشابه كبير في الاسم التجاري');
      } else {
        differencePoints.push(`اختلاف جزئي في الاسم (${supplier.coreName} مقابل ${master.coreName})`);
      }
    }

    // Token score
    const tokenSim = tokenJaccardSimilarity(supplier.coreTokens, master.coreTokens);
    const tokenScore = Math.round(tokenSim * 100);

    // 2. STRENGTH & NUMERIC COMPARISON (CRITICAL INVARIANT with dsim)
    let strengthScore = 75;
    let hasStrengthMatch = false;
    const strComp = compareStrengths(supplier, master);

    if (strComp.isMatch) {
      hasStrengthMatch = true;
      strengthScore = 100;
      agreementPoints.push(strComp.details);
    } else if (strComp.isConflict) {
      // DANGEROUS CLINICAL VIOLATION! (e.g. 500mg != 250mg, or 50,000 IU != 5,000 IU)
      strengthScore = 0;
      hardRulePassed = false;
      hardRuleViolations.push(strComp.details);
      differencePoints.push(`❌ ${strComp.details}`);
    } else {
      // Use dsim for detailed numeric & dosage similarity with penalties
      const numericSim = dsim(supplier.raw, `${masterItem.name} ${masterItem.strength || ''}`);
      strengthScore = Math.round(numericSim * 100);
      if (numericSim >= 0.95) {
        agreementPoints.push('تطابق تام في الأرقام والتركيزات');
      } else if (numericSim <= 0.35) {
        differencePoints.push('عقوبة اختلاف في الأرقام أو التركيزات');
      }
    }

    // 3. DOSAGE FORM
    let formScore = 75;
    let hasFormMatch = false;
    if (supplier.dosageForm && master.dosageForm) {
      if (supplier.dosageForm === master.dosageForm) {
        hasFormMatch = true;
        formScore = 100;
        agreementPoints.push(`تطابق الشكل الدوائي (${supplier.dosageFormLabel || supplier.dosageForm})`);
      } else {
        formScore = 20;
        const isLiquidA = ['SYRUP', 'SUSPENSION', 'DROPS', 'LOTION'].includes(supplier.dosageForm);
        const isLiquidB = ['SYRUP', 'SUSPENSION', 'DROPS', 'LOTION'].includes(master.dosageForm);
        if (isLiquidA !== isLiquidB) {
          hardRulePassed = false;
          hardRuleViolations.push(`تعارض الشكل: سائل مقابل صلب (${supplier.dosageForm} مقابل ${master.dosageForm})`);
        }
        differencePoints.push(`اختلاف الشكل الدوائي (${supplier.dosageForm} مقابل ${master.dosageForm})`);
      }
    } else if (master.dosageForm) {
      formScore = 70;
    }

    // 4. PACK SIZE
    let packScore = 75;
    if (supplier.packCount && master.packCount) {
      if (supplier.packCount === master.packCount) {
        packScore = 100;
        agreementPoints.push(`تطابق حجم العبوة (${supplier.packRaw})`);
      } else {
        packScore = 50;
        differencePoints.push(`اختلاف العبوة (${supplier.packRaw} مقابل ${master.packRaw || master.packCount})`);
      }
    }

    // 5. COMPANY
    let companyScore = 70;
    let hasCompanyMatch = false;
    if (supplier.company && master.company) {
      if (normalizeText(supplier.company) === normalizeText(master.company)) {
        hasCompanyMatch = true;
        companyScore = 100;
        agreementPoints.push(`تطابق الشركة المصنعة (${supplier.company})`);
      } else {
        companyScore = 40;
        differencePoints.push(`شركة مختلفة (${supplier.company} مقابل ${master.company})`);
      }
    } else if (master.company && supplier.raw.includes(master.company)) {
      hasCompanyMatch = true;
      companyScore = 95;
      agreementPoints.push(`تطابق الشركة (${master.company})`);
    }

    // 6. BARCODE
    let barcodeScore = 50;
    let hasBarcodeMatch = false;
    if (line.supplierBarcode && line.supplierBarcode.trim() && masterItem.barcode) {
      if (line.supplierBarcode.trim() === masterItem.barcode.trim()) {
        hasBarcodeMatch = true;
        barcodeScore = 100;
        agreementPoints.push('تطابق تام في الباركود');
      } else {
        barcodeScore = 0;
      }
    }

    // Modifiers / Descriptors
    let modifierPenalty = 0;
    const hasRetardA = supplier.descriptors.some(d => d.includes('retard') || d.includes('ريتارد') || d.includes('sr'));
    const hasRetardB = master.descriptors.some(d => d.includes('retard') || d.includes('ريتارد') || d.includes('sr'));
    if (hasRetardA && hasRetardB) {
      agreementPoints.push('تطابق ممتد المفعول (Retard / SR)');
    } else if (hasRetardA !== hasRetardB) {
      modifierPenalty = 15;
      differencePoints.push('اختلاف خاصية ممتد المفعول Retard');
    }

    // Weighted Composite Score using dynamic customizable weights
    const totalWeights =
      (this.weights.coreNameWeight || 35) +
      (this.weights.strengthWeight || 25) +
      (this.weights.formWeight || 15) +
      (this.weights.packWeight || 10) +
      (this.weights.companyWeight || 10) +
      (hasBarcodeMatch ? (this.weights.barcodeWeight || 25) : 0);

    const safeTotal = totalWeights > 0 ? totalWeights : 100;
    const wName = (this.weights.coreNameWeight || 35) / safeTotal;
    const wStrength = (this.weights.strengthWeight || 25) / safeTotal;
    const wForm = (this.weights.formWeight || 15) / safeTotal;
    const wPack = (this.weights.packWeight || 10) / safeTotal;
    const wCompany = (this.weights.companyWeight || 10) / safeTotal;
    const wBarcode = hasBarcodeMatch ? (this.weights.barcodeWeight || 25) / safeTotal : 0;

    let compositeScore =
      coreNameScore * wName +
      strengthScore * wStrength +
      formScore * wForm +
      packScore * wPack +
      companyScore * wCompany +
      (hasBarcodeMatch ? barcodeScore * wBarcode : 0);

    if (modifierPenalty > 0) {
      compositeScore = Math.max(0, compositeScore - modifierPenalty * 0.5);
    }

    // Hard Penalty if clinical violation
    if (!hardRulePassed) {
      compositeScore = Math.min(compositeScore, 50);
    }

    compositeScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

    const confidenceLevel: CandidateItem['confidenceLevel'] =
      compositeScore >= 90
        ? 'VERY_HIGH'
        : compositeScore >= 75
        ? 'HIGH'
        : compositeScore >= 50
        ? 'MEDIUM'
        : 'LOW';

    const matchReason =
      agreementPoints.length > 0
        ? agreementPoints.slice(0, 3).join('، ')
        : 'تشابه عام في المفردات';

    return {
      masterItem,
      score: compositeScore,
      confidenceLevel,
      matchReason,
      agreementPoints,
      differencePoints,
      scoreBreakdown: {
        coreNameScore,
        tokenScore,
        strengthScore,
        unitScore: strengthScore,
        companyScore,
        formScore,
        packScore,
        barcodeScore,
        aliasScore: coreNameScore,
        finalCompositeScore: compositeScore,
      },
      hasBarcodeMatch,
      hasStrengthMatch,
      hasFormMatch,
      hasCompanyMatch,
      hardRulePassed,
      hardRuleViolations,
      parsedEntity: master,
    };
  }

  /**
   * Directly evaluate a single raw supplier string against any chosen master item
   * Useful for 1-to-1 deep comparison inspection
   */
  public evaluateSinglePair(
    supplierRaw: string,
    masterItem: MasterItem,
    supplierBarcode?: string
  ): CandidateItem {
    const cleanRaw = cleanOcrArtifacts(supplierRaw);
    const supplierEntity = extractPharmaEntity(cleanRaw);
    const masterEntity =
      this.parsedMasterCache.get(masterItem.id) ||
      extractPharmaEntity(`${masterItem.name} ${masterItem.nameAr || ''} ${masterItem.dosageForm || ''} ${masterItem.strength || ''}`);

    const mockLine: SupplierInvoiceLine = {
      rowNumber: 1,
      rawSupplierName: supplierRaw,
      quantity: 1,
      unitPrice: masterItem.price,
      supplierBarcode,
    };

    return this.evaluateCandidate(supplierEntity, masterEntity, masterItem, mockLine);
  }
}
