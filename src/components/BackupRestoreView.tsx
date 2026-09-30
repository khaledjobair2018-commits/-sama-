import React, { useRef, useState } from 'react';
import { HardDriveDownload, Upload, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { storage, SEED_MASTER_ITEMS } from '../services/storage';

interface BackupRestoreViewProps {
  onDataReload: () => void;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({ onDataReload }) => {
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadBackup = () => {
    const backupJson = storage.createFullBackup();
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_صيدلية_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMsg({
      type: 'success',
      text: 'تم تنزيل النسخة الاحتياطية بنجاح وحفظها على جهاز الكمبيوتر.',
    });
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const res = storage.restoreFullBackup(content);
      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
        onDataReload();
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    };
    reader.readAsText(file);
  };

  const handleResetToSeed = () => {
    if (confirm('تنبيه: هل أنت متأكد من إعادة تعيين قاعدة الأصناف إلى قاعدة البيانات النموذجية الأولية؟')) {
      storage.saveMasterItems(SEED_MASTER_ITEMS);
      onDataReload();
      setStatusMsg({
        type: 'success',
        text: 'تمت استعادة قاعدة الأصناف النموذجية الأولية بنجاح.',
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mb-6">
        <div className="flex items-center space-x-2 space-x-reverse mb-1">
          <HardDriveDownload className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">النسخ الاحتياطي والاستعادة الشاملة</h2>
        </div>
        <p className="text-xs text-slate-500">
          يعمل التطبيق محلياً 100% دون أي اعتماد على خوادم خارجية. يمكنك إنشاء نسخة احتياطية كاملة
          بضغطة زر واحدة تشمل قاعدة الأصناف وقاموس المطابقات وسجل الفواتير والإعدادات.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold mb-6 flex items-center ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 ml-2 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 ml-2 text-red-600 flex-shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Export Backup Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <HardDriveDownload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">تصدير شامل (Full Export)</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              تجميع وتنزيل ملف JSON شامل وواحد يضم: قاموس المطابقات (Confirmed Mappings)، الفواتير المخزنة (Stored Invoices)، الأصناف الرئيسية (Master Items)، سجل التدقيق (Audit Logs)، الإعدادات (Settings)، وبيانات الأسعار والموردين.
            </p>
          </div>

          <button
            onClick={handleDownloadBackup}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 transition flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
          >
            <HardDriveDownload className="w-4 h-4 ml-1" />
            <span>تصدير شامل (Full Export) وتنزيل JSON</span>
          </button>
        </div>

        {/* Restore Backup Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">استيراد شامل (Full Import)</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              استعادة كامل المنظومة فورياً من ملف JSON واحد: قاعدة الأصناف، المطابقات، الفواتير، والأسعار دون فقدان أي بيانات.
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreFile}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
            >
              <Upload className="w-4 h-4 ml-1" />
              <span>استيراد شامل (Full Import) من ملف JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Safety info card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 space-x-reverse text-xs text-slate-600">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>
            البيانات مخزنة بأمان في المتصفح المحلي. لن يتم مسح بياناتك عند إغلاق التطبيق.
          </span>
        </div>

        <button
          onClick={handleResetToSeed}
          className="text-slate-500 hover:text-red-600 text-xs font-semibold transition flex items-center"
        >
          <RefreshCw className="w-3.5 h-3.5 ml-1" />
          <span>استعادة الأصناف النموذجية الأولية</span>
        </button>
      </div>
    </div>
  );
};
