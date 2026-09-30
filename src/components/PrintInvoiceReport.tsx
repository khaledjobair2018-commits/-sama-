import React, { useState, useEffect, useRef } from 'react';
import {
  Printer,
  FileSpreadsheet,
  FileText,
  Building,
  Calendar,
  User,
  Hash,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Percent,
  X,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { MatchResult, MasterItem } from '../types/pharmacy';
import { excelService } from '../services/excelService';
import { purchasingAdvisor } from '../services/purchasingAdvisor';

interface PrintInvoiceReportProps {
  isOpen: boolean;
  onClose: () => void;
  results: MatchResult[];
  invoiceInfo: {
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
  };
  pharmacyName?: string;
  currency: string;
  masterItems: MasterItem[];
}

export const PrintInvoiceReport: React.FC<PrintInvoiceReportProps> = ({
  isOpen,
  onClose,
  results,
  invoiceInfo,
  pharmacyName = 'صيدلية سماء الميدان',
  currency,
  masterItems,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [entryUser] = useState<string>('د. سماء الميدان (الصيدلي المسؤول)');
  const [entryTime] = useState<string>(
    new Date().toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  const reportRef = useRef<HTMLDivElement>(null);

  // Financial Analysis calculation
  const analysis = React.useMemo(() => {
    return purchasingAdvisor.analyzeInvoice(
      results,
      invoiceInfo.supplierName,
      masterItems,
      []
    );
  }, [results, invoiceInfo.supplierName, masterItems]);

  const totalInvoice = analysis.summary.totalInvoiceAmount;
  const netSavings = analysis.summary.totalPriceDecreaseSavings;
  const avgMargin = analysis.summary.avgExpectedMarginPercentage;

  // Generate dynamic QR Code: (رقم الفاتورة + التاريخ + المجموع)
  useEffect(() => {
    const qrPayload = `الفاتورة: ${invoiceInfo.invoiceNumber}\nالمورد: ${invoiceInfo.supplierName}\nالتاريخ: ${invoiceInfo.invoiceDate}\nالمجموع: ${totalInvoice} ${currency}\nالصيدلية: ${pharmacyName}`;

    QRCode.toDataURL(qrPayload, {
      width: 140,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('QR code generation error:', err));
  }, [invoiceInfo, totalInvoice, currency, pharmacyName]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    excelService.exportFullMatchReport(results, invoiceInfo, currency);
  };

  const handleExportCsv = () => {
    const csvData = results.map(r => ({
      'الرمز / الباركود': r.matchedItem ? r.matchedItem.barcode : (r.invoiceLine.supplierBarcode || 'غير مسجل'),
      'اسم الصنف المعتمد': r.matchedItem ? r.matchedItem.name : `[غير مطابق] ${r.invoiceLine.rawSupplierName}`,
      'الكمية': r.invoiceLine.quantity,
      'البونص': r.invoiceLine.bonusQuantity || 0,
      [`سعر الشراء (${currency})`]: r.invoiceLine.unitPrice,
      [`إجمالي الصنف (${currency})`]: r.totalSupplierCost,
      'تاريخ الانتهاء': r.invoiceLine.expiryDate || '—',
      'فارق السعر': r.priceDifference !== 0 ? r.priceDifference : 0,
      'حالة المطابقة': r.status === 'MATCHED' ? 'مطابق' : r.status === 'REVIEW_REQUIRED' ? 'مراجعة' : 'غير مطابق',
    }));

    excelService.exportTableToCsv(
      csvData,
      `تقرير_فحص_فاتورة_${invoiceInfo.supplierName}_${invoiceInfo.invoiceNumber}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full overflow-hidden flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:w-full">
        {/* Modal Controls Bar (Hidden during printing) */}
        <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center space-x-2.5 space-x-reverse">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                معاينة تقرير الفاتورة المتميز القابل للطباعة والتصدير
              </h2>
              <p className="text-xs text-slate-400">
                تصميم احترافي متوافق تماماً مع مقاسات الطباعة المباشرة (A4 Print-Friendly)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير (Print)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse border border-slate-700 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 ml-1" />
              <span>تصدير Excel</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1 space-x-reverse border border-slate-700 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-cyan-400 ml-1" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* PRINTABLE REPORT DOCUMENT BODY */}
        {/* ============================================================ */}
        <div
          ref={reportRef}
          className="p-6 sm:p-8 overflow-y-auto space-y-6 print:p-6 print:overflow-visible text-slate-900 bg-white"
          id="printable-invoice-report"
        >
          {/* 1. REPORT TOP HEADER */}
          <div className="border-b-2 border-emerald-600 pb-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Facility Name & Logo */}
              <div className="flex items-center space-x-3.5 space-x-reverse text-right">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl flex items-center justify-center text-white shadow-md print:shadow-none flex-shrink-0">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xl font-black text-slate-900 tracking-tight">
                    {pharmacyName}
                  </div>
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                    إدارة الرقابة الدوائية والتدقيق المالي للمشتريات
                  </div>
                  <div className="text-[11px] text-slate-500">
                    نظام الفحص والمطابقة الصيدلانية المعتمد
                  </div>
                </div>
              </div>

              {/* Title & Badge */}
              <div className="text-center sm:text-center">
                <div className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-4 py-1 rounded-full mb-1">
                  مستند فحص رسمي معتمد
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                  تقرير مطابقة وفحص فاتورة مشتريات
                </h1>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  رقم المرجع: {invoiceInfo.invoiceNumber}
                </p>
              </div>

              {/* Dynamic QR Code */}
              <div className="flex flex-col items-center justify-center bg-slate-50 p-2 rounded-xl border border-slate-200 flex-shrink-0">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="كود QR للتحقق السريع"
                    className="w-24 h-24 object-contain"
                  />
                ) : (
                  <div className="w-24 h-24 bg-slate-200 animate-pulse rounded" />
                )}
                <span className="text-[9px] font-bold text-slate-500 mt-1 font-mono">
                  تحقق رقمي (QR Verify)
                </span>
              </div>
            </div>

            {/* Metadata Bar: (رقم الفاتورة | اسم المورد | تاريخ ووقت الإدخال | اسم مدخل البيانات) */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-100/80 p-3 rounded-xl border border-slate-200/80 text-xs">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Hash className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">رقم الفاتورة:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {invoiceInfo.invoiceNumber || '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Building className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">اسم المورد:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[150px] block">
                    {invoiceInfo.supplierName || '—'}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">تاريخ ووقت الفحص:</span>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {entryTime}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <User className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="text-slate-500 block text-[10px]">اسم مدخل البيانات:</span>
                  <span className="font-bold text-slate-900 text-[11px]">
                    {entryUser}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ANALYTICAL DATA TABLE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black text-slate-800 flex items-center space-x-1.5 space-x-reverse">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>جدول فحص وتدقيق الأصناف المطابقة ({results.length} صنف):</span>
              </h3>
              <div className="flex items-center space-x-3 space-x-reverse text-[11px]">
                <span className="flex items-center space-x-1 space-x-reverse text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-100 border border-red-300 inline-block ml-1"></span>
                  <span>تغير بالسعر</span>
                </span>
                <span className="flex items-center space-x-1 space-x-reverse text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-300 inline-block ml-1"></span>
                  <span>وفر أو بونص</span>
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 w-32 font-mono">الرمز / الباركود</th>
                    <th className="py-2.5 px-3">اسم الصنف المعتمد في النظام</th>
                    <th className="py-2.5 px-3 w-16 text-center">الكمية</th>
                    <th className="py-2.5 px-3 w-16 text-center">البونص</th>
                    <th className="py-2.5 px-3 w-24">سعر الشراء</th>
                    <th className="py-2.5 px-3 w-28">إجمالي الصنف</th>
                    <th className="py-2.5 px-3 w-24">تاريخ الانتهاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, idx) => {
                    const matched = r.matchedItem;
                    const isPriceChanged = r.priceDifference !== 0;
                    const isPriceIncrease = r.priceDifference > 0;
                    const hasBonus = (r.invoiceLine.bonusQuantity || 0) > 0;

                    // Row background styling: highlight price changes gently
                    let rowBg = 'bg-white hover:bg-slate-50/80';
                    if (isPriceIncrease) {
                      rowBg = 'bg-amber-50/60 hover:bg-amber-50';
                    } else if (r.priceDifference < 0 || hasBonus) {
                      rowBg = 'bg-emerald-50/40 hover:bg-emerald-50/70';
                    }

                    return (
                      <tr key={r.rowNumber} className={`${rowBg} transition-colors`}>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400 text-[11px]">
                          {r.rowNumber}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 text-[11px]">
                          {matched ? matched.barcode : (r.invoiceLine.supplierBarcode || '—')}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">
                            {matched ? matched.name : r.invoiceLine.rawSupplierName}
                          </div>
                          {matched && matched.name !== r.invoiceLine.rawSupplierName && (
                            <div className="text-[10px] text-slate-500 truncate max-w-md">
                              الأصل بالفاتورة: {r.invoiceLine.rawSupplierName}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800">
                          {r.invoiceLine.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {hasBonus ? (
                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[11px] font-black">
                              +{r.invoiceLine.bonusQuantity}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          <div>
                            {r.invoiceLine.unitPrice.toFixed(2)} {currency}
                          </div>
                          {isPriceChanged && (
                            <div
                              className={`text-[10px] font-sans font-semibold ${
                                isPriceIncrease ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {isPriceIncrease
                                ? `(+${r.priceDifference.toFixed(2)})`
                                : `(${r.priceDifference.toFixed(2)})`}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                          {r.totalSupplierCost.toFixed(2)} {currency}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                          {r.invoiceLine.expiryDate || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. SMART FINANCIAL INDICATORS BAR (شريط المؤشرات المالية الذكية) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {/* KPI 1: Final Invoice Total */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs text-right">
              <div className="flex items-center justify-between text-slate-300 text-xs mb-1">
                <span className="font-semibold">إجمالي الفاتورة النهائي</span>
                <Hash className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-300">
                {totalInvoice.toFixed(2)} {currency}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                يشمل إجمالي الكميات المعتمدة ({results.reduce((a, b) => a + (b.invoiceLine.quantity || 0), 0)} قطعة)
              </div>
            </div>

            {/* KPI 2: Net Financial Savings */}
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl shadow-xs text-right">
              <div className="flex items-center justify-between text-emerald-900 text-xs mb-1">
                <span className="font-bold">صافي الوفر المالي المحقق</span>
                <TrendingDown className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-700">
                {netSavings > 0 ? `${netSavings.toFixed(2)} ${currency}` : `0.00 ${currency}`}
              </div>
              <div className="text-[11px] text-emerald-800 font-medium mt-1">
                وفر محقق من فروق الأسعار وكميات البونص المجانية
              </div>
            </div>

            {/* KPI 3: Expected Average Profit Margin % */}
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl shadow-xs text-right">
              <div className="flex items-center justify-between text-indigo-900 text-xs mb-1">
                <span className="font-bold">متوسط هامش الربح المتوقع</span>
                <Percent className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black font-mono text-indigo-700">
                {avgMargin}%
              </div>
              <div className="text-[11px] text-indigo-800 font-medium mt-1">
                محسوب بناءً على أسعار بيع الجمهور الرسمية المعتمدة
              </div>
            </div>
          </div>

          {/* Report Footer / Signatures */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 text-xs text-slate-600">
            <div>
              <span className="block font-bold text-slate-800 mb-1">تدقيق ومراجعة الصيدلي:</span>
              <span className="text-[11px] text-slate-500 block">
                تمت مراجعة الجرعات والتواريخ والأسعار ومطابقتها وفق السياسات الدوائية المعتمدة.
              </span>
              <div className="mt-4 border-b border-dashed border-slate-300 w-48"></div>
              <span className="text-[10px] text-slate-400 mt-1 block">التوقيع / الختم</span>
            </div>

            <div className="text-left">
              <span className="block font-bold text-slate-800 mb-1">الاعتماد المالي والإدخال:</span>
              <span className="text-[11px] text-slate-500 block">
                نظام إدخال فواتير المشتريات — {pharmacyName}
              </span>
              <div className="mt-4 border-b border-dashed border-slate-300 w-48 mr-auto"></div>
              <span className="text-[10px] text-slate-400 mt-1 block">اعتماد الإدارة المالية</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
