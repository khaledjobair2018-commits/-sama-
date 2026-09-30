import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  TrendingDown,
  ArrowRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  DollarSign,
  Download,
  Filter,
  Building,
} from 'lucide-react';
import { MasterItem, StoredInvoice, MatchResult } from '../types/pharmacy';

export interface SmartPurchaseRecommendation {
  id: string;
  itemName: string;
  barcode: string;
  cheapestSupplier: string;
  cheapestPrice: number;
  expensiveSupplier: string;
  expensivePrice: number;
  savingsPerUnit: number;
  savingsPercentage: number;
  recommendationText: string;
  allSupplierQuotes: Array<{ supplier: string; price: number; date: string }>;
}

interface SmartPurchasingGuideViewProps {
  storedInvoices: StoredInvoice[];
  masterItems: MasterItem[];
  activeInvoiceResults?: MatchResult[];
  activeSupplier?: string;
  currency: string;
}

export const SmartPurchasingGuideView: React.FC<SmartPurchasingGuideViewProps> = ({
  storedInvoices,
  masterItems,
  activeInvoiceResults = [],
  activeSupplier = 'المورد الحالي',
  currency,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [minSavingsPercentage, setMinSavingsPercentage] = useState<number>(0);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');

  // Build complete multi-supplier price matrix across all stored invoices + active invoice
  const { recommendations, supplierList } = useMemo(() => {
    // itemIdentifier -> Map<supplierName, { price, date }>
    const quotesMap = new Map<
      string,
      {
        itemName: string;
        barcode: string;
        quotes: Map<string, { price: number; date: string }>;
      }
    >();

    const allSuppliersSet = new Set<string>();

    // 1. Process all stored historical invoices
    storedInvoices.forEach(inv => {
      const sup = (inv.header.supplierName || '').trim();
      if (!sup) return;
      allSuppliersSet.add(sup);

      inv.matchResults.forEach(r => {
        if (r.matchedItem && r.invoiceLine.unitPrice > 0) {
          const key = r.matchedItem.id || r.matchedItem.name;
          let entry = quotesMap.get(key);
          if (!entry) {
            entry = {
              itemName: r.matchedItem.name,
              barcode: r.matchedItem.barcode || '',
              quotes: new Map(),
            };
            quotesMap.set(key, entry);
          }

          const existingQuote = entry.quotes.get(sup);
          if (!existingQuote || r.invoiceLine.unitPrice < existingQuote.price) {
            entry.quotes.set(sup, {
              price: r.invoiceLine.unitPrice,
              date: inv.header.invoiceDate || '',
            });
          }
        }
      });
    });

    // 2. Also process active invoice results if available
    if (activeInvoiceResults.length > 0 && activeSupplier) {
      allSuppliersSet.add(activeSupplier);
      activeInvoiceResults.forEach(r => {
        if (r.matchedItem && r.invoiceLine.unitPrice > 0) {
          const key = r.matchedItem.id || r.matchedItem.name;
          let entry = quotesMap.get(key);
          if (!entry) {
            entry = {
              itemName: r.matchedItem.name,
              barcode: r.matchedItem.barcode || '',
              quotes: new Map(),
            };
            quotesMap.set(key, entry);
          }

          const existingQuote = entry.quotes.get(activeSupplier);
          if (!existingQuote || r.invoiceLine.unitPrice < existingQuote.price) {
            entry.quotes.set(activeSupplier, {
              price: r.invoiceLine.unitPrice,
              date: new Date().toISOString().slice(0, 10),
            });
          }
        }
      });
    }

    // 3. Analyze each item across all suppliers and generate smart purchasing recommendation
    const recs: SmartPurchaseRecommendation[] = [];

    quotesMap.forEach((entry, key) => {
      if (entry.quotes.size < 2) {
        // Need at least 2 different suppliers to compare
        return;
      }

      const quotesArray = Array.from(entry.quotes.entries()).map(([supplier, q]) => ({
        supplier,
        price: q.price,
        date: q.date,
      }));

      // Sort ascending by price
      quotesArray.sort((a, b) => a.price - b.price);

      const cheapest = quotesArray[0];
      const mostExpensive = quotesArray[quotesArray.length - 1];

      const savings = mostExpensive.price - cheapest.price;
      if (savings > 0.01) {
        const percentage = Math.round((savings / mostExpensive.price) * 1000) / 10;
        const text = `صنف ${entry.itemName}: اشتريه من ${cheapest.supplier} بسعر ${cheapest.price.toFixed(2)} ${currency} بدلاً من ${mostExpensive.supplier} بسعر ${mostExpensive.price.toFixed(2)} ${currency}. ستوفر ${savings.toFixed(2)} ${currency} لكل قطعة (${percentage}%).`;

        recs.push({
          id: key,
          itemName: entry.itemName,
          barcode: entry.barcode,
          cheapestSupplier: cheapest.supplier,
          cheapestPrice: cheapest.price,
          expensiveSupplier: mostExpensive.supplier,
          expensivePrice: mostExpensive.price,
          savingsPerUnit: Math.round(savings * 100) / 100,
          savingsPercentage: percentage,
          recommendationText: text,
          allSupplierQuotes: quotesArray,
        });
      }
    });

    // Sort by highest percentage of savings first
    recs.sort((a, b) => b.savingsPercentage - a.savingsPercentage);

    return {
      recommendations: recs,
      supplierList: Array.from(allSuppliersSet),
    };
  }, [storedInvoices, activeInvoiceResults, activeSupplier, currency]);

  // Filter recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      if (minSavingsPercentage > 0 && rec.savingsPercentage < minSavingsPercentage) {
        return false;
      }
      if (selectedSupplierFilter !== 'ALL') {
        if (
          rec.cheapestSupplier !== selectedSupplierFilter &&
          rec.expensiveSupplier !== selectedSupplierFilter
        ) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          rec.itemName.toLowerCase().includes(q) ||
          rec.barcode.includes(q) ||
          rec.cheapestSupplier.toLowerCase().includes(q) ||
          rec.expensiveSupplier.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [recommendations, minSavingsPercentage, selectedSupplierFilter, searchQuery]);

  const totalPotentialSavings = useMemo(() => {
    return filteredRecommendations.reduce((sum, r) => sum + r.savingsPerUnit, 0);
  }, [filteredRecommendations]);

  const handleExportCSV = () => {
    if (filteredRecommendations.length === 0) return;
    const headers = [
      'اسم الصنف',
      'الباركود',
      'المورد الأرخص',
      'السعر الأرخص',
      'المورد الأغلى',
      'السعر الأغلى',
      'الوفر للوحدة',
      'نسبة الوفر %',
      'التوصية الذكية',
    ];

    const rows = filteredRecommendations.map(r => [
      `"${r.itemName.replace(/"/g, '""')}"`,
      `"${r.barcode}"`,
      `"${r.cheapestSupplier.replace(/"/g, '""')}"`,
      r.cheapestPrice,
      `"${r.expensiveSupplier.replace(/"/g, '""')}"`,
      r.expensivePrice,
      r.savingsPerUnit,
      `${r.savingsPercentage}%`,
      `"${r.recommendationText.replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `دليل_المشتريات_الذكي_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse mb-1.5">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center space-x-1 space-x-reverse">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 ml-1" />
              <span>مستشار الشراء الذكي ومقارنة الموردين</span>
            </span>
            <span className="text-xs text-emerald-300/80 font-mono">
              مقارنة بين {supplierList.length} موردين
            </span>
          </div>
          <h2 className="text-xl font-black text-white">
            دليل المشتريات الذكي (Smart Purchasing Guide)
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            يقارن النظام أسعار الأصناف تلقائياً بين جميع الموردين في قاعدة البيانات والفواتير السابقة،
            ويحدد بدقة من أي مورد تشتري كل صنف لتحقيق أعلى نسبة توفير وربح مالي للصيدلية.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 space-x-reverse self-start md:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={filteredRecommendations.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse shadow-md cursor-pointer"
          >
            <Download className="w-4 h-4 ml-1" />
            <span>تصدير دليل الشراء (CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-emerald-900">فرص التوفير المكتشفة</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {filteredRecommendations.length} صنف
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            يوجد فارق سعر بين الموردين في هذه الأصناف
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-teal-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-teal-900">مجموع الوفر المالي لكل وحدة</span>
            <DollarSign className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-700 font-mono">
            {totalPotentialSavings.toFixed(2)} {currency}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            إجمالي الفارق السعري عند الشراء من المورد الأرخص
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-indigo-900">أعلى نسبة توفير مسجلة</span>
            <TrendingDown className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            {recommendations.length > 0 ? `${recommendations[0].savingsPercentage}%` : '0%'}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">
            {recommendations.length > 0
              ? `في صنف ${recommendations[0].itemName.slice(0, 24)}...`
              : 'قم بإدخال فواتير من موردين متعددين للمقارنة'}
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الصنف أو المورد أو الباركود..."
              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Supplier Filter */}
          {supplierList.length > 0 && (
            <div className="flex items-center space-x-2 space-x-reverse text-xs">
              <Building className="w-4 h-4 text-slate-400" />
              <select
                value={selectedSupplierFilter}
                onChange={e => setSelectedSupplierFilter(e.target.value)}
                className="py-2 px-3 border border-slate-300 rounded-xl bg-white font-medium text-slate-700"
              >
                <option value="ALL">جميع الموردين ({supplierList.length})</option>
                {supplierList.map(sup => (
                  <option key={sup} value={sup}>
                    مورد: {sup}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Minimum Savings Filter */}
          <div className="flex items-center space-x-2 space-x-reverse text-xs">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={minSavingsPercentage}
              onChange={e => setMinSavingsPercentage(Number(e.target.value))}
              className="py-2 px-3 border border-slate-300 rounded-xl bg-white font-medium text-slate-700"
            >
              <option value="0">كل نسب الوفر</option>
              <option value="10">وفر 10% فما فوق</option>
              <option value="20">وفر 20% فما فوق</option>
              <option value="30">وفر 30% فما فوق</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500">
          عرض {filteredRecommendations.length} من أصل {recommendations.length} فرصة
        </div>
      </div>

      {/* 4. Smart Recommendations Alerts Feed */}
      {filteredRecommendations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            لا توجد مقارنات متاحة حالياً
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            لكي يعمل دليل المشتريات الذكي، يجب أن يحتوي النظام على فواتير سابقة من موردين مختلفين
            (مثل القادري، أبو هائل، الأكرم، أبو راغب) تتضمن نفس الأصناف لمقارنة الأسعار.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 space-x-reverse">
            <Sparkles className="w-4 h-4 text-emerald-600 ml-1" />
            <span>تنبيهات وتوصيات الشراء الذكية (مرتبة بالأعلى توفيراً):</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {filteredRecommendations.map((rec, index) => (
              <div
                key={rec.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-400 p-4 shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start space-x-3 space-x-reverse">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="font-bold text-slate-900 text-sm">{rec.itemName}</span>
                      {rec.barcode && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {rec.barcode}
                        </span>
                      )}
                    </div>
                    {/* Explicit Recommendation Alert Text */}
                    <p className="text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mt-2 leading-relaxed">
                      💡 {rec.recommendationText}
                    </p>
                  </div>
                </div>

                {/* Pricing comparison pill */}
                <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-center p-2 rounded-xl bg-emerald-50/80 border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 block font-medium">الأرخص: {rec.cheapestSupplier}</span>
                    <span className="text-sm font-black text-emerald-800 font-mono">
                      {rec.cheapestPrice.toFixed(2)} {currency}
                    </span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 rotate-180 hidden sm:block" />

                  <div className="text-center p-2 rounded-xl bg-red-50/80 border border-red-200">
                    <span className="text-[10px] text-red-700 block font-medium">الأغلى: {rec.expensiveSupplier}</span>
                    <span className="text-sm font-black text-red-800 font-mono line-through">
                      {rec.expensivePrice.toFixed(2)} {currency}
                    </span>
                  </div>

                  <div className="text-center p-2.5 rounded-xl bg-amber-100/70 border border-amber-300 min-w-[90px]">
                    <span className="text-[10px] text-amber-800 block font-bold">نسبة الوفر</span>
                    <span className="text-sm font-black text-amber-900 font-mono">
                      {rec.savingsPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Comprehensive Purchasing Comparison Table */}
      {filteredRecommendations.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 space-x-reverse">
              <ShoppingBag className="w-4 h-4 text-emerald-600 ml-1" />
              <span>جدول المقارنة الشامل للموردين</span>
            </h3>
            <span className="text-[11px] text-slate-500">
              مرتبة حسب نسبة التوفير تنازلياً
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3">اسم الصنف</th>
                  <th className="py-3 px-3 bg-emerald-50/50 text-emerald-900">المورد الأرخص</th>
                  <th className="py-3 px-3 bg-emerald-50/50 text-emerald-900 w-24">السعر الأرخص</th>
                  <th className="py-3 px-3 bg-red-50/50 text-red-900">المورد الأغلى</th>
                  <th className="py-3 px-3 bg-red-50/50 text-red-900 w-24">السعر الأغلى</th>
                  <th className="py-3 px-3 w-24">الوفر للقطعة</th>
                  <th className="py-3 px-3 w-20 text-center">نسبة %</th>
                  <th className="py-3 px-3">التوصية الصريحة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecommendations.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 text-center font-mono font-bold text-slate-400 bg-slate-50/50">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{row.itemName}</div>
                      {row.barcode && <div className="text-[10px] text-slate-400 font-mono">{row.barcode}</div>}
                    </td>
                    <td className="py-3 px-3 font-semibold text-emerald-800 bg-emerald-50/30">
                      {row.cheapestSupplier}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                      {row.cheapestPrice.toFixed(2)} {currency}
                    </td>
                    <td className="py-3 px-3 font-semibold text-red-800 bg-red-50/30">
                      {row.expensiveSupplier}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-red-700 bg-red-50/30">
                      {row.expensivePrice.toFixed(2)} {currency}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">
                      +{row.savingsPerUnit.toFixed(2)} {currency}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-black text-amber-700">
                      <span className="bg-amber-100 px-2 py-0.5 rounded-full text-[11px]">
                        {row.savingsPercentage}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-700 leading-normal max-w-sm">
                      <span className="font-medium text-emerald-900">
                        اشتر من <span className="font-bold">{row.cheapestSupplier}</span> ووفر {row.savingsPerUnit.toFixed(2)} {currency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
