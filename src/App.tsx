import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AppSettings,
  AuditLogEntry,
  ConfirmedMapping,
  MasterItem,
  MatchResult,
  StoredInvoice,
  SupplierInvoiceLine,
  ScoringWeights,
} from './types/pharmacy';
import { storage } from './services/storage';
import { PharmacyMatchEngine } from './services/matcher';
import { SAMPLE_INVOICES } from './services/sampleInvoices';
import { normalizeText } from './services/normalizer';
import { aiMatchService } from './services/aiMatcher';
import { Navbar, ActiveTab } from './components/Navbar';
import { InvoiceMatchingView } from './components/InvoiceMatchingView';
import { NewInvoiceView } from './components/NewInvoiceView';
import { ReviewModal } from './components/ReviewModal';
import { PrintInvoiceReport } from './components/PrintInvoiceReport';
import { PriceReportView } from './components/PriceReportView';
import { SmartPurchasingGuideView } from './components/SmartPurchasingGuideView';
import { MasterDatabaseView } from './components/MasterDatabaseView';
import { ConfirmedMappingsView } from './components/ConfirmedMappingsView';
import { HistoryView } from './components/HistoryView';
import { BackupRestoreView } from './components/BackupRestoreView';
import { TestsView } from './components/TestsView';
import { MatchEngineTestView } from './components/MatchEngineTestView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('matching');

  // Stored State
  const [masterItems, setMasterItems] = useState<MasterItem[]>(() => storage.getMasterItems());
  const [confirmedMappings, setConfirmedMappings] = useState<ConfirmedMapping[]>(() => storage.getConfirmedMappings());
  const [storedInvoices, setStoredInvoices] = useState<StoredInvoice[]>(() => storage.getStoredInvoices());
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => storage.getAuditLog());
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());

  // Active Invoice State
  const [activeLines, setActiveLines] = useState<SupplierInvoiceLine[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [invoiceMeta, setInvoiceMeta] = useState<{
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    fileName?: string;
  }>({
    supplierName: 'شركة الدواء للتوزيع المحدودة',
    invoiceNumber: 'INV-2026-9841',
    invoiceDate: new Date().toISOString().slice(0, 10),
  });

  // Review & Print Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewFocusRowIndex, setReviewFocusRowIndex] = useState<number | undefined>(undefined);
  const [isPrintReportOpen, setIsPrintReportOpen] = useState(false);
  const [isAiMatching, setIsAiMatching] = useState(false);

  // Initialize Match Engine
  const matchEngine = useMemo(() => {
    return new PharmacyMatchEngine(masterItems, confirmedMappings, {
      highConfidenceThreshold: settings.highConfidenceThreshold,
      reviewThreshold: settings.reviewThreshold,
    });
  }, [masterItems, confirmedMappings, settings.highConfidenceThreshold, settings.reviewThreshold]);

  // Initial fetch from Google Sheets for persistent memory across sessions
  useEffect(() => {
    storage.fetchFromGoogleSheets().then(res => {
      if (res.success && res.mappingsCount && res.mappingsCount > 0) {
        const updated = storage.getConfirmedMappings();
        setConfirmedMappings(updated);
        matchEngine.updateConfirmedMappings(updated);
      }
    });
  }, [matchEngine]);

  // Initial auto-seed with Sample Invoice 1 for instantaneous live experience!
  useEffect(() => {
    if (activeLines.length === 0 && SAMPLE_INVOICES.length > 0) {
      const sample = SAMPLE_INVOICES[0];
      const initialResults = matchEngine.matchInvoice(sample.lines);
      setActiveLines(sample.lines);
      setMatchResults(initialResults);
      setInvoiceMeta({
        supplierName: sample.supplierName,
        invoiceNumber: sample.invoiceNumber,
        invoiceDate: sample.invoiceDate,
      });
    }
  }, [matchEngine, activeLines.length]);

  // Trigger matching on an invoice
  const handleStartMatching = useCallback(
    (
      lines: SupplierInvoiceLine[],
      meta: { supplierName: string; invoiceNumber: string; invoiceDate: string; fileName?: string }
    ) => {
      const results = matchEngine.matchInvoice(lines);

      setActiveLines(lines);
      setMatchResults(results);
      setInvoiceMeta(meta);

      // Save to stored invoices
      const invoiceId = `INV-${Date.now()}`;
      const matchedCount = results.filter(r => r.status === 'MATCHED').length;
      const reviewCount = results.filter(r => r.status === 'REVIEW_REQUIRED').length;
      const unmatchedCount = results.filter(r => r.status === 'UNMATCHED').length;
      const errorCount = results.filter(r => r.status === 'ERROR').length;

      const totalSupplierCost = results.reduce((acc, r) => acc + r.totalSupplierCost, 0);
      const totalMasterCost = results.reduce((acc, r) => acc + (r.matchedItem ? r.totalMasterCost : 0), 0);
      const totalVariance = results.reduce((acc, r) => acc + (r.matchedItem ? r.totalDifference : 0), 0);

      const storedRecord: StoredInvoice = {
        header: {
          id: invoiceId,
          invoiceNumber: meta.invoiceNumber,
          supplierName: meta.supplierName,
          invoiceDate: meta.invoiceDate,
          fileName: meta.fileName,
          importedAt: new Date().toISOString(),
          totalRows: lines.length,
          matchedRows: matchedCount,
          reviewRows: reviewCount,
          unmatchedRows: unmatchedCount,
          errorRows: errorCount,
          totalSupplierAmount: Math.round(totalSupplierCost * 100) / 100,
          totalMasterAmount: Math.round(totalMasterCost * 100) / 100,
          totalPriceVariance: Math.round(totalVariance * 100) / 100,
          status: 'REVIEWED',
        },
        lines,
        matchResults: results,
        createdAt: new Date().toISOString(),
      };

      storage.saveInvoice(storedRecord);
      setStoredInvoices(storage.getStoredInvoices());
      setAuditLogs(storage.getAuditLog());

      setActiveTab('matching');
    },
    [matchEngine]
  );

  // Rematch current active invoice lines
  const handleRematchAll = useCallback(() => {
    if (activeLines.length === 0) return;
    const newResults = matchEngine.matchInvoice(activeLines);
    setMatchResults(newResults);
    storage.addAuditLog('إعادة مطابقة', `إعادة تشغيل المحرك على فاتورة ${invoiceMeta.supplierName}`);
    setAuditLogs(storage.getAuditLog());
  }, [activeLines, matchEngine, invoiceMeta.supplierName]);

  // Run Gemini AI matching on pending review and unmatched lines with "Dictionary First" logic to conserve quota
  const handleRunAiMatchOnPending = useCallback(async () => {
    if (matchResults.length === 0 || isAiMatching) return;

    const pending = matchResults.filter(
      r => r.status === 'REVIEW_REQUIRED' || r.status === 'UNMATCHED'
    );
    if (pending.length === 0) return;

    setIsAiMatching(true);

    try {
      const updatedResults = [...matchResults];
      const localDict = storage.getConfirmedMappings();
      const dictByClean = new Map(localDict.map(m => [m.supplierNameCleaned, m]));

      let dictionaryMatchesCount = 0;
      let geminiCallsCount = 0;

      for (const row of pending.slice(0, 10)) {
        const rawName = row.invoiceLine.rawSupplierName || '';
        const cleanName = normalizeText(rawName);

        // 1. DICTIONARY FIRST CHECK: Look up in local persistent dictionary (synced from Google Sheets)
        const dictMatch = dictByClean.get(cleanName);
        if (dictMatch) {
          const targetMaster = masterItems.find(
            m => m.id === dictMatch.masterItemId || (dictMatch.officialBarcode && m.barcode === dictMatch.officialBarcode)
          );

          if (targetMaster) {
            const idx = updatedResults.findIndex(r => r.rowNumber === row.rowNumber);
            if (idx !== -1) {
              const current = updatedResults[idx];
              const qty = current.invoiceLine.quantity || 1;
              const supPrice = current.invoiceLine.unitPrice || 0;
              const masterPrice = targetMaster.price || 0;
              const pDiff = supPrice - masterPrice;
              const pDiffPct = masterPrice > 0 ? (pDiff / masterPrice) * 100 : 0;

              updatedResults[idx] = {
                ...current,
                status: 'MATCHED',
                confidenceScore: 100,
                matchedItem: targetMaster,
                notes: 'تمت المطابقة فوراً عبر القاموس المحلي المعتمد (بدون استهلاك Gemini)',
                reviewReason: undefined,
                priceDifference: Math.round(pDiff * 100) / 100,
                priceDiffPercentage: Math.round(pDiffPct * 10) / 10,
              };
              dictionaryMatchesCount++;
              continue; // Successfully matched via dictionary, skip Gemini API!
            }
          }
        }

        // 2. Only if not in dictionary: Call Gemini once
        geminiCallsCount++;
        const aiRes = await aiMatchService.matchLine(row.invoiceLine, row.candidates);
        if (!aiRes) continue;

        const idx = updatedResults.findIndex(r => r.rowNumber === row.rowNumber);
        if (idx === -1) continue;

        const current = updatedResults[idx];
        const matchedCandidate = current.candidates.find(
          c => c.masterItem.id === aiRes.matchedItemId
        );
        const targetMaster =
          matchedCandidate?.masterItem ||
          masterItems.find(m => m.id === aiRes.matchedItemId);

        if (
          aiRes.decision === 'MATCHED' &&
          aiRes.confidenceScore >= 85 &&
          aiRes.safetyRiskLevel === 'SAFE' &&
          targetMaster
        ) {
          const qty = current.invoiceLine.quantity || 1;
          const supPrice = current.invoiceLine.unitPrice || 0;
          const masterPrice = targetMaster.price || 0;
          const pDiff = supPrice - masterPrice;
          const pDiffPct = masterPrice > 0 ? (pDiff / masterPrice) * 100 : 0;

          // Automatically save new valid AI match to Dictionary and sync to Google Sheets!
          storage.saveConfirmedMapping({
            supplierNameOriginal: row.invoiceLine.rawSupplierName,
            supplierNameCleaned: cleanName,
            masterItemId: targetMaster.id,
            masterItemName: targetMaster.name,
            officialBarcode: targetMaster.barcode,
          });

          updatedResults[idx] = {
            ...current,
            status: 'MATCHED',
            confidenceScore: Math.max(current.confidenceScore, aiRes.confidenceScore),
            matchedItem: targetMaster,
            notes: 'تمت المطابقة بالذكاء الاصطناعي وحفظها تلقائياً في القاموس وقاعدة Google Sheets',
            reviewReason: undefined,
            priceDifference: Math.round(pDiff * 100) / 100,
            priceDiffPercentage: Math.round(pDiffPct * 10) / 10,
            aiAnalysis: {
              isAiAssisted: true,
              confidenceScore: aiRes.confidenceScore,
              clinicalRationale: aiRes.clinicalRationale,
              detectedActiveIngredient: aiRes.detectedActiveIngredient,
              dosageFormConfirmed: aiRes.dosageFormConfirmed,
              strengthConfirmed: aiRes.strengthConfirmed,
              agreementPoints: aiRes.agreementPoints || [],
              differencePoints: aiRes.differencePoints || [],
              safetyRiskLevel: aiRes.safetyRiskLevel,
              safetyDetails: aiRes.safetyDetails,
              modelUsed: 'gemini-3.8-flash',
            },
          };
        } else {
          updatedResults[idx] = {
            ...current,
            aiAnalysis: {
              isAiAssisted: true,
              confidenceScore: aiRes.confidenceScore,
              clinicalRationale: aiRes.clinicalRationale,
              detectedActiveIngredient: aiRes.detectedActiveIngredient,
              dosageFormConfirmed: aiRes.dosageFormConfirmed,
              strengthConfirmed: aiRes.strengthConfirmed,
              agreementPoints: aiRes.agreementPoints || [],
              differencePoints: aiRes.differencePoints || [],
              safetyRiskLevel: aiRes.safetyRiskLevel,
              safetyDetails: aiRes.safetyDetails,
              modelUsed: 'gemini-3.8-flash',
            },
          };
        }
      }

      setMatchResults(updatedResults);
      const updatedMappings = storage.getConfirmedMappings();
      setConfirmedMappings(updatedMappings);
      matchEngine.updateConfirmedMappings(updatedMappings);

      storage.addAuditLog(
        'مطابقة ذكية موفرة',
        `تمت المطابقة بنجاح: ${dictionaryMatchesCount} صنف عبر القاموس فورياً، و${geminiCallsCount} صنف استدعى Gemini وحُفظ في Google Sheets`
      );
      setAuditLogs(storage.getAuditLog());
    } finally {
      setIsAiMatching(false);
    }
  }, [matchResults, isAiMatching, masterItems, invoiceMeta.supplierName, matchEngine]);

  // Pharmacist confirms a match manually in review
  const handleConfirmMatch = useCallback(
    (rowNumber: number, chosenMasterItem: MasterItem, saveToDictionary: boolean) => {
      setMatchResults(prevResults => {
        return prevResults.map(r => {
          if (r.rowNumber !== rowNumber) return r;

          const qty = r.invoiceLine.quantity || 1;
          const supplierPrice = r.invoiceLine.unitPrice || 0;
          const masterPrice = chosenMasterItem.price || 0;
          const priceDiff = supplierPrice - masterPrice;
          const priceDiffPct = masterPrice > 0 ? (priceDiff / masterPrice) * 100 : 0;
          const totalSupplierCost = supplierPrice * qty;
          const totalMasterCost = masterPrice * qty;
          const totalDiff = totalSupplierCost - totalMasterCost;

          return {
            ...r,
            status: 'MATCHED',
            confidenceScore: 100,
            matchedItem: chosenMasterItem,
            isManuallyConfirmed: true,
            notes: 'تم الاعتماد يدوياً بواسطة الصيدلي',
            reviewReason: undefined,
            priceDifference: Math.round(priceDiff * 100) / 100,
            priceDiffPercentage: Math.round(priceDiffPct * 10) / 10,
            totalSupplierCost: Math.round(totalSupplierCost * 100) / 100,
            totalMasterCost: Math.round(totalMasterCost * 100) / 100,
            totalDifference: Math.round(totalDiff * 100) / 100,
          };
        });
      });

      // Find the row
      const line = activeLines.find(l => l.rowNumber === rowNumber);
      if (saveToDictionary && line) {
        const normClean = normalizeText(line.rawSupplierName);
        storage.saveConfirmedMapping({
          supplierNameCleaned: normClean,
          supplierNameOriginal: line.rawSupplierName,
          masterItemId: chosenMasterItem.id,
          masterItemName: chosenMasterItem.name,
          officialBarcode: chosenMasterItem.barcode,
        });

        const updatedMappings = storage.getConfirmedMappings();
        setConfirmedMappings(updatedMappings);
        matchEngine.updateData(masterItems, updatedMappings);
      }

      setAuditLogs(storage.getAuditLog());
    },
    [activeLines, masterItems, matchEngine]
  );

  // Pharmacist adds a brand new product to DB directly from review
  const handleAddNewProductAndMatch = useCallback(
    (newProduct: Partial<MasterItem>, rowNumber: number) => {
      const createdItem: MasterItem = {
        id: `MI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: newProduct.name || '',
        nameAr: newProduct.nameAr || newProduct.name || '',
        barcode: newProduct.barcode || `628${Date.now().toString().slice(-9)}`,
        price: newProduct.price || 0,
        costPrice: Math.round((newProduct.price || 0) * 0.8 * 100) / 100,
        dosageForm: newProduct.dosageForm || 'اقراص',
        strength: newProduct.strength,
        packSize: newProduct.packSize,
        company: newProduct.company,
        activeIngredient: newProduct.activeIngredient,
        updatedAt: new Date().toISOString(),
      };

      // 1. Add to storage master items
      storage.addMasterItems([createdItem], true);
      const updatedMaster = storage.getMasterItems();
      setMasterItems(updatedMaster);

      // 2. Auto map and confirm for this row
      handleConfirmMatch(rowNumber, createdItem, true);

      // 3. Update match engine data
      matchEngine.updateData(updatedMaster, storage.getConfirmedMappings());
      storage.addAuditLog('إضافة صنف جديد', `تمت إضافة الصنف '${createdItem.name}' لقاعدة البيانات من شاشة المراجعة`);
      setAuditLogs(storage.getAuditLog());
    },
    [handleConfirmMatch, matchEngine]
  );

  // Mark a row as unmatched
  const handleMarkUnmatched = useCallback((rowNumber: number) => {
    setMatchResults(prev =>
      prev.map(r =>
        r.rowNumber === rowNumber
          ? {
              ...r,
              status: 'UNMATCHED',
              matchedItem: undefined,
              unmatchedReason: 'تم التأكيد يدوياً كصنف غير موجود في النظام',
            }
      : r
    )
  );
  }, []);

  // Open stored past invoice
  const handleOpenStoredInvoice = useCallback((stored: StoredInvoice) => {
    setActiveLines(stored.lines);
    setMatchResults(stored.matchResults);
    setInvoiceMeta({
      supplierName: stored.header.supplierName,
      invoiceNumber: stored.header.invoiceNumber,
      invoiceDate: stored.header.invoiceDate,
      fileName: stored.header.fileName,
    });
    setActiveTab('matching');
  }, []);

  // Master Items changes
  const handleSaveMasterItems = useCallback(
    (newItems: MasterItem[]) => {
      storage.saveMasterItems(newItems);
      setMasterItems(newItems);
      matchEngine.updateData(newItems, confirmedMappings);
      setAuditLogs(storage.getAuditLog());
    },
    [confirmedMappings, matchEngine]
  );

  const handleAddOrUpdateMasterItems = useCallback(
    (newItems: MasterItem[], updateExisting: boolean) => {
      const stats = storage.addMasterItems(newItems, updateExisting);
      const updated = storage.getMasterItems();
      setMasterItems(updated);
      matchEngine.updateData(updated, confirmedMappings);
      setAuditLogs(storage.getAuditLog());
      return stats;
    },
    [confirmedMappings, matchEngine]
  );

  const handleDeleteMapping = useCallback(
    (id: string) => {
      storage.deleteConfirmedMapping(id);
      const updated = storage.getConfirmedMappings();
      setConfirmedMappings(updated);
      matchEngine.updateData(masterItems, updated);
      setAuditLogs(storage.getAuditLog());
    },
    [masterItems, matchEngine]
  );

  const handleDeleteStoredInvoice = useCallback((id: string) => {
    storage.deleteStoredInvoice(id);
    setStoredInvoices(storage.getStoredInvoices());
    setAuditLogs(storage.getAuditLog());
  }, []);

  const handleSaveSettings = useCallback((newSettings: AppSettings) => {
    const updated = storage.saveSettings(newSettings);
    setSettings(updated);
  }, []);

  const handleSaveWeights = useCallback((newWeights: ScoringWeights) => {
    const updated: AppSettings = {
      ...settings,
      weights: newWeights,
    };
    storage.saveSettings(updated);
    setSettings(updated);
    matchEngine.setWeights(newWeights);
    storage.addAuditLog('تحديث أوزان المحرك', 'تم تحديث أوزان مطابقة الأصناف من واجهة فحص المحرك');
    setAuditLogs(storage.getAuditLog());
  }, [settings, matchEngine]);

  const handleDataReload = useCallback(() => {
    const items = storage.getMasterItems();
    const mappings = storage.getConfirmedMappings();
    const invs = storage.getStoredInvoices();
    const logs = storage.getAuditLog();
    const sets = storage.getSettings();

    setMasterItems(items);
    setConfirmedMappings(mappings);
    setStoredInvoices(invs);
    setAuditLogs(logs);
    setSettings(sets);
    matchEngine.updateData(items, mappings);
  }, [matchEngine]);

  const handleOpenReview = useCallback((rowNumber?: number) => {
    setReviewFocusRowIndex(rowNumber);
    setIsReviewModalOpen(true);
  }, []);

  // Filter review-needed rows
  const rowsNeedingReview = useMemo(() => {
    if (reviewFocusRowIndex !== undefined) {
      const target = matchResults.filter(r => r.rowNumber === reviewFocusRowIndex);
      if (target.length > 0) return target;
    }
    const reviews = matchResults.filter(r => r.status === 'REVIEW_REQUIRED');
    return reviews.length > 0 ? reviews : matchResults.filter(r => r.status === 'UNMATCHED');
  }, [matchResults, reviewFocusRowIndex]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Cairo',sans-serif]">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        results={matchResults}
        pharmacyName={settings.pharmacyName}
        invoiceSupplier={invoiceMeta.supplierName}
        invoiceNumber={invoiceMeta.invoiceNumber}
        onOpenPrintReport={() => setIsPrintReportOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'matching' && (
          <InvoiceMatchingView
            results={matchResults}
            onOpenReview={handleOpenReview}
            onRematchAll={handleRematchAll}
            currency={settings.currency}
            invoiceSupplier={invoiceMeta.supplierName}
            invoiceNumber={invoiceMeta.invoiceNumber}
            onManualSelectMaster={(rowNum, masterItem) =>
              handleConfirmMatch(rowNum, masterItem, settings.autoLearnOnManualConfirm)
            }
            onNavigateToNewInvoice={() => setActiveTab('new_invoice')}
            onRunAiMatch={handleRunAiMatchOnPending}
            isAiMatching={isAiMatching}
            onOpenPrintReport={() => setIsPrintReportOpen(true)}
          />
        )}

        {activeTab === 'new_invoice' && (
          <NewInvoiceView
            onStartMatching={handleStartMatching}
            currency={settings.currency}
          />
        )}

        {activeTab === 'review' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {rowsNeedingReview.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-xs">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  ✓
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  جميع أصناف الفاتورة تمت مراجعتها ومطابقتها!
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  لا توجد أصناف معلقة في حالة "يحتاج مراجعة". يمكنك الآن تصدير ملف الإدخال السريع.
                </p>
                <button
                  onClick={() => setActiveTab('matching')}
                  className="bg-emerald-600 text-white font-bold px-5 py-2 rounded-xl text-xs"
                >
                  العودة إلى جدول الفاتورة
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-6 py-3 rounded-2xl text-sm shadow-md transition"
                >
                  فتح شاشة المراجعة التفاعلية ({rowsNeedingReview.length} صنف يحتاج قرار الصيدلي)
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'match_engine_test' && (
          <MatchEngineTestView
            masterItems={masterItems}
            currentWeights={settings.weights}
            onSaveWeights={handleSaveWeights}
            currency={settings.currency}
          />
        )}

        {activeTab === 'price_report' && (
          <PriceReportView
            results={matchResults}
            currency={settings.currency}
            masterItems={masterItems}
            storedInvoices={storedInvoices}
            invoiceSupplier={invoiceMeta.supplierName}
            onOpenPrintReport={() => setIsPrintReportOpen(true)}
          />
        )}

        {activeTab === 'purchasing_guide' && (
          <SmartPurchasingGuideView
            storedInvoices={storedInvoices}
            masterItems={masterItems}
            activeInvoiceResults={matchResults}
            activeSupplier={invoiceMeta.supplierName}
            currency={settings.currency}
          />
        )}

        {activeTab === 'master_db' && (
          <MasterDatabaseView
            items={masterItems}
            onSaveItems={handleSaveMasterItems}
            onAddOrUpdateItems={handleAddOrUpdateMasterItems}
            currency={settings.currency}
          />
        )}

        {activeTab === 'mappings' && (
          <ConfirmedMappingsView
            mappings={confirmedMappings}
            onDeleteMapping={handleDeleteMapping}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            invoices={storedInvoices}
            auditLogs={auditLogs}
            onOpenStoredInvoice={handleOpenStoredInvoice}
            onDeleteInvoice={handleDeleteStoredInvoice}
            currency={settings.currency}
          />
        )}

        {activeTab === 'backup' && <BackupRestoreView onDataReload={handleDataReload} />}

        {activeTab === 'tests' && <TestsView />}

        {activeTab === 'settings' && (
          <SettingsView settings={settings} onSaveSettings={handleSaveSettings} />
        )}
      </main>

      {/* Interactive Review Modal */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewFocusRowIndex(undefined);
        }}
        reviewResults={rowsNeedingReview}
        allMasterItems={masterItems}
        onConfirmMatch={handleConfirmMatch}
        onMarkUnmatched={handleMarkUnmatched}
        onAddNewProduct={handleAddNewProductAndMatch}
        currency={settings.currency}
      />

      {/* Premium Print & Inspection Report */}
      <PrintInvoiceReport
        isOpen={isPrintReportOpen}
        onClose={() => setIsPrintReportOpen(false)}
        results={matchResults}
        invoiceInfo={{
          supplierName: invoiceMeta.supplierName,
          invoiceNumber: invoiceMeta.invoiceNumber,
          invoiceDate: invoiceMeta.invoiceDate,
        }}
        pharmacyName={settings.pharmacyName}
        currency={settings.currency}
        masterItems={masterItems}
      />
    </div>
  );
}
