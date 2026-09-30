import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Clipboard,
  Sparkles,
  CheckCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Database,
  Building,
  Calendar,
  Hash,
  RefreshCw,
  Code,
  Copy,
  Check,
  X,
  Zap,
  ShieldCheck,
  FileJson,
  Camera,
} from 'lucide-react';
import { SupplierInvoiceLine } from '../types/pharmacy';
import { excelService } from '../services/excelService';
import { SAMPLE_INVOICES, SampleInvoice } from '../services/sampleInvoices';

interface NewInvoiceViewProps {
  onStartMatching: (
    lines: SupplierInvoiceLine[],
    invoiceHeader: { supplierName: string; invoiceNumber: string; invoiceDate: string; fileName?: string }
  ) => void;
  currency: string;
}

// Algorithmic local text & table parser (100% Client-Side, Zero AI)
function parseTextInvoiceLocally(text: string): {
  header: { supplier_name: string | null; invoice_number: string | null; invoice_date: string | null; customer_name: string | null };
  items: Array<{
    expiry_date: string | null;
    item_name: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    barcode?: string;
  }>;
  totals: { grand_total: number };
} {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let supplierName: string | null = null;
  let invoiceNumber: string | null = null;
  let invoiceDate: string | null = null;
  let customerName: string | null = null;
  const items: any[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Check header metadata
    const supplierMatch = line.match(/(?:المورد|مستودع|شركة|مؤسسة|محلات|Supplier)\s*[:=\-]\s*([^\t,;|]+)/i);
    if (supplierMatch && !supplierName) {
      supplierName = supplierMatch[1].trim();
      continue;
    }
    const invNumMatch = line.match(/(?:رقم الفاتورة|الفاتورة رقم|فاتورة رقم|INV(?:OICE)?(?:\s*#|\s*NO)?)\s*[:=\-]?\s*([A-Za-z0-9\-_]+)/i);
    if (invNumMatch && !invoiceNumber) {
      invoiceNumber = invNumMatch[1].trim();
      continue;
    }
    const dateMatch = line.match(/(?:تاريخ الفاتورة|التاريخ|Date)\s*[:=\-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
    if (dateMatch && !invoiceDate) {
      invoiceDate = dateMatch[1].trim().replace(/-/g, '/');
      continue;
    }
    const custMatch = line.match(/(?:العميل|صيدلية|المشتري|Customer)\s*[:=\-]\s*([^\t,;|]+)/i);
    if (custMatch && !customerName) {
      customerName = custMatch[1].trim();
      continue;
    }

    // Skip separator or header title lines
    if (/^[=\-_*#\s]+$/.test(line)) continue;
    if (/^(?:الرقم|م|#|تسلسل)\s*[\t,|]/.test(line)) continue;
    if (/(?:المجموع|الإجمالي|الاجمالي|grand total|total)/i.test(line) && !line.includes('باكت') && !line.includes('علبة')) continue;

    // Check row delimiters
    let tokens: string[] = [];
    if (line.includes('\t')) {
      tokens = line.split('\t').map(t => t.trim()).filter(Boolean);
    } else if (line.includes('|')) {
      tokens = line.split('|').map(t => t.trim()).filter(Boolean);
    } else if (line.includes(',')) {
      tokens = line.split(',').map(t => t.trim()).filter(Boolean);
    } else if (line.includes(';') && !line.includes('&')) {
      tokens = line.split(';').map(t => t.trim()).filter(Boolean);
    } else {
      tokens = line.split(/\s{2,}/).map(t => t.trim()).filter(Boolean);
    }

    if (tokens.length < 2) continue;

    let expiryDate: string | null = null;
    let itemName: string | null = null;
    let unit: string | null = null;
    let barcode: string | undefined = undefined;
    const numericValues: number[] = [];

    const unitRegex = /^(باكت|علبة|علبه|شريط|شرايط|مضروب|أمبول|امبول|فيال|قنينة|زجاجة|حبة|قرص|كبسولة|كيس|pack|box|strip|amp|vial|bot|tab|cap)$/i;
    const dateRegex = /\b(\d{4}[/-]\d{1,2}(?:[/-]\d{1,2})?|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/;
    const barcodeRegex = /^\d{10,14}$/;

    for (const token of tokens) {
      const cleanToken = token.trim();
      if (!expiryDate && dateRegex.test(cleanToken)) {
        const m = cleanToken.match(dateRegex);
        if (m) expiryDate = m[1].replace(/-/g, '/');
      } else if (!barcode && barcodeRegex.test(cleanToken)) {
        barcode = cleanToken;
      } else if (!unit && unitRegex.test(cleanToken)) {
        unit = cleanToken;
      } else {
        const cleanNumStr = cleanToken.replace(/[^\d\.]/g, '');
        const val = parseFloat(cleanNumStr);
        if (!isNaN(val) && cleanNumStr.length > 0 && !/[a-zA-Z\u0600-\u06FF]/.test(cleanToken.replace(/(?:ر\.ي|ريال|\$|YER|SAR)/g, ''))) {
          numericValues.push(val);
        } else {
          if (!itemName) {
            itemName = cleanToken;
          } else {
            itemName += ' ' + cleanToken;
          }
        }
      }
    }

    if (itemName && itemName.length > 1) {
      let qty = 1;
      let unitPrice = 0;
      let totalPrice = 0;

      if (numericValues.length === 1) {
        qty = 1;
        unitPrice = numericValues[0];
        totalPrice = unitPrice;
      } else if (numericValues.length === 2) {
        qty = numericValues[0];
        unitPrice = numericValues[1];
        totalPrice = Math.round(qty * unitPrice * 100) / 100;
      } else if (numericValues.length >= 3) {
        qty = numericValues[0];
        unitPrice = numericValues[1];
        totalPrice = numericValues[2];
      }

      items.push({
        expiry_date: expiryDate,
        item_name: itemName,
        unit: unit || 'باكت',
        quantity: qty,
        unit_price: unitPrice,
        total_price: totalPrice,
        barcode,
      });
    }
  }

  const grandTotal = items.reduce((sum, it) => sum + (it.total_price || it.quantity * it.unit_price), 0);

  return {
    header: {
      supplier_name: supplierName,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      customer_name: customerName,
    },
    items,
    totals: {
      grand_total: Math.round(grandTotal * 100) / 100,
    },
  };
}

export const NewInvoiceView: React.FC<NewInvoiceViewProps> = ({ onStartMatching, currency }) => {
  // Support both Ultra-Strict AI Vision (Images & PDFs) and 100% Local Programmatic Excel
  const [activeTab, setActiveTab] = useState<'vision' | 'excel' | 'paste' | 'json' | 'samples'>('vision');
  const [supplierName, setSupplierName] = useState('محلات أبو هائل للأدوية');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState('صيدلية سماء الميدان');

  // Staged lines
  const [stagedLines, setStagedLines] = useState<SupplierInvoiceLine[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [rawExtractedJson, setRawExtractedJson] = useState<string>('');
  const [showRawJsonModal, setShowRawJsonModal] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const visionInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [pasteContent, setPasteContent] = useState('');
  const [rawJsonInput, setRawJsonInput] = useState('');

  // Update raw JSON string helper
  const updateRawJsonRepresentation = (
    sup: string,
    invNum: string,
    invD: string,
    cust: string,
    lines: SupplierInvoiceLine[]
  ) => {
    const formattedObj = {
      header: {
        supplier_name: sup || null,
        invoice_number: invNum || null,
        invoice_date: invD ? invD.replace(/-/g, '-') : null,
        customer_name: cust || null,
      },
      items: lines.map(l => ({
        expiry_date: l.expiryDate ? l.expiryDate.replace(/-/g, '-') : null,
        item_name: l.rawSupplierName || null,
        unit: l.extractedUnit || 'باكت',
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_price: l.totalPrice || Math.round(l.quantity * l.unitPrice * 100) / 100,
      })),
      totals: {
        grand_total: Math.round(lines.reduce((acc, l) => acc + (l.totalPrice || l.quantity * l.unitPrice), 0) * 100) / 100,
      },
    };
    setRawExtractedJson(JSON.stringify(formattedObj, null, 2));
  };

  // 1. VISION & PDF ULTRA-STRICT AI EXTRACTION (Temperature: 0.0)
  const handleVisionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingMessage('جاري تشغيل محرك الاستخراج الصارم (Ultra-Strict OCR) بنسبة إبداع 0.0% لمسح وتفكيك المستند بدقة...');
    setErrorMsg('');
    setUploadedFileName(file.name);

    try {
      if (file.type.startsWith('image/')) {
        setImagePreviewUrl(URL.createObjectURL(file));
      } else {
        setImagePreviewUrl(null);
      }

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await fetch('/api/ai/parse-invoice-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'فشل استخراج بيانات الفاتورة');
      }

      if (data.warning) {
        setErrorMsg(data.warning);
      }

      const inv = data.invoice;
      const rawString = data.rawJsonString || JSON.stringify(inv, null, 2);
      setRawExtractedJson(rawString);

      const header = inv.header || inv;
      let finalSup = supplierName;
      let finalInv = invoiceNumber;
      let finalDate = invoiceDate;
      let finalCust = customerName;

      if (header.supplier_name && header.supplier_name !== 'null') {
        finalSup = header.supplier_name;
        setSupplierName(finalSup);
      }
      if (header.invoice_number && header.invoice_number !== 'null') {
        finalInv = header.invoice_number;
        setInvoiceNumber(finalInv);
      }
      if (header.invoice_date && header.invoice_date !== 'null') {
        finalDate = header.invoice_date.replace(/\//g, '-');
        setInvoiceDate(finalDate);
      }
      if (header.customer_name && header.customer_name !== 'null') {
        finalCust = header.customer_name;
        setCustomerName(finalCust);
      }

      const itemsList = Array.isArray(inv.items) ? inv.items : [];
      if (itemsList.length === 0) {
        throw new Error('لم يتم العثور على أسطر أصناف في المستند المرفق.');
      }

      const lines: SupplierInvoiceLine[] = itemsList.map((item: any, idx: number) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity) || 1);
        const uPrice = typeof item.unit_price === 'number' ? item.unit_price : (parseFloat(item.unit_price) || 0);
        const tPrice = typeof item.total_price === 'number' ? item.total_price : (parseFloat(item.total_price) || (qty * uPrice));

        return {
          rowNumber: idx + 1,
          rawSupplierName: item.item_name || `صنف رقم ${idx + 1}`,
          quantity: qty,
          bonusQuantity: 0,
          unitPrice: uPrice,
          effectiveUnitPrice: uPrice,
          totalPrice: Math.round(tPrice * 100) / 100,
          extractedUnit: item.unit || 'باكت',
          expiryDate: item.expiry_date || undefined,
          supplierBarcode: item.barcode || undefined,
        };
      });

      setStagedLines(lines);
      updateRawJsonRepresentation(finalSup, finalInv, finalDate, finalCust, lines);
    } catch (err: any) {
      console.error('Vision upload error:', err);
      setErrorMsg(`خطأ في استخراج الفاتورة: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load sample invoice
  const handleLoadSample = (sample: SampleInvoice) => {
    setSupplierName(sample.supplierName);
    setInvoiceNumber(sample.invoiceNumber);
    setInvoiceDate(sample.invoiceDate);
    setStagedLines(sample.lines);
    setUploadedFileName(`عينة: ${sample.name}`);
    setImagePreviewUrl(null);
    updateRawJsonRepresentation(sample.supplierName, sample.invoiceNumber, sample.invoiceDate, customerName, sample.lines);
    setErrorMsg('');
  };

  // 1. EXCEL / CSV 1-CLICK UPLOAD (Local Algorithmic, No AI)
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingMessage('جاري تحليل ملف الإكسل وتخطي الأسطر التمهيدية وربط الأعمدة محلياً...');
    setErrorMsg('');
    setUploadedFileName(file.name);

    try {
      const { lines, sheetData } = await excelService.autoParseInvoiceFile(file);

      // Auto-populate header if detected from Excel metadata rows
      let finalSupplier = supplierName;
      let finalInvoiceNum = invoiceNumber;
      let finalInvoiceDate = invoiceDate;
      let finalCustomer = customerName;

      if (sheetData.metadata) {
        if (sheetData.metadata.supplierName) {
          finalSupplier = sheetData.metadata.supplierName;
          setSupplierName(finalSupplier);
        }
        if (sheetData.metadata.invoiceNumber) {
          finalInvoiceNum = sheetData.metadata.invoiceNumber;
          setInvoiceNumber(finalInvoiceNum);
        }
        if (sheetData.metadata.invoiceDate) {
          finalInvoiceDate = sheetData.metadata.invoiceDate.replace(/\//g, '-');
          setInvoiceDate(finalInvoiceDate);
        }
        if (sheetData.metadata.customerName) {
          finalCustomer = sheetData.metadata.customerName;
          setCustomerName(finalCustomer);
        }
      }

      if (lines.length === 0) {
        throw new Error('لم يتم العثور على أسطر أصناف صالحة في ملف الإكسل. يرجى التأكد من أن الملف يحتوي على جدول بيانات للأصناف.');
      }

      setStagedLines(lines);
      updateRawJsonRepresentation(finalSupplier, finalInvoiceNum, finalInvoiceDate, finalCustomer, lines);
    } catch (err: any) {
      console.error('Excel upload error:', err);
      setErrorMsg(`خطأ في قراءة ملف الإكسل: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. PARSE TEXT / CLIPBOARD / TABLE (Local Algorithmic Parser, 0 AI)
  const handleParsePasteLocally = () => {
    if (!pasteContent.trim()) {
      setErrorMsg('الرجاء إدخال أو لصق نص الفاتورة أو جدول الأصناف أولاً.');
      return;
    }

    setLoading(true);
    setLoadingMessage('جاري الفرز البرمجي السريع وتفكيك الأعمدة محلياً...');
    setErrorMsg('');

    try {
      const parsed = parseTextInvoiceLocally(pasteContent);

      if (parsed.header.supplier_name) setSupplierName(parsed.header.supplier_name);
      if (parsed.header.invoice_number) setInvoiceNumber(parsed.header.invoice_number);
      if (parsed.header.invoice_date) setInvoiceDate(parsed.header.invoice_date.replace(/\//g, '-'));
      if (parsed.header.customer_name) setCustomerName(parsed.header.customer_name);

      if (parsed.items.length === 0) {
        throw new Error('لم يتم التعرف على أي أسطر أصناف صالحة في النص المدخل. يرجى التأكد من احتواء السطور على اسم الصنف ورقم الكمية أو السعر.');
      }

      const lines: SupplierInvoiceLine[] = parsed.items.map((item, idx) => ({
        rowNumber: idx + 1,
        rawSupplierName: item.item_name || `صنف رقم ${idx + 1}`,
        quantity: item.quantity,
        bonusQuantity: 0,
        unitPrice: item.unit_price,
        effectiveUnitPrice: item.unit_price,
        totalPrice: item.total_price || Math.round(item.quantity * item.unit_price * 100) / 100,
        extractedUnit: item.unit || 'باكت',
        expiryDate: item.expiry_date || undefined,
        supplierBarcode: item.barcode || undefined,
      }));

      setStagedLines(lines);
      setUploadedFileName('نص جدول مفكك برمجياً');
      updateRawJsonRepresentation(
        parsed.header.supplier_name || supplierName,
        parsed.header.invoice_number || invoiceNumber,
        parsed.header.invoice_date || invoiceDate,
        parsed.header.customer_name || customerName,
        lines
      );
    } catch (err: any) {
      console.error('Local parsing error:', err);
      setErrorMsg(err.message || 'تعذر تفكيك النص برمجياً.');
    } finally {
      setLoading(false);
    }
  };

  // 3. PARSE JSON DIRECTLY (Local JSON Schema Validator, 0 AI)
  const handleParseJsonInput = (jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      const header = parsed.header || {};
      const itemsList = Array.isArray(parsed.items) ? parsed.items : [];

      if (header.supplier_name) setSupplierName(header.supplier_name);
      if (header.invoice_number) setInvoiceNumber(header.invoice_number);
      if (header.invoice_date) setInvoiceDate(header.invoice_date.replace(/\//g, '-'));
      if (header.customer_name) setCustomerName(header.customer_name);

      if (itemsList.length === 0) {
        throw new Error('كائن JSON لا يحتوي على قائمة أصناف (items).');
      }

      const lines: SupplierInvoiceLine[] = itemsList.map((item: any, idx: number) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : (parseFloat(item.quantity) || 1);
        const uPrice = typeof item.unit_price === 'number' ? item.unit_price : (parseFloat(item.unit_price) || 0);
        const tPrice = typeof item.total_price === 'number' ? item.total_price : (parseFloat(item.total_price) || (qty * uPrice));

        return {
          rowNumber: idx + 1,
          rawSupplierName: item.item_name || `صنف رقم ${idx + 1}`,
          quantity: qty,
          bonusQuantity: 0,
          unitPrice: uPrice,
          effectiveUnitPrice: uPrice,
          totalPrice: Math.round(tPrice * 100) / 100,
          extractedUnit: item.unit || 'باكت',
          expiryDate: item.expiry_date || undefined,
          supplierBarcode: item.barcode || undefined,
        };
      });

      setStagedLines(lines);
      setUploadedFileName('ملف JSON مستورد');
      setRawExtractedJson(JSON.stringify(parsed, null, 2));
      setErrorMsg('');
    } catch (err: any) {
      setErrorMsg(`خطأ في قراءة كائن JSON: ${err.message}`);
    }
  };

  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      if (text) {
        setRawJsonInput(text);
        handleParseJsonInput(text);
      }
    };
    reader.readAsText(file);
  };

  // Final Action: Start Matching Engine
  const handleProceed = () => {
    if (stagedLines.length === 0) {
      setErrorMsg('لا توجد أسطر مستخرجة لبدء المطابقة.');
      return;
    }

    onStartMatching(stagedLines, {
      supplierName: supplierName || 'المورد',
      invoiceNumber: invoiceNumber || '0000',
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      fileName: uploadedFileName,
    });
  };

  const handleCopyJson = () => {
    if (!rawExtractedJson) return;
    navigator.clipboard.writeText(rawExtractedJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Top Card: Invoice Metadata Ribbon */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2 space-x-reverse">
            <Building className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">
              بيانات ترويسة فاتورة المورد (Header Metadata)
            </h2>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Zap className="w-3.5 h-3.5 ml-1 text-emerald-600" />
              استخراج برمجي فوري مباشر (بدون ذكاء اصطناعي)
            </span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
              العميل: {customerName}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center">
              <Building className="w-3.5 h-3.5 ml-1 text-slate-400" />
              <span>اسم المورد / المستودع</span>
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="مثال: محلات أبو هائل، محلات القادري..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center">
              <Hash className="w-3.5 h-3.5 ml-1 text-slate-400" />
              <span>رقم الفاتورة</span>
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="رقم الفاتورة..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center">
              <Calendar className="w-3.5 h-3.5 ml-1 text-slate-400" />
              <span>تاريخ الفاتورة</span>
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold"
            />
          </div>
        </div>
      </div>

      {/* 2. Main Method Selector Tabs (Ultra-Strict Vision & 100% Local Excel) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('vision')}
            className={`flex-1 min-w-[170px] py-3.5 px-4 flex items-center justify-center space-x-2 space-x-reverse transition cursor-pointer ${
              activeTab === 'vision'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>مسح صورة أو ملف PDF (المحرك الصارم)</span>
            <span className="mr-1.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              Temp 0.0
            </span>
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 min-w-[160px] py-3.5 px-4 flex items-center justify-center space-x-2 space-x-reverse transition cursor-pointer ${
              activeTab === 'excel'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>رفع ملف Excel أو CSV (المحرك البرمجي)</span>
          </button>

          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 min-w-[150px] py-3.5 px-4 flex items-center justify-center space-x-2 space-x-reverse transition cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clipboard className="w-4 h-4 text-emerald-600" />
            <span>لصق وتفكيك نص الفاتورة / الجداول</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 min-w-[130px] py-3.5 px-4 flex items-center justify-center space-x-2 space-x-reverse transition cursor-pointer ${
              activeTab === 'json'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileJson className="w-4 h-4 text-emerald-600" />
            <span>استيراد JSON موحد</span>
          </button>

          <button
            onClick={() => setActiveTab('samples')}
            className={`flex-1 min-w-[130px] py-3.5 px-4 flex items-center justify-center space-x-2 space-x-reverse transition cursor-pointer ${
              activeTab === 'samples'
                ? 'bg-white text-emerald-700 border-b-2 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>نماذج جاهزة</span>
          </button>
        </div>

        <div className="p-6">
          {/* TAB 0: VISION / PDF ULTRA-STRICT OCR */}
          {activeTab === 'vision' && (
            <div>
              <div
                onClick={() => visionInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-600 rounded-2xl p-8 text-center cursor-pointer bg-emerald-50/20 hover:bg-emerald-50/40 transition group"
              >
                <input
                  type="file"
                  ref={visionInputRef}
                  onChange={handleVisionUpload}
                  accept="image/png, image/jpeg, image/jpg, image/webp, application/pdf"
                  className="hidden"
                />
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform shadow-xs">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  اسحب صورة الفاتورة أو ملف PDF هنا (Ultra-Strict OCR Engine)
                </h3>
                <p className="text-xs text-slate-600 max-w-xl mx-auto leading-relaxed">
                  يعمل بنظام استخراج آلي صارم (Temperature: 0.0) يتغلب على فوضى الفواتير العربية (الصفوف العلوية الفارغة، الخلايا المدمجة، والنصوص غير المنظمة) مع قراءة أعمدة الجدول من اليمين لليسار (RTL).
                </p>
                <div className="mt-4 inline-flex items-center space-x-1.5 space-x-reverse bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-xs transition">
                  <Upload className="w-4 h-4 ml-1" />
                  <span>تحديد صورة فاتورة أو ملف PDF من جهازك</span>
                </div>
              </div>

              {imagePreviewUrl && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-32 h-32 rounded-xl overflow-hidden border border-slate-300 bg-white flex-shrink-0 flex items-center justify-center">
                    <img src={imagePreviewUrl} alt="معاينة الفاتورة" className="object-cover w-full h-full" />
                  </div>
                  <div className="text-xs text-slate-700">
                    <p className="font-bold text-slate-900 text-sm mb-1">معاينة المستند: {uploadedFileName}</p>
                    <p className="text-slate-500 mb-2">تم مسح المستند وتفكيكه وتحويله لكائن JSON قياسي موحد بنجاح.</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 ml-1" />
                      استخراج صارم 100% مطابق لمخطط JSON
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: EXCEL / CSV 1-CLICK UPLOAD */}
          {activeTab === 'excel' && (
            <div>
              <div
                onClick={() => excelInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/20 transition group"
              >
                <input
                  type="file"
                  ref={excelInputRef}
                  onChange={handleExcelUpload}
                  accept=".xlsx, .xls, .csv, .tsv"
                  className="hidden"
                />
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  اسحب ملف إكسل أو CSV هنا (استخراج برمجي فوري بدون أي تأخير أو ذكاء اصطناعي)
                </h3>
                <p className="text-xs text-slate-500 max-w-lg mx-auto">
                  المحرك البرمجي يتجاوز أسطر الترويسة الفارغة تلقائياً (Auto-detect Headers)، ويربط الأعمدة (الاسم، السعر، الكمية، تاريخ الانتهاء، الوحدة) ويهمل الأسطر التلخيصية فوراً داخل المتصفح.
                </p>
                <div className="mt-4 inline-flex items-center space-x-1.5 space-x-reverse bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs">
                  <Upload className="w-4 h-4 ml-1" />
                  <span>تحديد ملف Excel أو CSV من الجهاز</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOCAL DIRECT TABLE / TEXT PARSE */}
          {activeTab === 'paste' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  الصق نص الفاتورة أو أسطر الجدول مباشرة (فرز برمجي محلي فوري):
                </label>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-medium">
                  يدعم الفرز التلقائي RTL والفواصل (Tabs / Pipes / Comma)
                </span>
              </div>
              <textarea
                value={pasteContent}
                onChange={e => setPasteContent(e.target.value)}
                rows={7}
                placeholder={`مثال لسطور جدول فواتير أو نص منسوخ:
الانتهاء	الصنف والتركيز الدوائي	الوحدة	الكمية	سعر الوحدة	الإجمالي
2028/05/01	بانادول إكسترا 500 مجم	باكت	20	10.20	204.00
2027/12/30	اموكسيسيلين كبسولات 500 مجم	علبة	30	13.90	417.00
2028/01/15	اوجمنتين 1 جم اقراص	باكت	15	41.20	618.00`}
                className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed bg-slate-50/50"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleParsePasteLocally}
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 space-x-reverse cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Zap className="w-4 h-4 ml-1.5 text-amber-300" />
                  <span>تفكيك واستخراج السطور برمجياً (محلي فوراً)</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: JSON DIRECT IMPORT */}
          {activeTab === 'json' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700">
                  الصق كائن JSON الموحد أو اختر ملف JSON:
                </label>
                <div
                  onClick={() => jsonInputRef.current?.click()}
                  className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-lg cursor-pointer transition flex items-center"
                >
                  <Upload className="w-3.5 h-3.5 ml-1" />
                  <span>اختيار ملف .json</span>
                  <input
                    type="file"
                    ref={jsonInputRef}
                    onChange={handleJsonFileUpload}
                    accept=".json"
                    className="hidden"
                  />
                </div>
              </div>
              <textarea
                value={rawJsonInput}
                onChange={e => {
                  setRawJsonInput(e.target.value);
                  if (e.target.value.trim().startsWith('{')) {
                    handleParseJsonInput(e.target.value);
                  }
                }}
                rows={8}
                placeholder={`{
  "header": {
    "supplier_name": "محلات أبو هائل للأدوية",
    "invoice_number": "INV-2026-4091",
    "invoice_date": "2026/09/25",
    "customer_name": "صيدلية سماء الميدان"
  },
  "items": [
    {
      "expiry_date": "2028/05/01",
      "item_name": "بنادول إكسترا أقراص 500 ملجم",
      "unit": "باكت",
      "quantity": 20,
      "unit_price": 10.2,
      "total_price": 204.0
    }
  ],
  "totals": {
    "grand_total": 204.0
  }
}`}
                className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 leading-relaxed bg-slate-50/50"
              />
              <button
                onClick={() => handleParseJsonInput(rawJsonInput)}
                className="mt-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition cursor-pointer"
              >
                تحميل وتطبيق كائن JSON
              </button>
            </div>
          )}

          {/* TAB 4: READY SAMPLES */}
          {activeTab === 'samples' && (
            <div>
              <div className="mb-4 text-xs text-slate-500">
                اختر إحدى الفواتير النموذجية الصيدلانية المحفوظة محلياً لاختبار سرعة الفحص والمطابقة:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SAMPLE_INVOICES.map(sample => (
                  <div
                    key={sample.id}
                    onClick={() => handleLoadSample(sample)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 cursor-pointer transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900 text-sm group-hover:text-emerald-800">
                          {sample.name}
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {sample.lines.length} صنف
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mb-3">{sample.description}</p>
                    </div>

                    <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 flex items-center justify-between">
                      <span>المورد: {sample.supplierName}</span>
                      <span className="text-emerald-600 font-bold group-hover:underline">
                        انقر للتحميل الفوري ←
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading status */}
          {loading && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 space-x-reverse text-emerald-800 text-xs font-bold">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600 flex-shrink-0" />
              <span>{loadingMessage}</span>
            </div>
          )}

          {/* Error / Notice Message */}
          {errorMsg && (
            <div className={`mt-4 p-3 rounded-xl flex items-center text-xs ${
              errorMsg.includes('تم استهلاك الحصة') || errorMsg.includes('محرك الطوارئ')
                ? 'bg-amber-50 border border-amber-200 text-amber-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              <AlertCircle className={`w-4 h-4 ml-2 flex-shrink-0 ${
                errorMsg.includes('تم استهلاك الحصة') || errorMsg.includes('محرك الطوارئ')
                  ? 'text-amber-500'
                  : 'text-red-500'
              }`} />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Extracted Rows Unified Standard Table Preview */}
      {stagedLines.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-emerald-50 border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 space-x-reverse">
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  تم استخراج {stagedLines.length} صنف برمجياً ومحلياً (100% بدون ذكاء اصطناعي)
                </h3>
                <p className="text-xs text-slate-500">
                  تم فصل الأعمدة وترتيبها وفق التنسيق القياسي RTL دون الحاجة للاتصال بأي خادم خارجي
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              {rawExtractedJson && (
                <button
                  onClick={() => setShowRawJsonModal(true)}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 space-x-reverse cursor-pointer shadow-xs"
                >
                  <Code className="w-4 h-4 text-slate-500 ml-1" />
                  <span>عرض كائن JSON المستخرج</span>
                </button>
              )}

              <button
                onClick={handleProceed}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-700/20 transition flex items-center justify-center space-x-2 space-x-reverse cursor-pointer"
              >
                <span>بدء تشغيل محرك المطابقة</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5 w-24">تاريخ الانتهاء</th>
                  <th className="p-2.5">البيان / اسم الصنف والتركيز الدوائي</th>
                  <th className="p-2.5 w-20 text-center">الوحدة</th>
                  <th className="p-2.5 w-16 text-center">الكمية</th>
                  <th className="p-2.5 w-24">سعر الوحدة</th>
                  <th className="p-2.5 w-24">القيمة / الإجمالي</th>
                  <th className="p-2.5 w-28 font-mono">الباركود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stagedLines.map(line => (
                  <tr key={line.rowNumber} className="hover:bg-slate-50">
                    <td className="p-2.5 text-center font-mono font-bold text-slate-400 bg-slate-50/50">
                      {line.rowNumber}
                    </td>
                    <td className="p-2.5 font-mono text-slate-700 text-[11px]">
                      {line.expiryDate || '—'}
                    </td>
                    <td className="p-2.5 font-bold text-slate-900">{line.rawSupplierName}</td>
                    <td className="p-2.5 text-center text-slate-600 text-[11px]">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-medium">
                        {line.extractedUnit || 'باكت'}
                      </span>
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                      {line.quantity}
                    </td>
                    <td className="p-2.5 font-mono text-slate-800 font-semibold">
                      {line.unitPrice.toFixed(2)} {currency}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">
                      {(line.totalPrice || line.quantity * line.unitPrice).toFixed(2)} {currency}
                    </td>
                    <td className="p-2.5 font-mono text-slate-500 text-[11px]">
                      {line.supplierBarcode || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Extracted JSON Modal */}
      {showRawJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2 space-x-reverse">
                <Code className="w-5 h-5 text-emerald-400 ml-1.5" />
                <h3 className="font-bold text-sm">
                  كائن JSON المستخرج القياسي (Valid JSON Object)
                </h3>
              </div>
              <button
                onClick={() => setShowRawJsonModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-auto flex-1 bg-slate-950 font-mono text-xs text-emerald-300 leading-relaxed dir-ltr">
              <pre>{rawExtractedJson}</pre>
            </div>

            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                تم الاستخراج والتنظيم برمجياً 100% محلياً بدون ذكاء اصطناعي
              </span>
              <div className="flex items-center space-x-2 space-x-reverse">
                <button
                  onClick={handleCopyJson}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 space-x-reverse cursor-pointer shadow-xs"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-4 h-4 ml-1 text-emerald-200" />
                      <span>تم النسخ للحافظة!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 ml-1" />
                      <span>نسخ كائن JSON</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowRawJsonModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
