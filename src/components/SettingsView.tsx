import React, { useState } from 'react';
import { Settings, Save, CheckCircle2, Sliders, Store, Shield, Cloud, RefreshCw, ExternalLink } from 'lucide-react';
import { AppSettings } from '../types/pharmacy';
import { storage } from '../services/storage';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onSaveSettings }) => {
  const [form, setForm] = useState<AppSettings>(settings);
  const [savedMsg, setSavedMsg] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mb-6">
        <div className="flex items-center space-x-2 space-x-reverse mb-1">
          <Settings className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">إعدادات النظام والمطابقة</h2>
        </div>
        <p className="text-xs text-slate-500">
          تخصيص معايير دقة المحرك، وبيانات الصيدلية، وصيغة ملف الإدخال السريع.
        </p>
      </div>

      {savedMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center">
          <CheckCircle2 className="w-4 h-4 ml-2 text-emerald-600" />
          <span>تم حفظ الإعدادات بنجاح وتطبيقها على المحرك.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pharmacy Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2 space-x-reverse">
            <Store className="w-4 h-4 text-emerald-600" />
            <span>بيانات المنشأة والعملة</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">اسم الصيدلية</label>
              <input
                type="text"
                value={form.pharmacyName}
                onChange={e => setForm({ ...form, pharmacyName: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">المدير المسؤول</label>
              <input
                type="text"
                value={form.managerName || ''}
                onChange={e => setForm({ ...form, managerName: e.target.value })}
                placeholder="اسم الدكتور الصيدلي المسؤول"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">رقم الترخيص</label>
              <input
                type="text"
                value={form.license || ''}
                onChange={e => setForm({ ...form, license: e.target.value })}
                placeholder="PH-12345"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">رقم الهاتف</label>
              <input
                type="text"
                value={form.phone || ''}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="05XXXXXXXX"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">العنوان</label>
              <input
                type="text"
                value={form.address || ''}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="الشارع، المدينة"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1.5">العملة الرسمية</label>
              <input
                type="text"
                value={form.currency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                placeholder="ر.س"
                className="w-full p-2.5 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Engine Precision Thresholds */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center space-x-2 space-x-reverse">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>معايير حساسية وأوزان محرك المطابقة</span>
          </h3>

          <div className="space-y-4 text-xs">
            {/* Weights Sliders Group */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="font-bold text-slate-800 text-xs mb-2">أوزان معادلة التقييم (Weights Distribution):</div>
              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>وزن الكلمات والاسم الأساسي:</span>
                  <span className="font-mono text-emerald-700">{form.weights?.coreNameWeight || 25}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={form.weights?.coreNameWeight || 25}
                  onChange={e =>
                    setForm({
                      ...form,
                      weights: { ...form.weights, coreNameWeight: parseInt(e.target.value) },
                    })
                  }
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>وزن الجرعة والتركيز والأرقام:</span>
                  <span className="font-mono text-blue-700">{form.weights?.strengthWeight || 20}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={form.weights?.strengthWeight || 20}
                  onChange={e =>
                    setForm({
                      ...form,
                      weights: { ...form.weights, strengthWeight: parseInt(e.target.value) },
                    })
                  }
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>وزن الشركة والموزع:</span>
                  <span className="font-mono text-purple-700">{form.weights?.companyWeight || 15}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="5"
                  value={form.weights?.companyWeight || 15}
                  onChange={e =>
                    setForm({
                      ...form,
                      weights: { ...form.weights, companyWeight: parseInt(e.target.value) },
                    })
                  }
                  className="w-full accent-purple-600"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>الحد الأدنى للمطابقة الآلية المؤكدة (High Confidence):</span>
                <span className="font-mono text-emerald-700">{form.highConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="75"
                max="98"
                step="1"
                value={form.highConfidenceThreshold}
                onChange={e => setForm({ ...form, highConfidenceThreshold: parseInt(e.target.value) })}
                className="w-full accent-emerald-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                أي تطابق بنسبة أعلى من هذه القيمة، ومجتاز لجميع القواعد الطبية الصارمة، يعتبر MATCHED
                تلقائياً.
              </p>
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-800 mb-1">
                <span>حد عرض المرشحين للمراجعة (Review Threshold):</span>
                <span className="font-mono text-amber-700">{form.reviewThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="85"
                step="1"
                value={form.reviewThreshold}
                onChange={e => setForm({ ...form, reviewThreshold: parseInt(e.target.value) })}
                className="w-full accent-amber-600"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                الأصناف التي تحقق نسبة تشابه أقل من هذه القيمة تصنف مباشرة كـ UNMATCHED لمنع الترشيحات
                البعيدة.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">التعلم التلقائي من المطابقة اليدوية</span>
                <span className="text-[11px] text-slate-500">
                  حفظ أسماء الموردين المعتمدة في القاموس للاستخدام الفوري في الفواتير اللاحقة
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.autoLearnOnManualConfirm}
                onChange={e => setForm({ ...form, autoLearnOnManualConfirm: e.target.checked })}
                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Google Sheets Cloud Persistent Database */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
              <Cloud className="w-4 h-4 text-emerald-600" />
              <span>قاعدة بيانات الذاكرة الدائمة (Google Sheets Web App)</span>
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              حفظ سحابي دائم للمطابقات
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            يتم تخزين المطابقات المعتمدة والأسعار فورياً في ورقة Google Sheets الخاصة بك لحمايتها من الضياع
            وتوفير استهلاك Gemini عبر استرجاع المطابقات السابقة أولاً.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                رابط Web App الخاص بـ Google Apps Script
              </label>
              <input
                type="url"
                value={form.googleSheetsWebAppUrl || ''}
                onChange={e => setForm({ ...form, googleSheetsWebAppUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-[11px]"
              />
            </div>

            {form.lastSheetsSync && (
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 space-x-reverse">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-1" />
                <span>آخر مزامنة ناجحة: {new Date(form.lastSheetsSync).toLocaleString('ar-SA')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Entry File Format */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2 space-x-reverse">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>صيغة ملف الإدخال السريع الافتراضية</span>
          </h3>

          <div className="flex items-center space-x-6 space-x-reverse text-xs">
            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer font-medium">
              <input
                type="radio"
                name="exportFormat"
                checked={form.defaultExportFormat === 'xlsx'}
                onChange={() => setForm({ ...form, defaultExportFormat: 'xlsx' })}
                className="text-emerald-600"
              />
              <span>ملف إكسل (.xlsx)</span>
            </label>

            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer font-medium">
              <input
                type="radio"
                name="exportFormat"
                checked={form.defaultExportFormat === 'csv'}
                onChange={() => setForm({ ...form, defaultExportFormat: 'csv' })}
                className="text-emerald-600"
              />
              <span>ملف قيم مفصولة (.csv)</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 transition flex items-center space-x-2 space-x-reverse"
          >
            <Save className="w-4 h-4" />
            <span>حفظ الإعدادات</span>
          </button>
        </div>
      </form>
    </div>
  );
};
