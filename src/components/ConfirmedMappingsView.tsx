import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Trash2,
  CheckCircle2,
  BookmarkCheck,
  Plus,
  Building2,
  Pill,
  Scale,
  Sparkles,
  Ban,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { ConfirmedMapping, DictionaryEntry, DictionaryType } from '../types/pharmacy';
import { storage } from '../services/storage';
import {
  dictionaryService,
  BUILT_IN_UNIT_MAP,
  BUILT_IN_COMPANY_ALIASES,
  BUILT_IN_FORM_MAP,
  BUILT_IN_PRODUCT_ALIASES,
  STOP_WORDS,
} from '../services/dictionaryService';

interface ConfirmedMappingsViewProps {
  mappings: ConfirmedMapping[];
  onDeleteMapping: (id: string) => void;
}

export const ConfirmedMappingsView: React.FC<ConfirmedMappingsViewProps> = ({
  mappings,
  onDeleteMapping,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'confirmed' | 'dictionaries'>('confirmed');
  const [search, setSearch] = useState('');

  // Dictionary management state
  const [dictType, setDictType] = useState<DictionaryType>('PRODUCT');
  const [customEntries, setCustomEntries] = useState<DictionaryEntry[]>(() =>
    dictionaryService.getAllEntries()
  );
  const [fromTerm, setFromTerm] = useState('');
  const [toTerm, setToTerm] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleManualSync = async () => {
    setSyncLoading(true);
    setSyncStatus('جاري الاتصال بـ Google Sheets...');
    const res = await storage.fetchFromGoogleSheets();
    setSyncLoading(false);
    if (res.success) {
      setSyncStatus(`تمت المزامنة بنجاح! تم استيراد ${res.mappingsCount || 0} مطابقة جديدة.`);
    } else {
      setSyncStatus(`تنبيه: ${res.error || 'تعذر الاتصال بـ Google Sheets'}`);
    }
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const filteredMappings = mappings.filter(
    m =>
      m.supplierNameOriginal.toLowerCase().includes(search.toLowerCase()) ||
      m.masterItemName.toLowerCase().includes(search.toLowerCase()) ||
      m.officialBarcode.includes(search)
  );

  const handleAddCustomEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromTerm.trim() || !toTerm.trim()) return;

    const newEntry = dictionaryService.saveEntry({
      type: dictType,
      fromTerm: fromTerm.trim(),
      toTerm: toTerm.trim(),
    });

    setCustomEntries(dictionaryService.getAllEntries());
    setFromTerm('');
    setToTerm('');
  };

  const handleDeleteCustomEntry = (id: string) => {
    dictionaryService.deleteEntry(id);
    setCustomEntries(dictionaryService.getAllEntries());
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse mb-1">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              قاموس المطابقات والمترادفات الذكية
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            الذاكرة التراكمية للنظام: تشمل المطابقات اليدوية المعتمدة، وقواميس مرادفات الشركات،
            الوحدات الصيدلانية، والأشكال الدوائية.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
          <button
            onClick={() => setActiveSubTab('confirmed')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'confirmed'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المطابقات المعتمدة ({mappings.length})
          </button>
          <button
            onClick={() => setActiveSubTab('dictionaries')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              activeSubTab === 'dictionaries'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            قواميس المترادفات والشركات
          </button>
        </div>
      </div>

      {activeSubTab === 'confirmed' ? (
        <>
          {/* Google Sheets Sync Toolbar */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 space-x-reverse text-emerald-900">
              <Cloud className="w-4 h-4 text-emerald-600 flex-shrink-0 ml-1" />
              <span className="font-bold">
                الذاكرة الدائمة السحابية (Google Sheets):
              </span>
              <span className="text-emerald-700">
                يتم جلب وحفظ المطابقات في جدول Google Sheets تلقائياً لمنع أي ضياع وتوفير استهلاك الذكاء الاصطناعي.
              </span>
            </div>

            <button
              onClick={handleManualSync}
              disabled={syncLoading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded-xl transition flex items-center space-x-1.5 space-x-reverse flex-shrink-0 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ml-1 ${syncLoading ? 'animate-spin' : ''}`} />
              <span>{syncLoading ? 'جاري المزامنة...' : 'مزامنة مع Google Sheets الآن'}</span>
            </button>
          </div>

          {syncStatus && (
            <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 ml-2 flex-shrink-0" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Search Box */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث في المطابقات المعتمدة..."
                className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {/* Confirmed Mappings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>إجمالي القواعد المحفوظة: {filteredMappings.length} قاعدة</span>
            </div>

            {filteredMappings.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <BookmarkCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                لا توجد مطابقات محفوظة حتى الآن. عند مراجعة الفواتير واعتماد أي صنف يدوياً مع تفعيل
                خيار الحفظ، ستظهر هنا تلقائياً وتُستخدم بنسبة ثقة 100% في الفواتير المستقبلية.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">الاسم الوارد في فاتورة المورد</th>
                      <th className="py-3 px-3">الصنف الرسمي المقابل في النظام</th>
                      <th className="py-3 px-3 font-mono">الباركود الرسمي</th>
                      <th className="py-3 px-3 w-28 text-center">مرات الاستخدام</th>
                      <th className="py-3 px-3 w-32">تاريخ الاعتماد</th>
                      <th className="py-3 px-3 w-16 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMappings.map(mapping => (
                      <tr key={mapping.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          {mapping.supplierNameOriginal}
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-700">
                          <div className="flex items-center space-x-1.5 space-x-reverse">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{mapping.masterItemName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {mapping.officialBarcode}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {mapping.timesUsed} مرة
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(mapping.confirmedAt).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => onDeleteMapping(mapping.id)}
                            className="p-1 hover:text-red-600 text-slate-400 transition cursor-pointer"
                            title="حذف هذا الربط من القاموس"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Dictionaries & Aliases Tab */
        <div className="space-y-6">
          {/* Add custom alias form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-2 space-x-reverse">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>إضافة مترادف أو قاعدة تحويل جديدة:</span>
            </h3>

            <form onSubmit={handleAddCustomEntry} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">نوع المترادف:</label>
                <select
                  value={dictType}
                  onChange={e => setDictType(e.target.value as DictionaryType)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 bg-slate-50"
                >
                  <option value="PRODUCT">اسم تجاري (مثل دكلو دنك → ديكلودنك)</option>
                  <option value="COMPANY">شركة / موزع (مثل الفتحة → الفتح)</option>
                  <option value="UNIT">وحدة قياس (مثل ملغرام → MG)</option>
                  <option value="FORM">شكل دوائي (مثل كبسول → CAPSULE)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  الاسم أو المصطلح كما يرد في الفاتورة:
                </label>
                <input
                  type="text"
                  value={fromTerm}
                  onChange={e => setFromTerm(e.target.value)}
                  placeholder="مثال: الجنتين..."
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  الاسم الرسمي في قاعدة البيانات:
                </label>
                <input
                  type="text"
                  value={toTerm}
                  onChange={e => setToTerm(e.target.value)}
                  placeholder="مثال: الدوائية الأردنية..."
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition cursor-pointer shadow-xs"
                >
                  حفظ في القاموس
                </button>
              </div>
            </form>
          </div>

          {/* Custom Entries List */}
          {customEntries.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                القواعد المخصصة المضافة حديثاً ({customEntries.length})
              </div>
              <div className="divide-y divide-slate-100">
                {customEntries.map(entry => (
                  <div
                    key={entry.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 text-xs"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[11px]">
                        {entry.type === 'PRODUCT'
                          ? 'اسم تجاري'
                          : entry.type === 'COMPANY'
                          ? 'شركة'
                          : entry.type === 'UNIT'
                          ? 'وحدة'
                          : 'شكل'}
                      </span>
                      <span className="font-bold text-slate-800">"{entry.fromTerm}"</span>
                      <span className="text-slate-400">تحول تلقائياً إلى</span>
                      <span className="font-bold text-emerald-700">"{entry.toTerm}"</span>
                    </div>

                    <button
                      onClick={() => handleDeleteCustomEntry(entry.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Built-in dictionaries cards preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Built-in Companies */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2 space-x-reverse mb-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900">مترادفات الشركات والموردين المدمجة</h4>
              </div>
              <div className="space-y-1 text-xs text-slate-600 max-h-48 overflow-y-auto pr-1">
                {Object.entries(BUILT_IN_COMPANY_ALIASES).slice(0, 12).map(([variant, canonical], idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-slate-50 font-mono">
                    <span className="text-slate-700">{variant}</span>
                    <span className="text-emerald-700 font-bold">→ {canonical}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Built-in Products */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2 space-x-reverse mb-2">
                <Pill className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-900">مترادفات الأسماء والكلمات المركبة</h4>
              </div>
              <div className="space-y-1 text-xs text-slate-600 max-h-48 overflow-y-auto pr-1">
                {Object.entries(BUILT_IN_PRODUCT_ALIASES).map(([variant, canonical], idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-slate-50 font-mono">
                    <span className="text-slate-700">{variant}</span>
                    <span className="text-purple-700 font-bold">→ {canonical}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Built-in Units */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2 space-x-reverse mb-2">
                <Scale className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-900">توحيد وحدات القياس (Units)</h4>
              </div>
              <div className="space-y-1 text-xs text-slate-600 max-h-48 overflow-y-auto pr-1">
                {Object.entries(BUILT_IN_UNIT_MAP).slice(0, 12).map(([variant, canonical], idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-slate-50 font-mono">
                    <span className="text-slate-700">{variant}</span>
                    <span className="text-blue-700 font-bold">→ {canonical}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stop Words to Ignore */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center space-x-2 space-x-reverse mb-2">
                <Ban className="w-4 h-4 text-red-500" />
                <h4 className="text-xs font-bold text-slate-900">كلمات لتجاهلها (Stop Words)</h4>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">
                تصفية الكلمات العامة والوصفية وتوريدات المستودعات للتركيز على الاسم العلمي والجرعة:
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {Array.from(STOP_WORDS).map((word, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
