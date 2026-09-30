import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  Layers,
  Sparkles,
  Bot,
  Printer,
} from 'lucide-react';
import { MasterItem, MatchResult, MatchStatus } from '../types/pharmacy';
import { InvoiceSummaryCards } from './InvoiceSummaryCards';
import { excelService } from '../services/excelService';

interface InvoiceMatchingViewProps {
  results: MatchResult[];
  onOpenReview: (rowIndex?: number) => void;
  onRematchAll: () => void;
  currency: string;
  invoiceSupplier?: string;
  invoiceNumber?: string;
  onManualSelectMaster: (rowNumber: number, masterItem: MasterItem) => void;
  onNavigateToNewInvoice: () => void;
  onRunAiMatch?: () => void;
  isAiMatching?: boolean;
  onOpenPrintReport?: () => void;
}

export const InvoiceMatchingView: React.FC<InvoiceMatchingViewProps> = ({
  results,
  onOpenReview,
  onRematchAll,
  currency,
  invoiceSupplier = 'المورد',
  invoiceNumber = '',
  onNavigateToNewInvoice,
  onRunAiMatch,
  isAiMatching = false,
  onOpenPrintReport,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MatchStatus>('ALL');
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  if (results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <FileSpreadsheet className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">لا توجد فاتورة مورد مفتوحة حالياً</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          قم برفع ملف فاتورة المورد (Excel, CSV, أو نص) لمطابقة الأصناف مع قاعدة البيانات الرسمية
          واستخراج ملف الإدخال السريع.
        </p>
        <button
          onClick={onNavigateToNewInvoice}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-emerald-700/20 transition"
        >
          رفع أو اختيار فاتورة جديدة الآن
        </button>
      </div>
    );
  }

  // Filter while keeping the original row sequence!
  const filteredResults = results.filter(r => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    if (!matchesStatus) return false;

    if (!searchFilter.trim()) return true;
    const query = searchFilter.toLowerCase();
    return (
      r.invoiceLine.rawSupplierName.toLowerCase().includes(query) ||
      (r.matchedItem && r.matchedItem.name.toLowerCase().includes(query)) ||
      (r.matchedItem && r.matchedItem.barcode.includes(query)) ||
      (r.invoiceLine.supplierBarcode && r.invoiceLine.supplierBarcode.includes(query))
    );
  });

  const reviewNeededCount = results.filter(r => r.status === 'REVIEW_REQUIRED').length;
  const unmatchedCount = results.filter(r => r.status === 'UNMATCHED').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 1. Summary Cards Dashboard */}
      <InvoiceSummaryCards results={results} currency={currency} />

      {/* 2. Actions & Exports Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search & Status Filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[240px] flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="بحث في أصناف الفاتورة أو الباركود..."
                className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center space-x-1 space-x-reverse bg-slate-100 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'ALL' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
                }`}
              >
                الكل ({results.length})
              </button>
              <button
                onClick={() => setStatusFilter('MATCHED')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'MATCHED' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-800'
                }`}
              >
                مطابق ({results.filter(r => r.status === 'MATCHED').length})
              </button>
              <button
                onClick={() => setStatusFilter('REVIEW_REQUIRED')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'REVIEW_REQUIRED' ? 'bg-amber-600 text-white font-bold' : 'text-amber-800'
                }`}
              >
                مراجعة ({reviewNeededCount})
              </button>
              <button
                onClick={() => setStatusFilter('UNMATCHED')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  statusFilter === 'UNMATCHED' ? 'bg-rose-600 text-white font-bold' : 'text-rose-800'
                }`}
              >
                غير مطابق ({unmatchedCount})
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onRunAiMatch && (
              <button
                onClick={onRunAiMatch}
                disabled={isAiMatching}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 space-x-reverse shadow-xs disabled:opacity-50 cursor-pointer"
                title="تشغيل محرك الذكاء الاصطناعي (Gemini 3.8 Flash) على السطور المعلقة لتأكيد المطابقة"
              >
                <Sparkles className={`w-4 h-4 text-purple-200 ${isAiMatching ? 'animate-spin' : ''}`} />
                <span>{isAiMatching ? 'جارِ فحص الذكاء الاصطناعي...' : 'مطابقة الذكاء الاصطناعي (Gemini)'}</span>
              </button>
            )}

            {reviewNeededCount > 0 && (
              <button
                onClick={() => onOpenReview()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 space-x-reverse shadow-xs"
              >
                <AlertTriangle className="w-4 h-4 text-slate-900" />
                <span>مراجعة الأصناف المعلقة ({reviewNeededCount})</span>
              </button>
            )}

            <button
              onClick={onRematchAll}
              title="إعادة تشغيل المحرك بعد تحديث الأصناف أو القاموس"
              className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition text-xs font-semibold flex items-center space-x-1 space-x-reverse"
            >
              <RefreshCw className="w-4 h-4 text-slate-500" />
              <span>إعادة المطابقة</span>
            </button>

            {/* Print & Inspection Report Button */}
            {onOpenPrintReport && (
              <button
                onClick={onOpenPrintReport}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 space-x-reverse shadow-xs cursor-pointer"
                title="عرض وطباعة تقرير الفحص والمطابقة الرسمي مع كود QR"
              >
                <Printer className="w-4 h-4 text-emerald-400 ml-1" />
                <span>طباعة تقرير الفاتورة (QR)</span>
              </button>
            )}

            {/* Quick Entry File Main Export */}
            <div className="relative">
              <button
                onClick={() => excelService.exportQuickEntryFile(results, 'xlsx', currency)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-2 space-x-reverse shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>تصدير ملف الإدخال السريع (Excel)</span>
              </button>
            </div>

            {/* Dropdown for other exports */}
            <div className="relative">
              <button
                onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1 space-x-reverse"
              >
                <span>تقارير أخرى</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {exportDropdownOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs">
                  <button
                    onClick={() => {
                      excelService.exportQuickEntryFile(results, 'csv', currency);
                      setExportDropdownOpen(false);
                    }}
                    className="w-full text-right px-4 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>ملف الإدخال بصيغة CSV</span>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => {
                      excelService.exportFullMatchReport(results, { invoiceNumber, supplierName: invoiceSupplier }, currency);
                      setExportDropdownOpen(false);
                    }}
                    className="w-full text-right px-4 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>تقرير المطابقة الكامل (Excel)</span>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => {
                      excelService.exportPriceVarianceReport(results, currency);
                      setExportDropdownOpen(false);
                    }}
                    className="w-full text-right px-4 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>تقرير فروق الأسعار (Excel)</span>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    onClick={() => {
                      excelService.exportUnmatchedReport(results, currency);
                      setExportDropdownOpen(false);
                    }}
                    className="w-full text-right px-4 py-2 hover:bg-slate-50 flex items-center justify-between"
                  >
                    <span>تقرير الأصناف غير المطابقة</span>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Strict Invoice Sequence Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-2 space-x-reverse font-medium">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>
              جدول المطابقة - محتفظ بنسبة 100% بترتيب أسطر فاتورة المورد الأصلية
            </span>
          </div>
          <div>
            عرض {filteredResults.length} من أصل {results.length} سطر
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                <th className="py-3 px-3 w-12 text-center">الترتيب</th>
                <th className="py-3 px-3 min-w-[200px]">الصنف في فاتورة المورد</th>
                <th className="py-3 px-3 min-w-[220px]">الصنف الرسمي في النظام</th>
                <th className="py-3 px-3 w-32 font-mono">الباركود الرسمي</th>
                <th className="py-3 px-2 w-16 text-center">الكمية</th>
                <th className="py-3 px-3 w-24">سعر المورد</th>
                <th className="py-3 px-3 w-24">سعر النظام</th>
                <th className="py-3 px-3 w-28">فارق السعر</th>
                <th className="py-3 px-2 w-20 text-center">الثقة</th>
                <th className="py-3 px-3 w-28 text-center">الحالة</th>
                <th className="py-3 px-3 w-24 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResults.map(result => {
                const matched = result.matchedItem;
                const isMatched = result.status === 'MATCHED';
                const isReview = result.status === 'REVIEW_REQUIRED';
                const isUnmatched = result.status === 'UNMATCHED';

                const priceDiff = result.priceDifference;
                const priceHigher = priceDiff > 0;
                const priceLower = priceDiff < 0;

                return (
                  <tr
                    key={result.rowNumber}
                    className={`hover:bg-slate-50/80 transition ${
                      isReview ? 'bg-amber-50/30' : isUnmatched ? 'bg-rose-50/20' : ''
                    }`}
                  >
                    {/* Row Order: STRICTLY PRESERVED */}
                    <td className="py-3 px-3 text-center font-bold text-slate-500 font-mono bg-slate-50/50">
                      {result.rowNumber}
                    </td>

                    {/* Supplier Raw Name */}
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      <div>{result.invoiceLine.rawSupplierName}</div>
                      {result.invoiceLine.supplierBarcode && (
                        <div className="text-[11px] text-slate-400 font-mono">
                          كود المورد: {result.invoiceLine.supplierBarcode}
                        </div>
                      )}
                    </td>

                    {/* Master Matched Name */}
                    <td className="py-3 px-3">
                      {matched ? (
                        <div>
                          <span className="font-bold text-slate-900 block">{matched.name}</span>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-2 space-x-reverse mt-0.5">
                            {matched.strength && (
                              <span className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-medium">
                                {matched.strength}
                              </span>
                            )}
                            {matched.dosageForm && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">
                                {matched.dosageForm}
                              </span>
                            )}
                            {result.aiAnalysis && (
                              <span
                                className="inline-flex items-center space-x-1 space-x-reverse text-[10px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200"
                                title={result.aiAnalysis.clinicalRationale}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-purple-600 ml-0.5" />
                                <span>AI ({result.aiAnalysis.detectedActiveIngredient || 'Gemini'})</span>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400 italic">
                          {isReview ? 'يحتاج مراجعة واختيار الصيدلي' : 'لم يتم العثور على صنف رسمي'}
                        </div>
                      )}
                    </td>

                    {/* Official Barcode */}
                    <td className="py-3 px-3 font-mono font-medium text-slate-700">
                      {matched ? (
                        <span className="bg-slate-100 px-2 py-1 rounded text-[11px] border border-slate-200">
                          {matched.barcode}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-800">
                      {result.invoiceLine.quantity}
                    </td>

                    {/* Supplier Unit Price */}
                    <td className="py-3 px-3 font-mono text-slate-900 font-semibold">
                      {result.invoiceLine.unitPrice.toFixed(2)}
                    </td>

                    {/* Official System Price */}
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {matched ? matched.price.toFixed(2) : '—'}
                    </td>

                    {/* Price Difference */}
                    <td className="py-3 px-3 font-mono text-xs">
                      {matched ? (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded font-bold ${
                            priceHigher
                              ? 'bg-red-50 text-red-700'
                              : priceLower
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          {priceHigher ? `+${priceDiff.toFixed(2)}` : priceDiff.toFixed(2)}
                          {result.priceDiffPercentage !== 0 && (
                            <span className="text-[10px] mr-1">({result.priceDiffPercentage}%)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Confidence Score */}
                    <td className="py-3 px-2 text-center font-mono font-bold">
                      <span
                        className={`text-xs ${
                          result.confidenceScore >= 90
                            ? 'text-emerald-700'
                            : result.confidenceScore >= 75
                            ? 'text-amber-700'
                            : 'text-rose-600'
                        }`}
                      >
                        {result.confidenceScore}%
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 text-center">
                      {isMatched && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 ml-1" />
                          مطابق
                        </span>
                      )}
                      {isReview && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3 ml-1" />
                            يحتاج مراجعة
                          </span>
                          {result.isPriceFallbackMatch && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300"
                              title={result.reviewReason || 'مطابقة عبر خط الدفاع الأخير بالسعر والكمية'}
                            >
                              ✨ مطابقة بالسعر والكمية
                            </span>
                          )}
                        </div>
                      )}
                      {isUnmatched && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3 ml-1" />
                          غير مطابق
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onOpenReview(result.rowNumber)}
                        className="px-2.5 py-1 text-slate-700 hover:text-emerald-700 hover:bg-slate-100 rounded-lg font-medium transition text-xs flex items-center justify-center mx-auto"
                      >
                        {isMatched ? 'تعديل' : 'مراجعة'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
