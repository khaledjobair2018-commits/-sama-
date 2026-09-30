import React, { useState, useRef } from 'react';
import {
  Database,
  Plus,
  Upload,
  Download,
  Search,
  Edit2,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MasterColumnMapping, MasterItem } from '../types/pharmacy';
import { excelService, ParsedSheetData } from '../services/excelService';

interface MasterDatabaseViewProps {
  items: MasterItem[];
  onSaveItems: (items: MasterItem[]) => void;
  onAddOrUpdateItems: (newItems: MasterItem[], updateExisting: boolean) => { added: number; updated: number };
  currency: string;
}

export const MasterDatabaseView: React.FC<MasterDatabaseViewProps> = ({
  items,
  onSaveItems,
  onAddOrUpdateItems,
  currency,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterItem | null>(null);

  // Import state
  const [importSheetData, setImportSheetData] = useState<ParsedSheetData | null>(null);
  const [importMapping, setImportMapping] = useState<MasterColumnMapping | null>(null);
  const [importMode, setImportMode] = useState<'update' | 'replace'>('update');
  const [importNotification, setImportNotification] = useState('');

  // New/Edit Item form state
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formStrength, setFormStrength] = useState('');
  const [formDosageForm, setFormDosageForm] = useState('Tablet');
  const [formPackSize, setFormPackSize] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formActiveIngredient, setFormActiveIngredient] = useState('');

  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Filtered items
  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.nameAr && item.nameAr.includes(q)) ||
      item.barcode.includes(q) ||
      (item.activeIngredient && item.activeIngredient.toLowerCase().includes(q)) ||
      (item.company && item.company.toLowerCase().includes(q))
    );
  });

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setFormName('');
    setFormNameAr('');
    setFormBarcode('');
    setFormPrice('');
    setFormCostPrice('');
    setFormStrength('');
    setFormDosageForm('Tablet');
    setFormPackSize('');
    setFormCompany('');
    setFormActiveIngredient('');
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: MasterItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormNameAr(item.nameAr || '');
    setFormBarcode(item.barcode);
    setFormPrice(item.price.toString());
    setFormCostPrice(item.costPrice?.toString() || '');
    setFormStrength(item.strength || '');
    setFormDosageForm(item.dosageForm || 'Tablet');
    setFormPackSize(item.packSize || '');
    setFormCompany(item.company || '');
    setFormActiveIngredient(item.activeIngredient || '');
    setIsItemModalOpen(true);
  };

  const handleSaveItemForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBarcode.trim()) return;

    const price = parseFloat(formPrice) || 0;
    const costPrice = formCostPrice ? parseFloat(formCostPrice) : price * 0.8;

    if (editingItem) {
      const updated = items.map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              name: formName.trim(),
              nameAr: formNameAr.trim() || undefined,
              barcode: formBarcode.trim(),
              price,
              costPrice,
              strength: formStrength.trim() || undefined,
              dosageForm: formDosageForm.trim() || undefined,
              packSize: formPackSize.trim() || undefined,
              company: formCompany.trim() || undefined,
              activeIngredient: formActiveIngredient.trim() || undefined,
              updatedAt: new Date().toISOString(),
            }
          : item
      );
      onSaveItems(updated);
    } else {
      const newItem: MasterItem = {
        id: `MI-${Date.now()}`,
        name: formName.trim(),
        nameAr: formNameAr.trim() || undefined,
        barcode: formBarcode.trim(),
        price,
        costPrice,
        strength: formStrength.trim() || undefined,
        dosageForm: formDosageForm.trim() || undefined,
        packSize: formPackSize.trim() || undefined,
        company: formCompany.trim() || undefined,
        activeIngredient: formActiveIngredient.trim() || undefined,
        updatedAt: new Date().toISOString(),
      };
      onSaveItems([newItem, ...items]);
    }

    setIsItemModalOpen(false);
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الصنف الرسمي "${name}" من قاعدة الأصناف؟`)) {
      onSaveItems(items.filter(item => item.id !== id));
    }
  };

  // Import file handler
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await excelService.readWorkbook(file);
      setImportSheetData(parsed);
      const detected = excelService.autoDetectMasterColumns(parsed.headers);
      setImportMapping(detected);
    } catch (err: unknown) {
      alert(`خطأ في قراءة ملف قاعدة البيانات: ${err instanceof Error ? err.message : ''}`);
    }
  };

  const handleExecuteImport = () => {
    if (!importSheetData || !importMapping) return;

    const importedItems = excelService.convertToMasterItems(importSheetData.rawRows, importMapping);

    if (importMode === 'replace') {
      if (confirm('تنبيه: سيتم استبدال كامل قاعدة الأصناف الحالية بهذه الملف. هل تريد المتابعة؟')) {
        onSaveItems(importedItems);
        setImportNotification(`تم استبدال قاعدة البيانات بنجاح بـ ${importedItems.length} صنف`);
        setIsImportModalOpen(false);
      }
    } else {
      const { added, updated } = onAddOrUpdateItems(importedItems, true);
      setImportNotification(`تم استيراد ${added} صنف جديد وتحديث ${updated} صنف بنجاح!`);
      setIsImportModalOpen(false);
    }
  };

  const handleExportMasterDB = () => {
    const rows = items.map(item => ({
      'الباركود': item.barcode,
      'اسم الصنف': item.name,
      'الاسم بالعربي': item.nameAr || '',
      [`سعر النظام (${currency})`]: item.price,
      [`سعر التكلفة (${currency})`]: item.costPrice || '',
      'التركيز': item.strength || '',
      'الشكل الصيدلاني': item.dosageForm || '',
      'حجم العبوة': item.packSize || '',
      'الشركة المصنعة': item.company || '',
      'المادة الفعالة': item.activeIngredient || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'قاعدة الأصناف الرسمية');
    XLSX.writeFile(workbook, `قاعدة_الأصناف_الرسمية_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 space-x-reverse mb-1">
            <Database className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              قاعدة الأصناف الرسمية للصيدلية (المرجع الأساسي)
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            تضم {items.length} صنف مسجل. الباركود والاسم والأسعار هنا هي المرجع الحصري للمطابقة والتحقق.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenNewItem}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف رسمي جديد</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 space-x-reverse"
          >
            <Upload className="w-4 h-4" />
            <span>استيراد ملف قاعدة البيانات</span>
          </button>

          <button
            onClick={handleExportMasterDB}
            className="p-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition text-xs font-semibold flex items-center space-x-1 space-x-reverse"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {importNotification && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle2 className="w-4 h-4 ml-2 text-emerald-600" />
            <span>{importNotification}</span>
          </div>
          <button onClick={() => setImportNotification('')}>
            <X className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم الرسمي، الباركود، المادة الفعالة، الشركة، أو الاسم العربي..."
            className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>عرض {filteredItems.length} من أصل {items.length} صنف رسمي</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-3">اسم الصنف الرسمي</th>
                <th className="py-3 px-3 w-36 font-mono">الباركود الرسمي</th>
                <th className="py-3 px-3 w-28">التركيز الدوائي</th>
                <th className="py-3 px-3 w-24">الشكل</th>
                <th className="py-3 px-3 w-28">سعر النظام</th>
                <th className="py-3 px-3 w-32">المادة الفعالة</th>
                <th className="py-3 px-3 w-28">الشركة</th>
                <th className="py-3 px-3 w-24 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-3 text-center font-mono text-slate-400 bg-slate-50/50">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-bold text-slate-900">{item.name}</div>
                    {item.nameAr && <div className="text-[11px] text-slate-500">{item.nameAr}</div>}
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.barcode}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {item.strength ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium text-[11px]">
                        {item.strength}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-700">{item.dosageForm || '—'}</td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900">
                    {item.price.toFixed(2)} {currency}
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-[11px]">{item.activeIngredient || '—'}</td>
                  <td className="py-3 px-3 text-slate-600 text-[11px]">{item.company || '—'}</td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center space-x-1 space-x-reverse">
                      <button
                        onClick={() => handleOpenEditItem(item)}
                        className="p-1 hover:text-emerald-600 text-slate-500 transition"
                        title="تعديل بيانات الصنف"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="p-1 hover:text-red-600 text-slate-400 transition"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD / EDIT SINGLE ITEM */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                {editingItem ? 'تعديل بيانات الصنف الرسمي' : 'إضافة صنف رسمي جديد للقاعدة'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم الصنف الرسمي (بالإنجليزية أو التجاري) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Panadol Extra 500mg/65mg Tablet"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الصنف بالعربي</label>
                <input
                  type="text"
                  value={formNameAr}
                  onChange={e => setFormNameAr(e.target.value)}
                  placeholder="مثال: بنادول إكسترا أقراص"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الباركود الرسمي *</label>
                  <input
                    type="text"
                    required
                    value={formBarcode}
                    onChange={e => setFormBarcode(e.target.value)}
                    placeholder="628100..."
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    سعر النظام ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={e => setFormPrice(e.target.value)}
                    placeholder="12.50"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    التركيز الدوائي (هام جداً للتحقق)
                  </label>
                  <input
                    type="text"
                    value={formStrength}
                    onChange={e => setFormStrength(e.target.value)}
                    placeholder="e.g. 500mg, 50,000 IU, 0.1%"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الشكل الصيدلاني</label>
                  <select
                    value={formDosageForm}
                    onChange={e => setFormDosageForm(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Tablet">أقراص (Tablet)</option>
                    <option value="Capsule">كبسولات (Capsule)</option>
                    <option value="Syrup">شراب (Syrup)</option>
                    <option value="Ampoule">أمبولات (Ampoule)</option>
                    <option value="Vial">فيال (Vial)</option>
                    <option value="Cream">كريم (Cream)</option>
                    <option value="Ointment">مرهم (Ointment)</option>
                    <option value="Gel">جل (Gel)</option>
                    <option value="Drops">قطرة (Drops)</option>
                    <option value="Spray">بخاخ (Spray)</option>
                    <option value="Suppository">تحاميل (Suppository)</option>
                    <option value="Sachet">أكياس / فوار (Sachet)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الشركة المصنعة</label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={e => setFormCompany(e.target.value)}
                    placeholder="e.g. GSK, Tabuk..."
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">حجم العبوة</label>
                  <input
                    type="text"
                    value={formPackSize}
                    onChange={e => setFormPackSize(e.target.value)}
                    placeholder="e.g. 24 Tabs, 100ml"
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المادة الفعالة</label>
                <input
                  type="text"
                  value={formActiveIngredient}
                  onChange={e => setFormActiveIngredient(e.target.value)}
                  placeholder="e.g. Paracetamol + Caffeine"
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2 space-x-reverse">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: IMPORT MASTER DATABASE (XLSX, XLS, CSV) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2 space-x-reverse">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>استيراد وتحديث قاعدة الأصناف الرسمية</span>
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div
                onClick={() => importFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center cursor-pointer bg-slate-50 transition"
              >
                <input
                  type="file"
                  ref={importFileInputRef}
                  onChange={handleImportFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <div className="font-bold text-slate-800">
                  انقر لاختيار ملف قاعدة بيانات الأصناف (XLSX, XLS, CSV)
                </div>
                {importSheetData && (
                  <div className="text-emerald-700 font-bold mt-2">
                    تم تحميل الملف: {importSheetData.fileName} ({importSheetData.rawRows.length} صف)
                  </div>
                )}
              </div>

              {/* Column Mapping Selectors */}
              {importSheetData && importMapping && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="font-bold text-slate-800">
                    تحديد الأعمدة المرجعية من الملف:
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">اسم الصنف *</label>
                      <select
                        value={importMapping.name}
                        onChange={e => setImportMapping({ ...importMapping, name: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- اختر العمود --</option>
                        {importSheetData.headers.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">الباركود *</label>
                      <select
                        value={importMapping.barcode}
                        onChange={e => setImportMapping({ ...importMapping, barcode: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- اختر العمود --</option>
                        {importSheetData.headers.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">السعر *</label>
                      <select
                        value={importMapping.price}
                        onChange={e => setImportMapping({ ...importMapping, price: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- اختر العمود --</option>
                        {importSheetData.headers.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">التركيز</label>
                      <select
                        value={importMapping.strength || ''}
                        onChange={e => setImportMapping({ ...importMapping, strength: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- اختياري --</option>
                        {importSheetData.headers.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">الشكل الصيدلاني</label>
                      <select
                        value={importMapping.dosageForm || ''}
                        onChange={e => setImportMapping({ ...importMapping, dosageForm: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- اختياري --</option>
                        {importSheetData.headers.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">العبوة / الحجم</label>
                      <select
                        value={importMapping.packSize || ''}
                        onChange={e => setImportMapping({ ...importMapping, packSize: e.target.value })}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="">-- اختياري --</option>
                        {importSheetData.headers.map(h => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Mode */}
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-slate-700 font-bold mb-1">طريقة الاستيراد:</label>
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <label className="flex items-center space-x-1.5 space-x-reverse cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'update'}
                          onChange={() => setImportMode('update')}
                          className="text-emerald-600"
                        />
                        <span>إضافة وتحديث (دمج مع الحفاظ على المطابقات السابقة)</span>
                      </label>

                      <label className="flex items-center space-x-1.5 space-x-reverse cursor-pointer text-red-700">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-red-600"
                        />
                        <span>استبدال كامل قاعدة الأصناف</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2 space-x-reverse">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  disabled={!importSheetData || !importMapping?.name}
                  onClick={handleExecuteImport}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition"
                >
                  تنفيذ الاستيراد الآن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
