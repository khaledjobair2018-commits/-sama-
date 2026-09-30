import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingDown,
  TrendingUp,
  Receipt,
  Percent,
} from 'lucide-react';
import { MatchResult } from '../types/pharmacy';

interface InvoiceSummaryCardsProps {
  results: MatchResult[];
  currency: string;
}

export const InvoiceSummaryCards: React.FC<InvoiceSummaryCardsProps> = ({ results, currency }) => {
  const totalItems = results.length;
  if (totalItems === 0) return null;

  const matchedItems = results.filter(r => r.status === 'MATCHED').length;
  const reviewItems = results.filter(r => r.status === 'REVIEW_REQUIRED').length;
  const unmatchedItems = results.filter(r => r.status === 'UNMATCHED').length;
  const errorItems = results.filter(r => r.status === 'ERROR').length;

  const matchPercentage = Math.round((matchedItems / totalItems) * 100);

  const totalSupplierCost = results.reduce((acc, r) => acc + r.totalSupplierCost, 0);
  const totalMasterCost = results.reduce((acc, r) => acc + (r.matchedItem ? r.totalMasterCost : 0), 0);
  const totalPriceDifference = results.reduce((acc, r) => acc + (r.matchedItem ? r.totalDifference : 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
      {/* 1. Total Rows */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold">إجمالي أصناف الفاتورة</span>
          <Receipt className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline space-x-2 space-x-reverse">
          <span className="text-2xl font-black text-slate-900">{totalItems}</span>
          <span className="text-xs text-slate-500 font-medium">صنف/سطر</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">احتفاظ 100% بنفس الترتيب</div>
      </div>

      {/* 2. Matched Items */}
      <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-emerald-700 mb-2">
          <span className="text-xs font-bold">مطابقة مؤكدة</span>
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline space-x-2 space-x-reverse">
          <span className="text-2xl font-black text-emerald-900">{matchedItems}</span>
          <span className="text-xs text-emerald-700 font-bold">({matchPercentage}%)</span>
        </div>
        <div className="text-[11px] text-emerald-600 mt-1">جاهزة للإدخال السريع فوراً</div>
      </div>

      {/* 3. Review Required */}
      <div className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between ${
        reviewItems > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between text-amber-800 mb-2">
          <span className="text-xs font-bold">تحتاج مراجعة</span>
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex items-baseline space-x-2 space-x-reverse">
          <span className={`text-2xl font-black ${reviewItems > 0 ? 'text-amber-900' : 'text-slate-600'}`}>
            {reviewItems}
          </span>
          <span className="text-xs text-amber-700 font-medium">صنف</span>
        </div>
        <div className="text-[11px] text-amber-700 mt-1">
          {reviewItems > 0 ? 'تتطلب قرار الصيدلي' : 'لا توجد أصناف معلقة'}
        </div>
      </div>

      {/* 4. Unmatched */}
      <div className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between ${
        unmatchedItems > 0 ? 'bg-rose-50/80 border-rose-300' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center justify-between text-rose-800 mb-2">
          <span className="text-xs font-bold">غير مطابق / جديد</span>
          <XCircle className="w-4 h-4 text-rose-600" />
        </div>
        <div className="flex items-baseline space-x-2 space-x-reverse">
          <span className={`text-2xl font-black ${unmatchedItems > 0 ? 'text-rose-900' : 'text-slate-600'}`}>
            {unmatchedItems}
          </span>
          <span className="text-xs text-rose-700 font-medium">صنف</span>
        </div>
        <div className="text-[11px] text-rose-600 mt-1">لم يتم العثور على بديل مؤكد</div>
      </div>

      {/* 5. Total Purchase Amount */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-2">
          <span className="text-xs font-semibold">إجمالي فاتورة المورد</span>
          <Percent className="w-4 h-4 text-slate-400" />
        </div>
        <div className="flex items-baseline space-x-1 space-x-reverse">
          <span className="text-xl font-black text-slate-900 font-mono">
            {totalSupplierCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-slate-500 font-bold">{currency}</span>
        </div>
        <div className="text-[11px] text-slate-400 mt-1">
          القيمة بالنظام: {totalMasterCost.toFixed(2)} {currency}
        </div>
      </div>

      {/* 6. Total Price Variance */}
      <div className={`p-4 rounded-xl border shadow-xs flex flex-col justify-between ${
        totalPriceDifference > 0
          ? 'bg-red-50/70 border-red-200 text-red-900'
          : totalPriceDifference < 0
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold">صافي فارق السعر</span>
          {totalPriceDifference > 0 ? (
            <TrendingUp className="w-4 h-4 text-red-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          )}
        </div>
        <div className="flex items-baseline space-x-1 space-x-reverse">
          <span className="text-xl font-black font-mono">
            {totalPriceDifference > 0 ? `+${totalPriceDifference.toFixed(2)}` : totalPriceDifference.toFixed(2)}
          </span>
          <span className="text-xs font-bold">{currency}</span>
        </div>
        <div className="text-[11px] font-medium mt-1">
          {totalPriceDifference > 0
            ? 'سعر المورد أعلى من النظام'
            : totalPriceDifference < 0
            ? 'سعر المورد أقل (وفر شرائي)'
            : 'متطابق تماماً'}
        </div>
      </div>
    </div>
  );
};
