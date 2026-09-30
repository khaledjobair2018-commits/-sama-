/**
 * Advanced Pharmaceutical Entity Extractor
 * Extracts: Core Brand Name, Strengths, Units, Dosage Forms, Pack Sizes, Volumes, Modifiers, Company
 */

import { PharmaEntity } from '../types/pharmacy';
import {
  normalizeText,
  findDosageForm,
  normalizeUnit,
  cleanOcrArtifacts,
} from './normalizer';
import {
  lookupUnit,
  lookupCompany,
  normalizeTradeNameCompound,
} from './dictionaryService';

// Regex patterns for entity extraction
const STRENGTH_REGEX = /(\d+(?:\.\d+)?)\s*(مجم|ملجم|ملغرام|مليغرام|مليجرام|ملغ|مغ|جم|جرام|غرام|غ|غم|مايكرو|مكجم|ميكروجرام|وحدة|وحدة\s*دولية|ود|iu|ui|mg|g|gm|mcg|ug|ml|l|%)\b/gi;
const RATIO_STRENGTH_REGEX = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(مجم|ملجم|ملغرام|مليغرام|مليجرام|ملغ|مغ|جم|جرام|غرام|غ|غم|مايكرو|مكجم|ميكروجرام|وحدة|وحدة\s*دولية|ود|iu|ui|mg|g|gm|mcg|ug|ml|l|%)\b/gi;
const PERCENT_REGEX = /(\d+(?:\.\d+)?)\s*(%|بالمائة|في\s*المائة)/gi;
const PACK_SIZE_REGEX = /(?:عبوة|علبة|بكيت|باكت|شريط|أمبول|امبول|فيال|كيس|قمع|تحميلة|كبسول|قرص|طرحة)?\s*(\d+)\s*(?:\*|x|X|×)\s*(\d+)/g;
const SIMPLE_PACK_REGEX = /(?:عبوة|علبة|شريط|أمبول|امبول|فيال|كيس|كبسول|قرص|طرحة|ك)\s*(\d+)\b/g;

// Descriptors and modifiers
const MODIFIERS_LIST = [
  'forte', 'فورت', 'ريتارد', 'retard', 'sr', 'cr', 'xr', 'er', 'mr', 'plus', 'بلاس', 'بلس',
  'extra', 'اكسترا', 'إكسترا', 'junior', 'جونيور', 'infant', 'رضع', 'اطفال', 'pediatric',
  'adult', 'بالغين', 'كبار', 'rapid', 'سريع', 'fast', 'max', 'ماكس', 'protect', 'بروتكت',
  'ديبو', 'depo', 'comp', 'كومب', 'hct', 'd', 'co', 'ديو', 'duo'
];

