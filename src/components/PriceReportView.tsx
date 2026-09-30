import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Download,
  AlertTriangle,
  ArrowUpDown,
  Search,
  CheckCircle2,
  DollarSign,
  Printer,
  Gift,
  Lightbulb,
  Building2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { MatchResult, MasterItem, StoredInvoice } from '../types/pharmacy';
import { excelService } from '../services/excelService';
import { purchasingAdvisor, PriceVarianceRow } from '../services/purchasingAdvisor';

interface PriceReportViewProps {
  results: MatchResult[];
  currency: string;
  masterItems?: MasterItem[];
  storedInvoices?: StoredInvoice[];
  invoiceSupplier?: string;
  onOpenPrintReport?: () => void;
}

type PriceFilter = 'ALL' | 'HIGHER' | 'LOWER' | 'SAME' | 'CHEAPER_AVAILABLE' | 'BONUS';
type SortField = 'difference' | 'changePercentage' | 'quantity' | 'totalDifference' | 'newPrice';

export const PriceReportView: React.FC<PriceReportViewProps> = ({
  results,
  currency,
  masterItems = [],
  storedInvoices = [],
  invoiceSupplier = 'المورد الحالي',
  onOpenPrintReport,
}) => {
  const [filter, setFilter] = useState<PriceFilter>('ALL');
  const [reportSubTab, setReportSubTab] = useState<'invoice_variance' | 'suppliers_breakdown'>('invoice_variance');
  const [sortField, setSortField] = useState<SortField>('totalDifference');
  const [sortAsc, setSortAsc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Analyze supplier specific highest and lowest priced items
  const supplierAnalysis = useMemo(() => {
    // supplierName -> list of item quotes
    const supplierMap = new Map<string, Array<{ item: string; price: number; barcode?: string; date?: string }>>();

    // From stored historical invoices
    storedInvoices.forEach(inv => {
      const sup = inv.header.supplierName || 'غير محدد';
      const list = supplierMap.get(sup) || [];
      inv.matchResults.forEach(r => {
        if (r.matchedItem && r.invoiceLine.unitPrice > 0) {
          list.push({
            item: r.matchedItem.name,
            price: r.invoiceLine.unitPrice,
            barcode: r.matchedItem.barcode,
            date: inv.header.invoiceDate,
          });
        }
      });
      supplierMap.set(sup, list);
    });

    // From current active invoice
    if (results.length > 0 && invoiceSupplier) {
      const list = supplierMap.get(invoiceSupplier) || [];
      results.forEach(r => {
        if (r.matchedItem && r.invoiceLine.unitPrice > 0) {
          list.push({
            item: r.matchedItem.name,
            price: r.invoiceLine.unitPrice,
            barcode: r.matchedItem.barcode,
            date: new Date().toISOString().slice(0, 10),
          });
        }
      });
      supplierMap.set(invoiceSupplier, list);
    }

    return Array.from(supplierMap.entries()).map(([supplierName, items]) => {
      // Remove duplicate item names, keep latest/highest
      const uniqueItemsMap = new Map<string, { item: string; price: number; barcode?: string }>();
      items.forEach(it => {
        uniqueItemsMap.set(it.item, it);
      });
      const uniqueItems = Array.from(uniqueItemsMap.values());
      const sortedByPriceAsc = [...uniqueItems].sort((a, b) => a.price - b.price);
      const sortedByPriceDesc = [...uniqueItems].sort((a, b) => b.price - a.price);

      return {
        supplierName,
        totalItemsCount: uniqueItems.length,
        cheapestItems: sortedByPriceAsc.slice(0, 5),
        mostExpensiveItems: sortedByPriceDesc.slice(0, 5),
      };
    });
  }, [storedInvoices, results, invoiceSupplier]);

  // Run comprehensive purchasing advisor analysis
  const { rows, summary } = useMemo(() => {
    return purchasingAdvisor.analyzeInvoice(
      results,
      invoiceSupplier,
      masterItems,
      storedInvoices
    );
  }, [results, invoiceSupplier, masterItems, storedInvoices]);

  if (results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">لا توجد بيانات فاتورة لتحليل الأسعار</h2>
        <p className="text-xs text-slate-500">
          يرجى فتح فاتورة مورد وإجراء المطابقة أولاً لتوليد تحليل الأسعار ومقارنة الموردين والوفر المالي.
        </p>
      </div>
    );
  }

  // Filtered rows
  const filteredRows = rows.filter(r => {
    if (filter === 'HIGHER' && !r.isPriceIncreased) return false;
    if (filter === 'LOWER' && !r.isPriceDecreased) return false;
    if (filter === 'SAME' && (r.isPriceIncreased || r.isPriceDecreased)) return false;
    if (filter === 'CHEAPER_AVAILABLE' && !r.cheapestHistoricalSupplier) return false;
    if (filter === 'BONUS' && r.bonusQuantity <= 0) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.itemName.toLowerCase().includes(q) ||
        r.supplierRawName.toLowerCase().includes(q) ||
        r.barcode.includes(q)
      );
    }
    return true;
  });

  // Sorted rows
  const sortedRows = [...filteredRows].sort((a, b) => {
    let valA = 0;
    let valB = 0;

    switch (sortField) {
      case 'difference':
        valA = a.difference;
        valB = b.difference;
        break;
      case 'changePercentage':
        valA = a.changePercentage;
        valB = b.changePercentage;
        break;
      case 'quantity':
        valA = a.quantity;
        valB = b.quantity;
        break;
      case 'totalDifference':
        valA = Math.abs(a.totalRowLossOrGain);
        valB = Math.abs(b.totalRowLossOrGain);
        break;
      case 'newPrice':
        valA = a.newPrice;
        valB = b.newPrice;
        break;
    }

    return sortAsc ? valA - valB : valB - valA;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Purchasing Consultant Identity */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse mb-1.5">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1 space-x-reverse">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 ml-1" />
              <span>مستشار مشتريات ومحلل أسعار صيدلاني خبير</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">
              المورد: {invoiceSupplier}
            </span>
          </div>
          <h2 className="text-xl font-black text-white">
            تحليل الأسعار، المورد الأرخص، وحساب التكلفة الحقيقية بعد البونص
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            مقارنة دقيقة لأسعار الشراء مع قاعدة الأسعار المرجعية وكشف فرص التوفير المالي للأصناف
          </p>
        </div>

        <div className="flex items-center space-x-2.5 space-x-reverse self-start md:self-auto">
          {onOpenPrintReport && (
            <button
              onClick={onOpenPrintReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition flex items-center space-x-1.5 space-x-reverse shadow-md cursor-pointer"
            >
              <Printer className="w-4 h-4 ml-1" />
              <span>تقرير الفاتورة المتميز (طباعة وتصدير)</span>
            </button>
          )}

          <button
            onClick={() => excelService.exportPriceVarianceReport(results, currency)}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse border border-slate-600 cursor-pointer"
          >
            <Download className="w-4 h-4 ml-1" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Selector */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit text-xs font-bold space-x-1 space-x-reverse">
        <button
          onClick={() => setReportSubTab('invoice_variance')}
          className={`px-4 py-2 rounded-xl transition ${
            reportSubTab === 'invoice_variance'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          تحليل فارق أسعار الفاتورة الحالية ({rows.length})
        </button>
        <button
          onClick={() => setReportSubTab('suppliers_breakdown')}
          className={`px-4 py-2 rounded-xl transition flex items-center space-x-1.5 space-x-reverse ${
            reportSubTab === 'suppliers_breakdown'
              ? 'bg-white text-emerald-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 ml-1" />
          <span>تحليل الموردين (الأغلى والأرخص لكل مورد)</span>
        </button>
      </div>

      {reportSubTab === 'suppliers_breakdown' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center space-x-2 space-x-reverse">
              <Building2 className="w-4 h-4 text-emerald-600 ml-1" />
              <span>تحليل أسعار الموردين المعتمدين (الأصناف الأغلى والأرخص عند كل مورد)</span>
            </h3>
            <p className="text-xs text-slate-500">
              استعراض مفصل ومصنف لكل مورد مسجل في النظام (القادري، أبو هائل، الأكرم، أبو راغب، وغيرهم) لتحديد نقاط القوة والضعف في تسعير كل مورد.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {supplierAnalysis.map(sup => (
              <div
                key={sup.supplierName}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between"
              >
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <Building2 className="w-4 h-4 text-emerald-600 ml-1" />
                    <span className="font-bold text-slate-900 text-sm">{sup.supplierName}</span>
                  </div>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {sup.totalItemsCount} صنف مسجل
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Cheapest Items Table */}
                  <div>
                    <div className="text-[11px] font-bold text-emerald-800 mb-2 flex items-center space-x-1 space-x-reverse">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600 ml-1" />
                      <span>الأصناف الأرخص سعراً عند هذا المورد:</span>
                    </div>
                    <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 divide-y divide-emerald-100 text-xs">
                      {sup.cheapestItems.length > 0 ? (
                        sup.cheapestItems.map((it, i) => (
                          <div key={i} className="p-2.5 flex items-center justify-between">
                            <span className="font-medium text-slate-800 truncate max-w-[200px]">{it.item}</span>
                            <span className="font-mono font-bold text-emerald-700 bg-white px-2 py-0.5 rounded shadow-2xs">
                              {it.price.toFixed(2)} {currency}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-slate-400 text-center">لا توجد بيانات</div>
                      )}
                    </div>
                  </div>

                  {/* Most Expensive Items Table */}
                  <div>
                    <div className="text-[11px] font-bold text-red-800 mb-2 flex items-center space-x-1 space-x-reverse">
                      <TrendingUp className="w-3.5 h-3.5 text-red-600 ml-1" />
                      <span>الأصناف الأعلى سعراً عند هذا المورد:</span>
                    </div>
                    <div className="bg-red-50/50 rounded-xl border border-red-100 divide-y divide-red-100 text-xs">
                      {sup.mostExpensiveItems.length > 0 ? (
                        sup.mostExpensiveItems.map((it, i) => (
                          <div key={i} className="p-2.5 flex items-center justify-between">
                            <span className="font-medium text-slate-800 truncate max-w-[200px]">{it.item}</span>
                            <span className="font-mono font-bold text-red-700 bg-white px-2 py-0.5 rounded shadow-2xs">
                              {it.price.toFixed(2)} {currency}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-2 text-slate-400 text-center">لا توجد بيانات</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportSubTab === 'invoice_variance' && (
        <>
          {/* 1. FINANCIAL SUMMARY KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Price Increase Loss */}
        <div className="bg-white p-4 rounded-xl border border-red-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-red-900">أصناف ارتفع سعرها (زيادة تكلفة)</span>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-600 font-mono">
            +{summary.totalPriceIncreaseLoss.toFixed(2)} {currency}
          </div>
          <div className="text-xs text-red-700 font-medium mt-1">
            في {summary.increasedItemsCount} أصناف أعلى من السعر المرجعي
          </div>
        </div>

        {/* KPI 2: Price Decrease Savings */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-emerald-900">صافي الوفر المحقق (أسعار أقل)</span>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {summary.totalPriceDecreaseSavings.toFixed(2)} {currency}
          </div>
          <div className="text-xs text-emerald-700 font-medium mt-1">
            في {summary.decreasedItemsCount} أصناف بسعر أفضل من المرجع
          </div>
        </div>

        {/* KPI 3: Bonus Units & Value */}
        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-purple-900">البونص والكميات المجانية</span>
            <Gift className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 font-mono">
            {summary.totalBonusUnits} قطعة
          </div>
          <div className="text-xs text-purple-800 font-medium mt-1">
            قيمة الوفر بالبونص: {summary.totalBonusFinancialValue.toFixed(2)} {currency}
          </div>
        </div>

        {/* KPI 4: Net Difference Impact */}
        <div
          className={`p-4 rounded-xl border shadow-xs ${
            summary.netFinancialDifference > 0
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold">صافي الفارق المالي الإجمالي</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-2xl font-black font-mono">
            {summary.netFinancialDifference > 0 ? `+${summary.netFinancialDifference.toFixed(2)}` : summary.netFinancialDifference.toFixed(2)} {currency}
          </div>
          <div className="text-xs font-medium mt-1">
            متوسط هامش الربح المتوقع: {summary.avgExpectedMarginPercentage}%
          </div>
        </div>
      </div>

      {/* 2. CHEAPEST SUPPLIER WARNINGS (تحليل المورد الأرخص) */}
      {summary.cheapestSupplierOpportunities.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center space-x-2 space-x-reverse text-amber-900 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h3 className="text-sm font-black">
              تنبيهات المورد الأرخص (تحليل السجل التاريخي للأسعار):
            </h3>
          </div>

          <div className="space-y-2.5">
            {summary.cheapestSupplierOpportunities.map((opp, idx) => (
              <div
                key={idx}
                className="bg-white p-3.5 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-start space-x-2.5 space-x-reverse">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900 text-sm block">
                      {opp.itemName}
                    </span>
                    <span className="text-amber-900 font-medium">
                      {opp.alertMessage}
                    </span>
                  </div>
                </div>

                <div className="bg-amber-100/60 text-amber-950 font-mono font-bold px-3 py-1.5 rounded-lg text-center flex-shrink-0">
                  وفر متوقع: {opp.totalPotentialSaving.toFixed(2)} {currency}
                  <span className="block text-[10px] text-amber-800 font-sans">
                    ({opp.savingPerUnit.toFixed(2)} لكل قطعة)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. FILTER & SEARCH TOOLBAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث في الأصناف..."
              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'ALL' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600'
              }`}
            >
              الكل ({rows.length})
            </button>
            <button
              onClick={() => setFilter('HIGHER')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'HIGHER' ? 'bg-red-600 text-white font-bold' : 'text-red-700'
              }`}
            >
              ارتفاع ({summary.increasedItemsCount})
            </button>
            <button
              onClick={() => setFilter('LOWER')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'LOWER' ? 'bg-emerald-600 text-white font-bold' : 'text-emerald-700'
              }`}
            >
              وفر ({summary.decreasedItemsCount})
            </button>
            <button
              onClick={() => setFilter('CHEAPER_AVAILABLE')}
              className={`px-3 py-1.5 rounded-lg transition ${
                filter === 'CHEAPER_AVAILABLE' ? 'bg-amber-600 text-white font-bold' : 'text-amber-800'
              }`}
            >
              مورد أرخص ({summary.cheapestSupplierOpportunities.length})
            </button>
            {summary.totalBonusUnits > 0 && (
              <button
                onClick={() => setFilter('BONUS')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filter === 'BONUS' ? 'bg-purple-600 text-white font-bold' : 'text-purple-800'
                }`}
              >
                أصناف البونص
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. MAIN COMPARISON TABLE (جدول فارق الأسعار والتكلفة الحقيقية بعد البونص) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">اسم الصنف في النظام / الفاتورة</th>
                <th className="py-3 px-3 w-20 text-center">الكمية</th>
                <th className="py-3 px-3 w-16 text-center">البونص</th>
                <th className="py-3 px-3 w-24">السعر القديم (المرجعي)</th>
                <th className="py-3 px-3 w-24">السعر الجديد (الفاتورة)</th>
                <th className="py-3 px-3 w-28 bg-purple-50/50">
                  <div className="flex items-center space-x-1 space-x-reverse text-purple-900 font-bold">
                    <Gift className="w-3.5 h-3.5 ml-1" />
                    <span>الفعلي بعد البونص</span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('difference')}
                  className="py-3 px-3 w-24 cursor-pointer hover:bg-slate-200/60"
                >
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <span>الفارق</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('changePercentage')}
                  className="py-3 px-3 w-20 cursor-pointer hover:bg-slate-200/60"
                >
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <span>نسبة %</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('totalDifference')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-200/60"
                >
                  <div className="flex items-center space-x-1 space-x-reverse">
                    <span>إجمالي الأثر المالي</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map(row => {
                const isIncreased = row.isPriceIncreased;
                const isDecreased = row.isPriceDecreased;
                const hasBonus = row.bonusQuantity > 0;

                return (
                  <tr
                    key={row.rowNumber}
                    className={`transition-colors ${
                      isIncreased
                        ? 'bg-red-50/30 hover:bg-red-50/70'
                        : isDecreased
                        ? 'bg-emerald-50/30 hover:bg-emerald-50/70'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 bg-slate-50/50">
                      {row.rowNumber}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{row.itemName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {row.barcode} • بالفاتورة: {row.supplierRawName}
                      </div>

                      {/* Cheapest Supplier Callout Badge */}
                      {row.cheapestHistoricalSupplier && (
                        <div className="mt-1 inline-flex items-center space-x-1 space-x-reverse bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-700 ml-1" />
                          <span>{row.cheapestHistoricalSupplier.alertMessage}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                      {row.quantity}
                    </td>

                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {hasBonus ? (
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[11px] font-black">
                          +{row.bonusQuantity}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono text-slate-600 font-semibold">
                      {row.oldPrice.toFixed(2)} {currency}
                    </td>

                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {row.newPrice.toFixed(2)} {currency}
                    </td>

                    {/* True Cost after Bonus */}
                    <td className="py-3 px-3 font-mono font-bold text-purple-900 bg-purple-50/40">
                      <div>{row.effectiveNewPrice.toFixed(2)} {currency}</div>
                      {hasBonus && (
                        <div className="text-[10px] text-purple-700 font-sans font-medium">
                          وفر: ({(row.newPrice - row.effectiveNewPrice).toFixed(2)})
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-mono font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          isIncreased
                            ? 'text-red-700 bg-red-100'
                            : isDecreased
                            ? 'text-emerald-700 bg-emerald-100'
                            : 'text-slate-500'
                        }`}
                      >
                        {row.difference > 0 ? `+${row.difference.toFixed(2)}` : row.difference.toFixed(2)}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                      <span className={isIncreased ? 'text-red-700' : isDecreased ? 'text-emerald-700' : ''}>
                        {row.changePercentage > 0 ? `+${row.changePercentage}%` : `${row.changePercentage}%`}
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono font-black">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          isIncreased
                            ? 'text-red-800 bg-red-100'
                            : isDecreased
                            ? 'text-emerald-800 bg-emerald-100'
                            : 'text-slate-600'
                        }`}
                      >
                        {row.totalRowLossOrGain > 0
                          ? `+${row.totalRowLossOrGain.toFixed(2)}`
                          : row.totalRowLossOrGain.toFixed(2)}{' '}
                        {currency}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. SUMMARY FINANCIAL ADVICE (نصيحة ملخصة لتوفير أكبر قدر من السيولة المالية) */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md border border-indigo-800">
        <div className="flex items-center space-x-2 space-x-reverse mb-3 text-indigo-300">
          <Lightbulb className="w-5 h-5 text-amber-400 ml-1" />
          <h3 className="text-sm font-black text-white">
            نصائح وتوجيهات مستشار المشتريات لتعظيم الوفر والسيولة المالية:
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {summary.financialAdvice.map((advice, i) => (
            <div
              key={i}
              className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10 flex items-start space-x-2 space-x-reverse"
            >
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 border border-emerald-500/30">
                ✓
              </span>
              <p className="text-slate-200 leading-relaxed font-medium">{advice}</p>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
