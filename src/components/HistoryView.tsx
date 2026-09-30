import React, { useState } from 'react';
import { History, FileText, CheckCircle2, AlertTriangle, XCircle, Trash2, ExternalLink, ShieldCheck } from 'lucide-react';
import { AuditLogEntry, StoredInvoice } from '../types/pharmacy';

interface HistoryViewProps {
  invoices: StoredInvoice[];
  auditLogs: AuditLogEntry[];
  onOpenStoredInvoice: (invoice: StoredInvoice) => void;
  onDeleteInvoice: (id: string) => void;
  currency: string;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  invoices,
  auditLogs,
  onOpenStoredInvoice,
  onDeleteInvoice,
  currency,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'audit'>('invoices');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse mb-1">
            <History className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">سجل الفواتير السابقة والعمليات</h2>
          </div>
          <p className="text-xs text-slate-500">
            يمكنك الرجوع لأي فاتورة سابقة تم إدخالها، وإعادة تصدير ملفات الإدخال، أو متابعة سجل التدقيق.
          </p>
        </div>

        <div className="flex items-center space-x-1 space-x-reverse bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'invoices' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            الفواتير السابقة ({invoices.length})
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeSubTab === 'audit' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-600'
            }`}
          >
            سجل العمليات والتدقيق ({auditLogs.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-xs">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              لا توجد فواتير محفوظة بعد. عند مطابقة فاتورة جديدة سيتم حفظها تلقائياً هنا في الأرشيف المحلي.
            </div>
          ) : (
            invoices.map(stored => {
              const h = stored.header;
              return (
                <div
                  key={h.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <span className="font-bold text-slate-900 text-base">{h.supplierName}</span>
                      <span className="bg-slate-100 px-2.5 py-0.5 rounded-md font-mono text-xs text-slate-700">
                        فاتورة #{h.invoiceNumber}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {h.invoiceDate}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                      <span className="flex items-center text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                        {h.matchedRows} مطابق
                      </span>
                      {h.reviewRows > 0 && (
                        <span className="flex items-center text-amber-700 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 ml-1" />
                          {h.reviewRows} مراجعة
                        </span>
                      )}
                      {h.unmatchedRows > 0 && (
                        <span className="flex items-center text-rose-700 font-semibold">
                          <XCircle className="w-3.5 h-3.5 ml-1" />
                          {h.unmatchedRows} غير مطابق
                        </span>
                      )}
                      <span className="text-slate-400">|</span>
                      <span>إجمالي الأصناف: {h.totalRows}</span>
                      <span className="text-slate-400">|</span>
                      <span className="font-mono">
                        القيمة: {h.totalSupplierAmount.toFixed(2)} {currency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 space-x-reverse self-end md:self-auto">
                    <button
                      onClick={() => onOpenStoredInvoice(stored)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح الفاتورة ومراجعتها</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف الفاتورة رقم ${h.invoiceNumber} من الأرشيف؟`)) {
                          onDeleteInvoice(h.id);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
                      title="حذف من الأرشيف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center">
            <ShieldCheck className="w-4 h-4 ml-1.5 text-emerald-600" />
            <span>سجل تدقيق الأمان والعمليات (مخزن محلياً)</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {auditLogs.map(log => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition text-xs flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 space-x-reverse mb-1">
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-[11px] text-slate-400">بواسطة: {log.user}</span>
                  </div>
                  <div className="text-slate-600">{log.details}</div>
                </div>
                <div className="text-slate-400 font-mono text-[11px] whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleString('ar-SA')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