export function extractPharmaEntity(rawInput: string): PharmaEntity {
  if (!rawInput || typeof rawInput !== 'string') {
    return {
      raw: '',
      cleanText: '',
      coreName: '',
      coreTokens: [],
      descriptors: [],
    };
  }

  // 1. Pre-process and normalize
  const cleanedInput = cleanOcrArtifacts(rawInput);
  const normalized = normalizeText(cleanedInput);
  const compoundNormalized = normalizeTradeNameCompound(normalized);

  let workingText = compoundNormalized;

  // 2. Extract Strengths
  let strengthValue: number | undefined;
  let strengthUnit: string | undefined;
  let strengthRaw: string | undefined;

  // Check ratio strengths like 500/65 mg
  const ratioMatch = RATIO_STRENGTH_REGEX.exec(workingText);
  if (ratioMatch) {
    const rawVal1 = ratioMatch[1];
    const rawVal2 = ratioMatch[2];
    const rawUnit = ratioMatch[3];
    strengthUnit = lookupUnit(rawUnit) || normalizeUnit(rawUnit);
    strengthValue = parseFloat(rawVal1);
    strengthRaw = `${rawVal1}/${rawVal2} ${strengthUnit}`;
    workingText = workingText.replace(ratioMatch[0], ' ');
  } else {
    const strMatch = STRENGTH_REGEX.exec(workingText);
    if (strMatch) {
      strengthValue = parseFloat(strMatch[1]);
      const rawUnit = strMatch[2];
      strengthUnit = lookupUnit(rawUnit) || normalizeUnit(rawUnit);
      strengthRaw = `${strMatch[1]} ${strengthUnit}`;
      workingText = workingText.replace(strMatch[0], ' ');
    } else {
      const pctMatch = PERCENT_REGEX.exec(workingText);
      if (pctMatch) {
        strengthValue = parseFloat(pctMatch[1]);
        strengthUnit = '%';
        strengthRaw = `${pctMatch[1]}%`;
        workingText = workingText.replace(pctMatch[0], ' ');
      }
    }
  }

  // 3. Extract Pack Size (e.g. 10*10 or 20 tab or 20 ك)
  let packCount: number | undefined;
  let packRaw: string | undefined;
  const packMatch = PACK_SIZE_REGEX.exec(workingText);
  if (packMatch) {
    const num1 = parseInt(packMatch[1], 10);
    const num2 = parseInt(packMatch[2], 10);
    packCount = num1 * num2;
    packRaw = `${num1}x${num2}`;
    workingText = workingText.replace(packMatch[0], ' ');
  } else {
    const simplePackMatch = SIMPLE_PACK_REGEX.exec(workingText);
    if (simplePackMatch) {
      packCount = parseInt(simplePackMatch[1], 10);
      packRaw = `${packCount}`;
      workingText = workingText.replace(simplePackMatch[0], ' ');
    }
  }

  // 4. Extract Modifiers (e.g. retard, forte, sr, extra)
  const descriptors: string[] = [];
  const words = workingText.split(/\s+/).filter(Boolean);
  for (const word of words) {
    const cleanWord = word.replace(/[^\w\u0600-\u06FF]/g, '').toLowerCase();
    if (MODIFIERS_LIST.includes(cleanWord)) {
      descriptors.push(cleanWord);
      workingText = workingText.replace(new RegExp(`\\b${word}\\b`, 'i'), ' ');
    }
  }

  // 5. Extract Dosage Form
  let dosageForm: string | undefined;
  let dosageFormLabel: string | undefined;
  const formInfo = findDosageForm(rawInput) || findDosageForm(workingText);
  if (formInfo) {
    dosageForm = formInfo.standardForm;
    dosageFormLabel = formInfo.arabicLabel;
    workingText = workingText.replace(new RegExp(`\\b${formInfo.arabicLabel}\\b`, 'gi'), ' ');
    workingText = workingText.replace(new RegExp(`\\b${formInfo.standardForm}\\b`, 'gi'), ' ');
  }

  // 6. Extract Company / Manufacturer
  let company: string | undefined;
  const companyInfo = lookupCompany(rawInput) || lookupCompany(workingText);
  if (companyInfo) {
    company = companyInfo.canonical;
    workingText = workingText.replace(new RegExp(`\\b${companyInfo.canonical}\\b`, 'gi'), ' ');
    workingText = workingText.replace(new RegExp(`\\b${companyInfo.rawMatched}\\b`, 'gi'), ' ');
  }

  // 7. Clean up remaining tokens to isolate Core Trade Name
  const remainingTokens = workingText
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !/^[\d\.\-\/\*]+$/.test(t));

  const coreName = remainingTokens.slice(0, 3).join(' ').trim();

  // Extract all tokens from the raw normalized text for index lookup
  const allTokens = normalized
    .split(/\s+/)
    .map(t => t.replace(/[^\w\u0600-\u06FF]/g, '').trim())
    .filter(t => t.length > 1);

  return {
    raw: rawInput,
    cleanText: normalized,
    coreName: coreName || normalized,
    coreTokens: Array.from(new Set(allTokens)),
    strengthValue,
    strengthUnit,
    strengthRaw,
    dosageForm,
    dosageFormLabel,
    packCount,
    packRaw,
    company,
    descriptors,
  };
}

/**
 * Compare two entities' strengths
 */
export function compareStrengths(
  eA: PharmaEntity,
  eB: PharmaEntity
): {
  isMatch: boolean;
  isConflict: boolean;
  isEquivalent: boolean;
  details: string;
} {
  if (eA.strengthValue === undefined || eB.strengthValue === undefined) {
    return {
      isMatch: false,
      isConflict: false,
      isEquivalent: false,
      details: 'أحد الطرفين أو كلاهما بدون تركيز محدد',
    };
  }

  // Same value and same unit
  if (eA.strengthValue === eB.strengthValue && eA.strengthUnit === eB.strengthUnit) {
    return {
      isMatch: true,
      isConflict: false,
      isEquivalent: false,
      details: `تطابق تام في التركيز (${eA.strengthValue} ${eA.strengthUnit || ''})`,
    };
  }

  // Unit equivalence (1000mg == 1g)
  if (eA.strengthUnit === 'MG' && eB.strengthUnit === 'G' && Math.abs(eA.strengthValue - eB.strengthValue * 1000) < 0.001) {
    return {
      isMatch: true,
      isConflict: false,
      isEquivalent: true,
      details: `تطابق مكافئ (${eA.strengthValue}mg = ${eB.strengthValue}g)`,
    };
  }
  if (eA.strengthUnit === 'G' && eB.strengthUnit === 'MG' && Math.abs(eA.strengthValue * 1000 - eB.strengthValue) < 0.001) {
    return {
      isMatch: true,
      isConflict: false,
      isEquivalent: true,
      details: `تطابق مكافئ (${eA.strengthValue}g = ${eB.strengthValue}mg)`,
    };
  }

  // Both have strength and they differ! This is a dangerous conflict.
  return {
    isMatch: false,
    isConflict: true,
    isEquivalent: false,
    details: `اختلاف في التركيز: (${eA.strengthValue} ${eA.strengthUnit || ''}) مقابل (${eB.strengthValue} ${eB.strengthUnit || ''})`,
  };
}
