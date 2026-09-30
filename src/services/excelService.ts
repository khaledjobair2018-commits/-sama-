import * as XLSX from 'xlsx';
import {
  MasterColumnMapping,
  MasterItem,
  MatchResult,
  SupplierColumnMapping,
  SupplierInvoiceLine,
} from '../types/pharmacy';

export interface ParsedSheetData {
  fileName: string;
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  detectedHeaderRowIndex: number;
  metadata?: {
    supplierName?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    customerName?: string;
  };
}

// Helper to format any date representation (JS Date, Excel serial number, or date string)
function formatExcelDate(val: any): string | undefined {
  if (!val) return undefined;

  // JS Date instance
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10).replace(/-/g, '/');
  }

  // Excel serial number (typically between 35000 [year 1995] and 55000 [year 2050])
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    try {
      const dateObj = new Date((val - 25569) * 86400 * 1000);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10).replace(/-/g, '/');
      }
    } catch {}
  }

  // String date parsing
  const str = String(val).trim();
  const dateMatch = str.match(/\b(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}[/-]\d{1,2})\b/);
  if (dateMatch) {
    return dateMatch[1].replace(/-/g, '/');
  }

  return str.length >= 4 ? str : undefined;
}

export class ExcelService {
  /**
   * Reads an ArrayBuffer / File as Excel workbook with Multi-Sheet Smart Header Detection
   * Evaluates all sheets, picks the best data sheet, skips metadata/empty rows,
   * extracts invoice header info, and auto-detects columns even with non-standard names.
   */
  public async readWorkbook(file: File): Promise<ParsedSheetData> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      raw: false,
      codepage: 65001,
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        fileName: file.name,
        sheetNames: [],
        selectedSheet: '',
        headers: [],
        rawRows: [],
        detectedHeaderRowIndex: 0,
      };
    }

    // Step 1: Multi-sheet evaluation - find the sheet that actually contains invoice data rows
    let bestSheetName = workbook.SheetNames[0];
    let bestRawMatrix: any[][] = [];
    let maxDataPoints = -1;

    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;

      const matrix = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        defval: '',
        raw: false,
      });

      // Count non-empty cells
      let cellCount = 0;
      for (const row of matrix) {
        if (Array.isArray(row)) {
          cellCount += row.filter(c => String(c ?? '').trim().length > 0).length;
        }
      }

      if (cellCount > maxDataPoints) {
        maxDataPoints = cellCount;
        bestSheetName = sheetName;
        bestRawMatrix = matrix;
      }
    }

    const rawMatrix = bestRawMatrix;
    if (rawMatrix.length === 0) {
      return {
        fileName: file.name,
        sheetNames: workbook.SheetNames,
        selectedSheet: bestSheetName,
        headers: [],
        rawRows: [],
        detectedHeaderRowIndex: 0,
      };
    }

    // Step 2: Extract top metadata before table (Supplier, Invoice No, Date, Customer)
    let extractedSupplier: string | undefined;
    let extractedInvoiceNo: string | undefined;
    let extractedDate: string | undefined;
    let extractedCustomer: string | undefined;

    for (let r = 0; r < Math.min(rawMatrix.length, 15); r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row)) continue;

      // 2.a: Adjacent-cell detection (e.g. Cell A: 'المورد' -> Cell B: 'اسم الشركة')
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell === null || cell === undefined || cell === '') continue;
        const cellStr = String(cell).trim();
        const nextVal = j + 1 < row.length && row[j + 1] !== null && row[j + 1] !== undefined ? String(row[j + 1]).trim() : '';

        if (!extractedSupplier && (cellStr.includes('المستودع') || cellStr.includes('المورد') || cellStr.includes('شركة') || cellStr.includes('مؤسسة') || cellStr.includes('Supplier'))) {
          if (nextVal && !nextVal.includes(':')) extractedSupplier = nextVal;
        }
        if (!extractedInvoiceNo && (cellStr.includes('رقم الفاتورة') || cellStr.includes('الفاتورة رقم') || cellStr.includes('فاتورة رقم') || cellStr.includes('Invoice No') || cellStr.includes('Inv No'))) {
          if (nextVal) extractedInvoiceNo = nextVal;
        }
        if (!extractedDate && (cellStr.includes('تاريخ الفاتورة') || cellStr.includes('تاريخ') || cellStr.includes('Date'))) {
          if (nextVal) extractedDate = formatExcelDate(row[j + 1]) || nextVal.replace(/-/g, '/');
        }
        if (!extractedCustomer && (cellStr.includes('العميل') || cellStr.includes('الصيدلية') || cellStr.includes('المشتري') || cellStr.includes('Customer'))) {
          if (nextVal && !nextVal.includes(':')) extractedCustomer = nextVal;
        }
      }

      // 2.b: In-line regex detection (e.g. 'المورد: شركة الأمل')
      const rowText = row.map(c => String(c ?? '').trim()).join(' ');

      if (!extractedSupplier) {
        const m = rowText.match(/(?:المورد|مستودع|شركة|مؤسسة|محلات|Supplier)\s*[:=\-]\s*([^\t,;|]+)/i);
        if (m) extractedSupplier = m[1].trim();
      }
      if (!extractedInvoiceNo) {
        const m = rowText.match(/(?:رقم الفاتورة|الفاتورة رقم|فاتورة رقم|INV(?:OICE)?(?:\s*#|\s*NO)?)\s*[:=\-]?\s*([A-Za-z0-9\-_]+)/i);
        if (m) extractedInvoiceNo = m[1].trim();
      }
      if (!extractedDate) {
        const m = rowText.match(/(?:تاريخ الفاتورة|التاريخ|Date)\s*[:=\-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i);
        if (m) extractedDate = m[1].trim().replace(/-/g, '/');
      }
      if (!extractedCustomer) {
        const m = rowText.match(/(?:العميل|صيدلية|المشتري|Customer)\s*[:=\-]\s*([^\t,;|]+)/i);
        if (m) extractedCustomer = m[1].trim();
      }
    }

    // Step 3: Comprehensive Header Scoring Algorithm
    // Evaluates every candidate row in top 35 rows
    const strongHeaderKeywords = [
      'اسم الصنف', 'اسم المستحضر', 'اسم الدواء', 'الصنف', 'المستحضر', 'الدواء', 'العلاج', 'البيان', 'بيان', 'المادة',
      'item name', 'item description', 'description', 'product name', 'particulars',
      'سعر الوحدة', 'سعر الشراء', 'سعر البيع', 'سعر التكلفة', 'السعر', 'سعر', 'شراء', 'تكلفة', 'price', 'unit price', 'cost', 'rate',
      'الكمية', 'العدد', 'كمية', 'عدد', 'qty', 'quantity', 'count',
      'باركود', 'كود الصنف', 'رمز الصنف', 'الباركود', 'كود', 'الكود', 'barcode', 'code', 'ean',
      'تاريخ الانتهاء', 'تاريخ الصلاحية', 'الانتهاء', 'الصلاحية', 'انتهاء', 'صلاحية', 'expiry', 'exp date', 'exp',
      'الوحدة', 'وحدة', 'تعبئة', 'unit', 'pack', 'package',
      'البونص', 'بونص', 'مجاني', 'المجاني', 'bonus', 'free',
      'القيمة', 'الإجمالي', 'الاجمالي', 'إجمالي', 'اجمالي', 'المجموع', 'total', 'amount', 'net',
      'تشغيلة', 'batch', 'lot',
      'م', 'تسلسل', 'رقم', '#'
    ];

    let bestHeaderRowIndex = -1;
    let highestHeaderScore = -1;

    for (let r = 0; r < Math.min(rawMatrix.length, 35); r++) {
      const row = rawMatrix[r];
      if (!Array.isArray(row)) continue;

      const nonBlankCells = row.map(c => String(c ?? '').trim()).filter(Boolean);
      if (nonBlankCells.length < 2) continue;

      let rowScore = 0;
      let matchedKeywordCount = 0;

      for (const cell of nonBlankCells) {
        const lowerCell = cell.toLowerCase().replace(/[\s_\-]/g, '');

        // Check if this cell matches any header keyword
        for (const kw of strongHeaderKeywords) {
          const cleanKw = kw.toLowerCase().replace(/[\s_\-]/g, '');
          if (lowerCell === cleanKw || lowerCell.includes(cleanKw)) {
            rowScore += 4;
            matchedKeywordCount++;
            break;
          }
        }

        // Headers are typically short labels (2 - 35 chars)
        if (cell.length >= 2 && cell.length <= 35) {
          rowScore += 1;
        } else if (cell.length > 60) {
          // Penalize long sentences (notes / disclaimers)
          rowScore -= 3;
        }
      }

      // Bonus for variety of column matches
      rowScore += matchedKeywordCount * 3;
      // Bonus if row has 3 or more non-empty cells
      if (nonBlankCells.length >= 3) rowScore += 2;

      // Penalize pure metadata rows (e.g. "المورد: شركة كذا")
      const fullRowText = nonBlankCells.join(' ');
      if (fullRowText.includes('المورد:') || fullRowText.includes('رقم الفاتورة:') || fullRowText.includes('العميل:')) {
        rowScore -= 5;
      }

      if (rowScore > highestHeaderScore) {
        highestHeaderScore = rowScore;
        bestHeaderRowIndex = r;
      }
    }

    // If score is too low or not found, fall back to checking if row 0 has data
    let detectedHeaderRowIndex = bestHeaderRowIndex >= 0 && highestHeaderScore >= 5 ? bestHeaderRowIndex : 0;

    // Step 4: Extract Column Headers
    const rawHeaderRow = rawMatrix[detectedHeaderRowIndex] || [];
    const maxColumns = Math.max(
      rawHeaderRow.length,
      ...rawMatrix.slice(detectedHeaderRowIndex, detectedHeaderRowIndex + 20).map(r => (Array.isArray(r) ? r.length : 0))
    );

    const headers: string[] = [];
    const validColIndices: number[] = [];

    for (let c = 0; c < maxColumns; c++) {
      let title = String(rawHeaderRow[c] ?? '').trim();

      // Clean Excel __EMPTY or undefined
      if (title.toUpperCase().includes('__EMPTY') || title === 'undefined' || !title) {
        // Check if there is data in this column below the header row
        const hasDataBelow = rawMatrix.slice(detectedHeaderRowIndex + 1, detectedHeaderRowIndex + 20).some(
          r => Array.isArray(r) && String(r[c] ?? '').trim().length > 0
        );

        if (hasDataBelow) {
          title = `عمود_${c + 1}`;
        } else {
          continue; // empty column
        }
      }

      // Avoid duplicate header keys
      let uniqueTitle = title;
      let counter = 1;
      while (headers.includes(uniqueTitle)) {
        counter++;
        uniqueTitle = `${title}_${counter}`;
      }

      headers.push(uniqueTitle);
      validColIndices.push(c);
    }

    // Step 5: Build clean rows from rows below header
    const rawRows: Record<string, unknown>[] = [];
    for (let r = detectedHeaderRowIndex + 1; r < rawMatrix.length; r++) {
      const rowData = rawMatrix[r];
      if (!Array.isArray(rowData)) continue;

      // Skip row if completely empty
      const hasAnyVal = validColIndices.some(idx => String(rowData[idx] ?? '').trim().length > 0);
      if (!hasAnyVal) continue;

      const rowObj: Record<string, unknown> = {};
      validColIndices.forEach((colIdx, hIdx) => {
        const headerName = headers[hIdx];
        if (headerName) {
          rowObj[headerName] = rowData[colIdx] !== undefined ? rowData[colIdx] : '';
        }
      });

      rawRows.push(rowObj);
    }

    return {
      fileName: file.name,
      sheetNames: workbook.SheetNames,
      selectedSheet: bestSheetName,
      headers,
      rawRows,
      detectedHeaderRowIndex,
      metadata: {
        supplierName: extractedSupplier,
        invoiceNumber: extractedInvoiceNo,
        invoiceDate: extractedDate,
        customerName: extractedCustomer,
      },
    };
  }

  /**
   * Guess best column mappings for Master Items
   */
  public autoDetectMasterColumns(headers: string[]): MasterColumnMapping {
    const mapping: MasterColumnMapping = {
      name: '',
      barcode: '',
      price: '',
      strength: '',
      dosageForm: '',
      packSize: '',
      company: '',
      activeIngredient: '',
    };

    const normHeaders = headers.map(h => ({
      original: h,
      clean: h.toLowerCase().trim().replace(/[\s_\-]/g, ''),
    }));

    for (const h of normHeaders) {
      const c = h.clean;
      if (!mapping.name && (c.includes('صنف') || c.includes('name') || c.includes('item') || c.includes('وصف') || c.includes('desc') || c.includes('بيان') || c.includes('المادة') || c.includes('دواء') || c.includes('منتج'))) {
        mapping.name = h.original;
      } else if (!mapping.barcode && (c.includes('باركود') || c.includes('barcode') || c.includes('كود') || c.includes('code') || c.includes('ean'))) {
        mapping.barcode = h.original;
      } else if (!mapping.price && (c.includes('سعر') || c.includes('price') || c.includes('تكلفة') || c.includes('cost') || c.includes('بيع') || c.includes('شراء'))) {
        mapping.price = h.original;
      } else if (!mapping.strength && (c.includes('تركيز') || c.includes('strength') || c.includes('dose') || c.includes('عيار'))) {
        mapping.strength = h.original;
      } else if (!mapping.dosageForm && (c.includes('شكل') || c.includes('form') || c.includes('نوع') || c.includes('صيدلاني'))) {
        mapping.dosageForm = h.original;
      } else if (!mapping.packSize && (c.includes('عبوة') || c.includes('pack') || c.includes('حجم') || c.includes('size'))) {
        mapping.packSize = h.original;
      } else if (!mapping.company && (c.includes('شركة') || c.includes('company') || c.includes('مصنع') || c.includes('مورد'))) {
        mapping.company = h.original;
      } else if (!mapping.activeIngredient && (c.includes('مادة') || c.includes('فعالة') || c.includes('generic') || c.includes('active'))) {
        mapping.activeIngredient = h.original;
      }
    }

    return mapping;
  }

  /**
   * Convert mapped raw rows to MasterItem array
   */
  public convertToMasterItems(rows: Record<string, unknown>[], mapping: MasterColumnMapping): MasterItem[] {
    const items: MasterItem[] = [];

    rows.forEach((row, idx) => {
      let name = mapping.name ? String(row[mapping.name] || '').trim() : '';
      if (!name) {
        for (const [key, val] of Object.entries(row)) {
          if (key === mapping.price || key === mapping.barcode) continue;
          const s = String(val ?? '').trim();
          if (s.length >= 3 && /[a-zA-Z\u0600-\u06FF]/.test(s)) {
            name = s;
            break;
          }
        }
      }

      const barcode = String(row[mapping.barcode] || '').trim();
      const rawPrice = String(row[mapping.price] || '0').replace(/[^\d\.]/g, '');
      const price = parseFloat(rawPrice) || 0;

      if (!name) return;

      const strength = mapping.strength ? String(row[mapping.strength] || '').trim() : undefined;
      const dosageForm = mapping.dosageForm ? String(row[mapping.dosageForm] || '').trim() : undefined;
      const packSize = mapping.packSize ? String(row[mapping.packSize] || '').trim() : undefined;
      const company = mapping.company ? String(row[mapping.company] || '').trim() : undefined;
      const activeIngredient = mapping.activeIngredient ? String(row[mapping.activeIngredient] || '').trim() : undefined;

      items.push({
        id: `MI-IMP-${Date.now()}-${idx + 1}`,
        name,
        barcode: barcode || `BC-${Date.now()}-${idx + 1}`,
        price,
        costPrice: price * 0.8,
        strength,
        dosageForm,
        packSize,
        company,
        activeIngredient,
        updatedAt: new Date().toISOString(),
      });
    });

    return items;
  }

  /**
   * Automatic Robust Column Auto-Mapping for Supplier Invoices:
   * 1. First Pass: Comprehensive header dictionary matching.
   * 2. Second Pass: Data-Inspection Fallback (examines actual row cell types if a column header was ambiguous).
   */
  public autoDetectSupplierColumns(headers: string[], sampleRows: Record<string, unknown>[] = []): SupplierColumnMapping {
    const mapping: SupplierColumnMapping = {
      name: '',
      quantity: '',
      price: '',
      barcode: '',
      total: '',
      expiry: '',
      batch: '',
      bonus: '',
      unit: '',
    };

    const normHeaders = headers.map(h => ({
      original: h,
      clean: h.toLowerCase().trim().replace(/[\s_\-]/g, ''),
    }));

    // First Pass: Match by Header Titles
    for (const h of normHeaders) {
      const c = h.clean;

      // Item Name
      if (
        !mapping.name &&
        (c.includes('اسم') ||
          c.includes('صنف') ||
          c.includes('دواء') ||
          c.includes('علاج') ||
          c.includes('مستحضر') ||
          c.includes('منتج') ||
          c.includes('بيان') ||
          c.includes('المادة') ||
          c.includes('وصف') ||
          c.includes('بضاعة') ||
          c.includes('تفاصيل') ||
          c.includes('item') ||
          c.includes('name') ||
          c.includes('desc') ||
          c.includes('product') ||
          c.includes('drug') ||
          c.includes('particular'))
      ) {
        mapping.name = h.original;
      }
      // Unit Price
      else if (
        !mapping.price &&
        (c.includes('سعرالوحدة') ||
          c.includes('سعرشراء') ||
          c.includes('سعرالشراء') ||
          c.includes('سعرالتكلفة') ||
          c.includes('سعرالبيع') ||
          c.includes('سعرفردي') ||
          c.includes('سعرجمهور') ||
          c.includes('سعرصيدلي') ||
          c.includes('تكلفة') ||
          c.includes('سعر') ||
          c.includes('شراء') ||
          c.includes('price') ||
          c.includes('cost') ||
          c.includes('rate') ||
          c.includes('uprice') ||
          c.includes('unitprice'))
      ) {
        mapping.price = h.original;
      }
      // Quantity
      else if (
        !mapping.quantity &&
        (c.includes('كمية') ||
          c.includes('كميه') ||
          c.includes('الكمية') ||
          c.includes('الكميه') ||
          c.includes('العدد') ||
          c.includes('عدد') ||
          c.includes('وارد') ||
          c.includes('مطلوب') ||
          c.includes('qty') ||
          c.includes('quantity') ||
          c.includes('count') ||
          c.includes('units') ||
          c.includes('qnt'))
      ) {
        mapping.quantity = h.original;
      }
      // Barcode
      else if (
        !mapping.barcode &&
        (c.includes('باركود') ||
          c.includes('الباركود') ||
          c.includes('كود') ||
          c.includes('الكود') ||
          c.includes('رمز') ||
          c.includes('الرمز') ||
          c.includes('barcode') ||
          c.includes('code') ||
          c.includes('ean') ||
          c.includes('upc') ||
          c.includes('sku'))
      ) {
        mapping.barcode = h.original;
      }
      // Bonus
      else if (
        !mapping.bonus &&
        (c.includes('بونص') ||
          c.includes('البونص') ||
          c.includes('مجاني') ||
          c.includes('المجاني') ||
          c.includes('هدية') ||
          c.includes('bonus') ||
          c.includes('free') ||
          c.includes('gift'))
      ) {
        mapping.bonus = h.original;
      }
      // Expiry Date
      else if (
        !mapping.expiry &&
        (c.includes('انتهاء') ||
          c.includes('الانتهاء') ||
          c.includes('صلاحية') ||
          c.includes('الصلاحية') ||
          c.includes('تاريخ') ||
          c.includes('exp') ||
          c.includes('expiry') ||
          c.includes('validity'))
      ) {
        mapping.expiry = h.original;
      }
      // Unit
      else if (
        !mapping.unit &&
        (c.includes('وحدة') ||
          c.includes('الوحدة') ||
          c.includes('تعبئة') ||
          c.includes('نوع') ||
          c.includes('عبوة') ||
          c.includes('العبوة') ||
          c.includes('unit') ||
          c.includes('pack') ||
          c.includes('package') ||
          c.includes('uom'))
      ) {
        mapping.unit = h.original;
      }
      // Total
      else if (
        !mapping.total &&
        (c.includes('اجمالي') ||
          c.includes('إجمالي') ||
          c.includes('القيمة') ||
          c.includes('قيمة') ||
          c.includes('المجموع') ||
          c.includes('مجموع') ||
          c.includes('total') ||
          c.includes('amount') ||
          c.includes('net') ||
          c.includes('gross'))
      ) {
        mapping.total = h.original;
      }
      // Batch
      else if (
        !mapping.batch &&
        (c.includes('تشغيلة') ||
          c.includes('التشغيلة') ||
          c.includes('دفعة') ||
          c.includes('batch') ||
          c.includes('lot'))
      ) {
        mapping.batch = h.original;
      }
    }

    // Second Pass: Data Analysis Fallback if any primary column is missing
    if (sampleRows.length > 0 && (!mapping.name || !mapping.price || !mapping.quantity)) {
      const rowsToInspect = sampleRows.slice(0, 15);

      for (const h of headers) {
        // Check cell values in this column
        const values = rowsToInspect.map(r => r[h]).filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        if (values.length === 0) continue;

        // 1. Guess Item Name: column containing Arabic/English text >= 4 characters
        if (!mapping.name) {
          const textCount = values.filter(v => {
            const s = String(v).trim();
            return s.length >= 3 && /[a-zA-Z\u0600-\u06FF]/.test(s) && !/^\d{4}[/-]\d{1,2}/.test(s);
          }).length;

          if (textCount >= values.length * 0.6) {
            mapping.name = h;
            continue;
          }
        }

        // 2. Guess Price: numeric float column with decimals or values > 0
        if (!mapping.price && h !== mapping.name) {
          const numericValues = values.map(v => parseFloat(String(v).replace(/[^\d\.]/g, ''))).filter(n => !isNaN(n) && n > 0);
          const hasDecimals = numericValues.some(n => n % 1 !== 0);
          const isNotBarcode = numericValues.every(n => n < 100000000);

          if (numericValues.length >= values.length * 0.7 && isNotBarcode && (hasDecimals || numericValues.some(n => n > 5))) {
            mapping.price = h;
            continue;
          }
        }

        // 3. Guess Quantity: integer column typically between 1 and 2000
        if (!mapping.quantity && h !== mapping.name && h !== mapping.price) {
          const intValues = values.map(v => parseInt(String(v).replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 1 && n <= 5000);
          if (intValues.length >= values.length * 0.7) {
            mapping.quantity = h;
            continue;
          }
        }

        // 4. Guess Barcode: 10 to 14 digit numeric string
        if (!mapping.barcode && h !== mapping.name && h !== mapping.price && h !== mapping.quantity) {
          const barcodeMatches = values.filter(v => /^\d{8,14}$/.test(String(v).trim())).length;
          if (barcodeMatches >= values.length * 0.5) {
            mapping.barcode = h;
            continue;
          }
        }

        // 5. Guess Expiry: date pattern
        if (!mapping.expiry && h !== mapping.name && h !== mapping.price && h !== mapping.quantity) {
          const dateMatches = values.filter(v => formatExcelDate(v) !== undefined).length;
          if (dateMatches >= values.length * 0.5) {
            mapping.expiry = h;
            continue;
          }
        }
      }
    }

    return mapping;
  }

  /**
   * Convert mapped raw rows to SupplierInvoiceLine array, STRICTLY PRESERVING ROW NUMBERS
   * Ultra-robust: gracefully handles missing columns, defaults missing quantity to 1,
   * extracts price from total if needed, and excludes summary rows automatically.
   */
  public convertToSupplierLines(rows: Record<string, unknown>[], mapping: SupplierColumnMapping): SupplierInvoiceLine[] {
    const lines: SupplierInvoiceLine[] = [];
    let currentRowNumber = 1;

    for (const row of rows) {
      // 1. Resolve Item Name
      let rawName = mapping.name ? String(row[mapping.name] ?? '').trim() : '';

      // If mapped column was blank in this row, scan other columns for text
      if (!rawName) {
        for (const [key, val] of Object.entries(row)) {
          if (key === mapping.price || key === mapping.quantity || key === mapping.barcode || key === mapping.expiry) continue;
          const s = String(val ?? '').trim();
          if (s.length >= 3 && /[a-zA-Z\u0600-\u06FF]/.test(s) && !/^\d{4}[/-]/.test(s)) {
            rawName = s;
            break;
          }
        }
      }

      if (!rawName || rawName.length < 2) continue;

      // 2. Smart Cleaning: Ignore summary/total lines
      const lowerName = rawName.toLowerCase();
      if (
        lowerName.startsWith('المجموع') ||
        lowerName.startsWith('اجمالي') ||
        lowerName.startsWith('إجمالي') ||
        lowerName.startsWith('grand total') ||
        lowerName.startsWith('total') ||
        lowerName === 'المجموع' ||
        lowerName.includes('صافي الفاتورة') ||
        lowerName.includes('الضريبة') ||
        lowerName.includes('tax')
      ) {
        continue;
      }

      // 3. Resolve Quantity
      let quantity = 1;
      if (mapping.quantity && row[mapping.quantity] !== undefined) {
        const rawQty = String(row[mapping.quantity]).replace(/[^\d\.]/g, '');
        const parsedQty = parseFloat(rawQty);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          quantity = parsedQty;
        }
      }

      // 4. Resolve Bonus
      let bonusQuantity = 0;
      if (mapping.bonus && row[mapping.bonus] !== undefined) {
        const rawBonus = String(row[mapping.bonus]).replace(/[^\d\.]/g, '');
        const parsedBonus = parseFloat(rawBonus);
        if (!isNaN(parsedBonus) && parsedBonus > 0) {
          bonusQuantity = parsedBonus;
        }
      }

      // 5. Resolve Unit Price
      let unitPrice = 0;
      if (mapping.price && row[mapping.price] !== undefined) {
        const rawPrice = String(row[mapping.price]).replace(/[^\d\.]/g, '');
        const parsedPrice = parseFloat(rawPrice);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          unitPrice = parsedPrice;
        }
      }

      // 6. Resolve Total Price
      let totalPrice = quantity * unitPrice;
      if (mapping.total && row[mapping.total] !== undefined) {
        const rawTotal = String(row[mapping.total]).replace(/[^\d\.]/g, '');
        const parsedTotal = parseFloat(rawTotal);
        if (!isNaN(parsedTotal) && parsedTotal > 0) {
          totalPrice = parsedTotal;
          // If unit price was missing, calculate it from total:
          if (unitPrice === 0 && quantity > 0) {
            unitPrice = Math.round((totalPrice / quantity) * 100) / 100;
          }
        }
      }

      // True cost after bonus: (totalPrice / (quantity + bonusQuantity))
      const totalUnits = quantity + bonusQuantity;
      const effectiveUnitPrice = totalUnits > 0 ? Math.round((totalPrice / totalUnits) * 100) / 100 : unitPrice;

      // 7. Resolve Metadata (Barcode, Expiry, Unit, Batch)
      const barcode = mapping.barcode ? String(row[mapping.barcode] ?? '').trim() : undefined;
      const rawExp = mapping.expiry ? row[mapping.expiry] : undefined;
      const expiry = formatExcelDate(rawExp);
      const batch = mapping.batch ? String(row[mapping.batch] ?? '').trim() : undefined;
      const unit = mapping.unit ? String(row[mapping.unit] ?? '').trim() : 'باكت';

      lines.push({
        rowNumber: currentRowNumber++,
        rawSupplierName: rawName,
        quantity,
        bonusQuantity,
        unitPrice,
        effectiveUnitPrice,
        totalPrice: Math.round(totalPrice * 100) / 100,
        supplierBarcode: barcode && barcode !== 'undefined' ? barcode : undefined,
        extractedUnit: unit && unit !== 'undefined' ? unit : 'باكت',
        expiryDate: expiry && expiry !== 'undefined' ? expiry : undefined,
        batchNumber: batch && batch !== 'undefined' ? batch : undefined,
      });
    }

    return lines;
  }

  /**
   * One-Click Instant File Ingestion:
   * Reads file, auto-detects header row, maps columns, and converts to lines instantly!
   */
  public async autoParseInvoiceFile(file: File): Promise<{
    lines: SupplierInvoiceLine[];
    sheetData: ParsedSheetData;
    mapping: SupplierColumnMapping;
  }> {
    const sheetData = await this.readWorkbook(file);
    const mapping = this.autoDetectSupplierColumns(sheetData.headers, sheetData.rawRows);
    const lines = this.convertToSupplierLines(sheetData.rawRows, mapping);
    return { lines, sheetData, mapping };
  }

  /**
   * EXPORT 1: Quick Entry File (ملف الإدخال السريع الصيدلاني)
   */
  public exportQuickEntryFile(results: MatchResult[], format: 'xlsx' | 'csv' = 'xlsx', currency = 'ر.س'): void {
    const rows = results.map(r => {
      const matched = r.matchedItem;
      return {
        'الترتيب': r.rowNumber,
        'الباركود الرسمي': matched ? matched.barcode : (r.invoiceLine.supplierBarcode || 'غير مسجل'),
        'اسم الصنف في النظام': matched ? matched.name : `[غير مطابق] ${r.invoiceLine.rawSupplierName}`,
        'الكمية': r.invoiceLine.quantity,
        'البونص (مجاني)': r.invoiceLine.bonusQuantity || 0,
        [`سعر الشراء (${currency})`]: r.invoiceLine.unitPrice,
        [`السعر الفعلي بعد البونص (${currency})`]: r.invoiceLine.effectiveUnitPrice || r.invoiceLine.unitPrice,
        [`إجمالي الشراء (${currency})`]: r.totalSupplierCost,
        'حالة الصنف': r.status === 'MATCHED' ? 'مطابق' : r.status === 'REVIEW_REQUIRED' ? 'يحتاج مراجعة' : 'غير مطابق',
        'تاريخ الصلاحية': r.invoiceLine.expiryDate || '',
        'رقم التشغيلة': r.invoiceLine.batchNumber || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ملف الإدخال السريع');

    const fileName = `ملف_الإدخال_السريع_${new Date().toISOString().slice(0, 10)}.${format}`;
    XLSX.writeFile(workbook, fileName, { bookType: format });
  }

  /**
   * EXPORT 2: Comprehensive Invoice Matching Report (تقرير المطابقة الكامل)
   */
  public exportFullMatchReport(results: MatchResult[], invoiceInfo: { invoiceNumber: string; supplierName: string }, currency = 'ر.س'): void {
    const rows = results.map(r => {
      const matched = r.matchedItem;
      const statusLabel =
        r.status === 'MATCHED'
          ? 'مطابقة مؤكدة'
          : r.status === 'REVIEW_REQUIRED'
          ? 'يحتاج مراجعة صيدلانية'
          : r.status === 'ERROR'
          ? 'خطأ في السطر'
          : 'غير مطابق';

      return {
        'رقم الصف الأصلي': r.rowNumber,
        'اسم الصنف في فاتورة المورد': r.invoiceLine.rawSupplierName,
        'الصنف الرسمي في النظام': matched ? matched.name : '—',
        'الباركود الرسمي': matched ? matched.barcode : (r.invoiceLine.supplierBarcode || '—'),
        'الكمية': r.invoiceLine.quantity,
        'البونص': r.invoiceLine.bonusQuantity || 0,
        [`سعر المورد (${currency})`]: r.invoiceLine.unitPrice,
        [`سعر النظام (${currency})`]: matched ? matched.price : '—',
        [`السعر الفعلي بعد البونص (${currency})`]: r.invoiceLine.effectiveUnitPrice || r.invoiceLine.unitPrice,
        [`فرق السعر (${currency})`]: r.priceDifference !== 0 ? r.priceDifference : 0,
        'نسبة فرق السعر %': `${r.priceDiffPercentage}%`,
        [`إجمالي المورد (${currency})`]: r.totalSupplierCost,
        [`إجمالي النظام (${currency})`]: r.totalMasterCost,
        'حالة المطابقة': statusLabel,
        'درجة الثقة %': `${r.confidenceScore}%`,
        'ملاحظات المطابقة': r.isManuallyConfirmed ? 'تم الاعتماد يدوياً' : (r.notes || r.reviewReason || r.unmatchedReason || ''),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير المطابقة النهائي');

    const fileName = `تقرير_مطابقة_فاتورة_${invoiceInfo.supplierName}_${invoiceInfo.invoiceNumber || new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  /**
   * EXPORT 3: Price Variance Report (تقرير فارق الأسعار)
   */
  public exportPriceVarianceReport(results: MatchResult[], currency = 'ر.س'): void {
    const rows = results
      .filter(r => r.matchedItem)
      .map(r => ({
        'رقم الصف': r.rowNumber,
        'الصنف الرسمي': r.matchedItem!.name,
        'الباركود': r.matchedItem!.barcode,
        'اسم المورد بالفاتورة': r.invoiceLine.rawSupplierName,
        'الكمية': r.invoiceLine.quantity,
        'البونص (مجاني)': r.invoiceLine.bonusQuantity || 0,
        [`سعر المورد (${currency})`]: r.invoiceLine.unitPrice,
        [`سعر النظام المرجعي (${currency})`]: r.matchedItem!.price,
        [`السعر الفعلي بعد البونص (${currency})`]: r.invoiceLine.effectiveUnitPrice || r.invoiceLine.unitPrice,
        [`فارق سعر الوحدة (${currency})`]: r.priceDifference,
        'نسبة الفارق %': `${r.priceDiffPercentage}%`,
        [`إجمالي فاتورة المورد (${currency})`]: r.totalSupplierCost,
        [`إجمالي حسب النظام (${currency})`]: r.totalMasterCost,
        [`إجمالي فرق القيمة (${currency})`]: r.totalDifference,
        'حالة السعر': r.priceDifference > 0 ? 'سعر المورد أعلى (خسارة/تكلفة إضافية)' : r.priceDifference < 0 ? 'سعر المورد أقل (وفر/خصم)' : 'مطابق تماماً',
      }))
      .sort((a, b) => Math.abs(Number(b[`إجمالي فرق القيمة (${currency})`]) || 0) - Math.abs(Number(a[`إجمالي فرق القيمة (${currency})`]) || 0));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'فروق الأسعار');

    XLSX.writeFile(workbook, `تقرير_فروق_الأسعار_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /**
   * EXPORT 4: Unmatched Items Report (الأصناف غير المطابقة)
   */
  public exportUnmatchedReport(results: MatchResult[], currency = 'ر.س'): void {
    const rows = results
      .filter(r => r.status === 'UNMATCHED' || r.status === 'ERROR')
      .map(r => ({
        'رقم الصف الأصلي': r.rowNumber,
        'اسم الصنف في الفاتورة': r.invoiceLine.rawSupplierName,
        'الكمية': r.invoiceLine.quantity,
        [`السعر (${currency})`]: r.invoiceLine.unitPrice,
        'باركود المورد': r.invoiceLine.supplierBarcode || '',
        'سبب عدم المطابقة': r.unmatchedReason || 'لم يتم العثور على صنف مطابق في قاعدة البيانات',
      }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'أصناف غير مطابقة');

    XLSX.writeFile(workbook, `تقرير_الأصناف_غير_المطابقة_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /**
   * EXPORT 5: Export to CSV directly for any custom dataset
   */
  public exportTableToCsv(data: Record<string, unknown>[], fileName: string): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const excelService = new ExcelService();
