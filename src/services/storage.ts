import {
  AppSettings,
  AuditLogEntry,
  ConfirmedMapping,
  MasterItem,
  StoredInvoice,
} from '../types/pharmacy';

const STORAGE_KEYS = {
  MASTER_ITEMS: 'pharma_master_items_v1',
  CONFIRMED_MAPPINGS: 'pharma_confirmed_mappings_v1',
  STORED_INVOICES: 'pharma_stored_invoices_v1',
  AUDIT_LOG: 'pharma_audit_log_v1',
  SETTINGS: 'pharma_settings_v1',
};

// Initial realistic pharmacy master database
export const SEED_MASTER_ITEMS: MasterItem[] = [
  {
    id: 'MI-001',
    name: 'Panadol Extra 500mg/65mg Tablet',
    nameAr: 'بنادول إكسترا 500 ملجم / 65 ملجم أقراص',
    barcode: '6281001000011',
    price: 12.50,
    costPrice: 9.80,
    strength: '500mg/65mg',
    dosageForm: 'Tablet',
    packSize: '24 Tablets',
    packQty: 24,
    company: 'GSK',
    activeIngredient: 'Paracetamol + Caffeine',
  },
  {
    id: 'MI-002',
    name: 'Panadol Advance 500mg Tablet',
    nameAr: 'بنادول أدفانس 500 ملجم أقراص',
    barcode: '6281001000028',
    price: 9.75,
    costPrice: 7.60,
    strength: '500mg',
    dosageForm: 'Tablet',
    packSize: '24 Tablets',
    packQty: 24,
    company: 'GSK',
    activeIngredient: 'Paracetamol',
  },
  {
    id: 'MI-003',
    name: 'Paracetamol 120mg/5ml Syrup 100ml',
    nameAr: 'باراسيتامول شراب أطفال 120 ملجم/5 مل 100 مل',
    barcode: '6281001000035',
    price: 7.20,
    costPrice: 5.40,
    strength: '120mg/5ml',
    dosageForm: 'Syrup',
    packSize: '100ml Bottle',
    company: 'SPIMACO',
    activeIngredient: 'Paracetamol',
  },
  {
    id: 'MI-004',
    name: 'Amoxicillin 500mg Capsule',
    nameAr: 'أموكسيسيلين 500 ملجم كبسولات',
    barcode: '6281001000042',
    price: 18.00,
    costPrice: 14.10,
    strength: '500mg',
    dosageForm: 'Capsule',
    packSize: '20 Capsules',
    packQty: 20,
    company: 'Tabuk',
    activeIngredient: 'Amoxicillin',
  },
  {
    id: 'MI-005',
    name: 'Amoxicillin 250mg Capsule',
    nameAr: 'أموكسيسيلين 250 ملجم كبسولات',
    barcode: '6281001000059',
    price: 13.50,
    costPrice: 10.50,
    strength: '250mg',
    dosageForm: 'Capsule',
    packSize: '20 Capsules',
    packQty: 20,
    company: 'Tabuk',
    activeIngredient: 'Amoxicillin',
  },
  {
    id: 'MI-006',
    name: 'Augmentin 1g Tablet',
    nameAr: 'أوجمنتين 1 جم أقراص',
    barcode: '6281001000066',
    price: 49.85,
    costPrice: 39.50,
    strength: '1000mg',
    dosageForm: 'Tablet',
    packSize: '14 Tablets',
    packQty: 14,
    company: 'GSK',
    activeIngredient: 'Amoxicillin + Clavulanic Acid',
  },
  {
    id: 'MI-DICLOV',
    name: 'Dicloveron 50mg Capsule',
    nameAr: 'ديكلوفيرون 50 ملجم كبسول بيوفارما',
    barcode: '6281001000999',
    price: 21.00,
    costPrice: 16.50,
    strength: '50mg',
    dosageForm: 'Capsule',
    packSize: '20 Capsules',
    packQty: 20,
    company: 'Biopharma',
    activeIngredient: 'Diclofenac Sodium',
  },
  {
    id: 'MI-007',
    name: 'Vitamin D3 50,000 IU Capsule',
    nameAr: 'فيتامين د3 50000 وحدة دولية كبسولات',
    barcode: '6281001000073',
    price: 65.00,
    costPrice: 51.00,
    strength: '50000 IU',
    dosageForm: 'Capsule',
    packSize: '12 Capsules',
    packQty: 12,
    company: 'Jamieson',
    activeIngredient: 'Cholecalciferol',
  },
  {
    id: 'MI-008',
    name: 'Vitamin D3 5,000 IU Capsule',
    nameAr: 'فيتامين د3 5000 وحدة دولية كبسولات',
    barcode: '6281001000080',
    price: 42.00,
    costPrice: 32.50,
    strength: '5000 IU',
    dosageForm: 'Capsule',
    packSize: '60 Capsules',
    packQty: 60,
    company: 'Jamieson',
    activeIngredient: 'Cholecalciferol',
  },
  {
    id: 'MI-009',
    name: 'Omeprazole 20mg Capsule',
    nameAr: 'أوميبرازول 20 ملجم كبسولات',
    barcode: '6281001000097',
    price: 24.30,
    costPrice: 19.00,
    strength: '20mg',
    dosageForm: 'Capsule',
    packSize: '28 Capsules',
    packQty: 28,
    company: 'AstraZeneca',
    activeIngredient: 'Omeprazole',
  },
  {
    id: 'MI-010',
    name: 'Omeprazole 40mg Capsule',
    nameAr: 'أوميبرازول 40 ملجم كبسولات',
    barcode: '6281001000103',
    price: 36.50,
    costPrice: 28.90,
    strength: '40mg',
    dosageForm: 'Capsule',
    packSize: '28 Capsules',
    packQty: 28,
    company: 'AstraZeneca',
    activeIngredient: 'Omeprazole',
  },
  {
    id: 'MI-011',
    name: 'Brufen 400mg Tablet',
    nameAr: 'بروفين 400 ملجم أقراص',
    barcode: '6281001000110',
    price: 15.60,
    costPrice: 12.20,
    strength: '400mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Abbott',
    activeIngredient: 'Ibuprofen',
  },
  {
    id: 'MI-012',
    name: 'Brufen 600mg Tablet',
    nameAr: 'بروفين 600 ملجم أقراص',
    barcode: '6281001000127',
    price: 21.00,
    costPrice: 16.50,
    strength: '600mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Abbott',
    activeIngredient: 'Ibuprofen',
  },
  {
    id: 'MI-013',
    name: 'Otrivin 0.1% Adult Nasal Drops 10ml',
    nameAr: 'أوتريفين 0.1% قطرة أنف للكبار 10 مل',
    barcode: '6281001000134',
    price: 11.20,
    costPrice: 8.80,
    strength: '0.1%',
    dosageForm: 'Drops',
    packSize: '10ml',
    company: 'Novartis',
    activeIngredient: 'Xylometazoline',
  },
  {
    id: 'MI-014',
    name: 'Otrivin 0.05% Child Nasal Drops 10ml',
    nameAr: 'أوتريفين 0.05% قطرة أنف للأطفال 10 مل',
    barcode: '6281001000141',
    price: 10.50,
    costPrice: 8.20,
    strength: '0.05%',
    dosageForm: 'Drops',
    packSize: '10ml',
    company: 'Novartis',
    activeIngredient: 'Xylometazoline',
  },
  {
    id: 'MI-015',
    name: 'Ventolin 100mcg Inhaler',
    nameAr: 'فينتولين 100 ميكروجرام بخاخ استنشاق',
    barcode: '6281001000158',
    price: 19.80,
    costPrice: 15.60,
    strength: '100mcg',
    dosageForm: 'Spray',
    packSize: '200 Puffs',
    company: 'GSK',
    activeIngredient: 'Salbutamol',
  },
  {
    id: 'MI-016',
    name: 'Cataflam 50mg Tablet',
    nameAr: 'كاتافلام 50 ملجم أقراص',
    barcode: '6281001000165',
    price: 22.40,
    costPrice: 17.50,
    strength: '50mg',
    dosageForm: 'Tablet',
    packSize: '20 Tablets',
    packQty: 20,
    company: 'Novartis',
    activeIngredient: 'Diclofenac Potassium',
  },
  {
    id: 'MI-017',
    name: 'Voltaren 75mg/3ml Ampoule',
    nameAr: 'فولتارين 75 ملجم / 3 مل أمبولات حقن',
    barcode: '6281001000172',
    price: 28.50,
    costPrice: 22.30,
    strength: '75mg/3ml',
    dosageForm: 'Ampoule',
    packSize: '5 Ampoules',
    packQty: 5,
    company: 'Novartis',
    activeIngredient: 'Diclofenac Sodium',
  },
  {
    id: 'MI-018',
    name: 'Voltaren Emulgel 1% 50g',
    nameAr: 'فولتارين إيمولجل 1% جل 50 جم',
    barcode: '6281001000189',
    price: 18.90,
    costPrice: 14.80,
    strength: '1%',
    dosageForm: 'Gel',
    packSize: '50g Tube',
    company: 'GSK',
    activeIngredient: 'Diclofenac Diethylamine',
  },
  {
    id: 'MI-019',
    name: 'Glucophage 500mg Tablet',
    nameAr: 'جلوكوفاج 500 ملجم أقراص',
    barcode: '6281001000196',
    price: 14.20,
    costPrice: 11.10,
    strength: '500mg',
    dosageForm: 'Tablet',
    packSize: '50 Tablets',
    packQty: 50,
    company: 'Merck',
    activeIngredient: 'Metformin',
  },
  {
    id: 'MI-020',
    name: 'Glucophage 1000mg Tablet',
    nameAr: 'جلوكوفاج 1000 ملجم أقراص',
    barcode: '6281001000202',
    price: 25.80,
    costPrice: 20.20,
    strength: '1000mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Merck',
    activeIngredient: 'Metformin',
  },
  {
    id: 'MI-021',
    name: 'Lipitor 20mg Tablet',
    nameAr: 'ليبيتور 20 ملجم أقراص',
    barcode: '6281001000219',
    price: 78.50,
    costPrice: 62.00,
    strength: '20mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Pfizer',
    activeIngredient: 'Atorvastatin',
  },
  {
    id: 'MI-022',
    name: 'Lipitor 40mg Tablet',
    nameAr: 'ليبيتور 40 ملجم أقراص',
    barcode: '6281001000226',
    price: 105.00,
    costPrice: 83.50,
    strength: '40mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Pfizer',
    activeIngredient: 'Atorvastatin',
  },
  {
    id: 'MI-023',
    name: 'Nexium 20mg Tablet',
    nameAr: 'نيكسيوم 20 ملجم أقراص',
    barcode: '6281001000233',
    price: 68.20,
    costPrice: 54.00,
    strength: '20mg',
    dosageForm: 'Tablet',
    packSize: '28 Tablets',
    packQty: 28,
    company: 'AstraZeneca',
    activeIngredient: 'Esomeprazole',
  },
  {
    id: 'MI-024',
    name: 'Nexium 40mg Tablet',
    nameAr: 'نيكسيوم 40 ملجم أقراص',
    barcode: '6281001000240',
    price: 94.60,
    costPrice: 75.00,
    strength: '40mg',
    dosageForm: 'Tablet',
    packSize: '28 Tablets',
    packQty: 28,
    company: 'AstraZeneca',
    activeIngredient: 'Esomeprazole',
  },
  {
    id: 'MI-025',
    name: 'Fucidin 2% Cream 15g',
    nameAr: 'فيوسيدين 2% كريم 15 جم',
    barcode: '6281001000257',
    price: 16.50,
    costPrice: 12.80,
    strength: '2%',
    dosageForm: 'Cream',
    packSize: '15g Tube',
    company: 'LEO Pharma',
    activeIngredient: 'Fusidic Acid',
  },
  {
    id: 'MI-026',
    name: 'Fucidin 2% Ointment 15g',
    nameAr: 'فيوسيدين 2% مرهم 15 جم',
    barcode: '6281001000264',
    price: 16.50,
    costPrice: 12.80,
    strength: '2%',
    dosageForm: 'Ointment',
    packSize: '15g Tube',
    company: 'LEO Pharma',
    activeIngredient: 'Sodium Fusidate',
  },
  {
    id: 'MI-027',
    name: 'Linopril 10mg Tablets JPM',
    nameAr: 'لينوبريل 10 ملغرام أقراص الدوائية الأردنية',
    barcode: '6281001000271',
    price: 26.50,
    costPrice: 20.80,
    strength: '10mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'الدوائية الأردنية',
    activeIngredient: 'Lisinopril',
  },
  {
    id: 'MI-028',
    name: 'Supranil 25mg Tablets El Fateh',
    nameAr: 'سوبرانيل 25 مجم اقرص الفتح',
    barcode: '6281001000288',
    price: 19.00,
    costPrice: 14.50,
    strength: '25mg',
    dosageForm: 'Tablet',
    packSize: '20 Tablets',
    packQty: 20,
    company: 'الفتح',
    activeIngredient: 'Clomipramine',
  },
  {
    id: 'MI-029',
    name: 'Diclodenc Retard 100mg Tablets',
    nameAr: 'ديكلودنك ريتارد 100اقراص',
    barcode: '6281001000295',
    price: 24.00,
    costPrice: 18.20,
    strength: '100mg',
    dosageForm: 'Tablet',
    packSize: '100 Tablets (10x10)',
    packQty: 100,
    company: 'دنك فارما',
    activeIngredient: 'Diclofenac Sodium SR',
  },
  {
    id: 'MI-030',
    name: 'Concor 5mg Tablet',
    nameAr: 'كونكور 5 مجم أقراص',
    barcode: '6281001000301',
    price: 32.50,
    costPrice: 25.00,
    strength: '5mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Merck',
    activeIngredient: 'Bisoprolol Fumarate',
  },
  {
    id: 'MI-031',
    name: 'Concor Cor 2.5mg Tablet',
    nameAr: 'كونكور كور 2.5 مجم أقراص',
    barcode: '6281001000318',
    price: 28.00,
    costPrice: 21.50,
    strength: '2.5mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'Merck',
    activeIngredient: 'Bisoprolol Fumarate',
  },
  {
    id: 'MI-032',
    name: 'Cavigen Capsules',
    nameAr: 'كافيجين كبسول',
    barcode: '6281001000325',
    price: 45.00,
    costPrice: 35.00,
    strength: '',
    dosageForm: 'Capsule',
    packSize: '30 Capsules',
    packQty: 30,
    company: 'Eva Pharma',
    activeIngredient: 'Herbal Supplement',
  },
  {
    id: 'MI-033',
    name: 'Floxamo 1g Tablet',
    nameAr: 'فلوكسامو 1 جم أقراص',
    barcode: '6281001000332',
    price: 36.00,
    costPrice: 28.00,
    strength: '1000mg',
    dosageForm: 'Tablet',
    packSize: '16 Tablets',
    packQty: 16,
    company: 'Amoun',
    activeIngredient: 'Amoxicillin + Flucloxacillin',
  },
  {
    id: 'MI-DEMO-01',
    name: 'جليماكس 5 مجم اقراص - العربية',
    nameAr: 'جليماكس 5 مجم أقراص - الشركة العربية',
    barcode: '6281001000901',
    price: 3065.00,
    costPrice: 2450.00,
    strength: '5mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'العربية',
    activeIngredient: 'Glimepiride',
  },
  {
    id: 'MI-DEMO-02',
    name: 'ريدوكسون فوار - ناتكو',
    nameAr: 'ريدوكسون فوار فيتامين سي ناتكو',
    barcode: '6281001000902',
    price: 2580.00,
    costPrice: 2060.00,
    strength: '1000mg',
    dosageForm: 'Effervescent',
    packSize: '15 Tablets',
    packQty: 15,
    company: 'ناتكو',
    activeIngredient: 'Vitamin C + Zinc',
  },
  {
    id: 'MI-DEMO-03',
    name: 'سيرولان اقراص 5 ملجم',
    nameAr: 'سيرولان أقراص 5 مجم',
    barcode: '6281001000903',
    price: 1850.00,
    costPrice: 1480.00,
    strength: '5mg',
    dosageForm: 'Tablet',
    packSize: '30 Tablets',
    packQty: 30,
    company: 'سيرولان',
    activeIngredient: 'Amlodipine',
  },
  {
    id: 'MI-PY-01',
    name: 'ريدوكسون فوار تاتكو',
    nameAr: 'ريدوكسون فوار تاتكو',
    barcode: '628100000001',
    price: 2580.00,
    costPrice: 2060.00,
    strength: '1000mg',
    dosageForm: 'Effervescent',
    packSize: '15 Tablets',
    packQty: 15,
    company: 'تاتكو',
    activeIngredient: 'Vitamin C',
  },
  {
    id: 'MI-PY-02',
    name: 'سبروسان اقراص 500مجم سباء',
    nameAr: 'سبروسان أقراص 500 مجم سباء',
    barcode: '628100000002',
    price: 1850.00,
    costPrice: 1480.00,
    strength: '500mg',
    dosageForm: 'Tablet',
    packSize: '10 Tablets',
    packQty: 10,
    company: 'سباء',
    activeIngredient: 'Ciprofloxacin',
  },
  {
    id: 'MI-PY-03',
    name: 'بانادول كولد اند فلو الاخضر المنصوب',
    nameAr: 'بانادول كولد اند فلو الأخضر المنصوب',
    barcode: '628100000003',
    price: 1565.00,
    costPrice: 1250.00,
    strength: '500mg',
    dosageForm: 'Tablet',
    packSize: '24 Tablets',
    packQty: 24,
    company: 'المنصوب',
    activeIngredient: 'Paracetamol + Pseudoephedrine',
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  pharmacyName: 'صيدلية سماء الميدان',
  managerName: 'د. صيدلي مسؤول',
  license: 'PH-SA-88492',
  address: 'شارع الميدان العام',
  phone: '0500000000',
  currency: 'ر.س',
  highConfidenceThreshold: 85,
  reviewThreshold: 70,
  autoLearnOnManualConfirm: true,
  exportColumns: ['barcode', 'name', 'quantity', 'price'],
  defaultExportFormat: 'xlsx',
  weights: {
    coreNameWeight: 25,
    strengthWeight: 20,
    companyWeight: 15,
    formWeight: 10,
    packWeight: 5,
    barcodeWeight: 25,
  },
  googleSheetsWebAppUrl: 'https://script.google.com/macros/s/AKfycby1Utl9mcMHOjI7nQhgP1p6ALIMoBSV0GhqRn0JKNW3maGpcdBgR5caii25vIxQy5-osQ/exec',
};

class StorageService {
  public getMasterItems(): MasterItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MASTER_ITEMS);
      if (!data) {
        this.saveMasterItems(SEED_MASTER_ITEMS);
        return SEED_MASTER_ITEMS;
      }
      return JSON.parse(data);
    } catch {
      return SEED_MASTER_ITEMS;
    }
  }

  public saveMasterItems(items: MasterItem[]): void {
    localStorage.setItem(STORAGE_KEYS.MASTER_ITEMS, JSON.stringify(items));
  }

  public addMasterItems(newItems: MasterItem[], updateExisting = true): { added: number; updated: number } {
    const existing = this.getMasterItems();
    const barcodeMap = new Map(existing.map(item => [item.barcode.trim(), item]));
    const idMap = new Map(existing.map(item => [item.id, item]));

    let added = 0;
    let updated = 0;

    for (const newItem of newItems) {
      const cleanBarcode = newItem.barcode ? newItem.barcode.trim() : '';
      const existingMatch = cleanBarcode ? barcodeMap.get(cleanBarcode) : idMap.get(newItem.id);

      if (existingMatch) {
        if (updateExisting) {
          Object.assign(existingMatch, newItem, { updatedAt: new Date().toISOString() });
          updated++;
        }
      } else {
        existing.push({
          ...newItem,
          id: newItem.id || `MI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          updatedAt: new Date().toISOString(),
        });
        added++;
      }
    }

    this.saveMasterItems(existing);
    this.addAuditLog('تحديث قاعدة الأصناف', `تمت إضافة ${added} صنف جديد، وتحديث ${updated} صنف`);
    return { added, updated };
  }

  /**
   * Google Sheets Web App Synchronization
   */
  public getGoogleSheetsUrl(): string {
    const settings = this.getSettings();
    return settings.googleSheetsWebAppUrl || DEFAULT_SETTINGS.googleSheetsWebAppUrl || '';
  }

  /**
   * Fetch all persistent mappings and prices from Google Sheets
   */
  public async fetchFromGoogleSheets(): Promise<{
    success: boolean;
    mappingsCount?: number;
    pricesCount?: number;
    error?: string;
  }> {
    const url = this.getGoogleSheetsUrl();
    if (!url) {
      return { success: false, error: 'رابط Google Sheets Web App غير مهيأ' };
    }

    try {
      const response = await fetch(`${url}?action=getAll`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`استجابة غير صحيحة من Google Sheets: ${response.status}`);
      }

      const data = await response.json();
      if (!data || !data.success) {
        throw new Error(data?.error || 'فشل جلب البيانات من Google Sheets');
      }

      let mappingsCount = 0;
      if (Array.isArray(data.mappings) && data.mappings.length > 0) {
        const currentLocal = this.getConfirmedMappings();
        const mapByClean = new Map(currentLocal.map(m => [m.supplierNameCleaned, m]));

        for (const sheetRow of data.mappings) {
          const source = (sheetRow.source || sheetRow[0] || '').toString().trim();
          const target = (sheetRow.target || sheetRow[1] || '').toString().trim();
          const confidence = parseFloat(sheetRow.confidence || sheetRow[2]) || 100;
          const barcode = (sheetRow.barcode || sheetRow[3] || '').toString().trim();
          const masterId = (sheetRow.masterId || sheetRow[4] || '').toString().trim();

          if (source && target) {
            const cleanKey = source.toLowerCase();
            const existing = mapByClean.get(cleanKey);
            if (!existing) {
              mapByClean.set(cleanKey, {
                id: `MAP-GS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                supplierNameOriginal: source,
                supplierNameCleaned: cleanKey,
                masterItemId: masterId || `MI-${cleanKey}`,
                masterItemName: target,
                officialBarcode: barcode,
                confidenceScore: confidence,
                confirmedAt: new Date().toISOString(),
                timesUsed: 1,
              });
              mappingsCount++;
            }
          }
        }

        const merged = Array.from(mapByClean.values());
        localStorage.setItem(STORAGE_KEYS.CONFIRMED_MAPPINGS, JSON.stringify(merged));
      }

      this.saveSettings({ lastSheetsSync: new Date().toISOString() });
      this.addAuditLog('مزامنة Google Sheets', `تم جلب ${mappingsCount} مطابقة جديدة من قاعدة Google Sheets`);

      return {
        success: true,
        mappingsCount,
        pricesCount: Array.isArray(data.prices) ? data.prices.length : 0,
      };
    } catch (err: any) {
      console.warn('Google Sheets fetch warning, relying on local storage backup:', err);
      return { success: false, error: err.message || 'تعذر الاتصال بـ Google Sheets' };
    }
  }

  /**
   * Append a confirmed mapping to Google Sheets
   */
  public async appendMappingToGoogleSheets(mapping: ConfirmedMapping): Promise<boolean> {
    const url = this.getGoogleSheetsUrl();
    if (!url) return false;

    try {
      const payload = {
        action: 'addMapping',
        sheet: 'المطابقات',
        data: {
          source: mapping.supplierNameOriginal,
          target: mapping.masterItemName,
          confidence: mapping.confidenceScore || 100,
          barcode: mapping.officialBarcode || '',
          masterId: mapping.masterItemId || '',
          timestamp: new Date().toISOString(),
        },
      };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      return true;
    } catch (err) {
      console.warn('Failed to append mapping to Google Sheets:', err);
      return false;
    }
  }

  /**
   * Append price records to Google Sheets
   */
  public async appendPricesToGoogleSheets(
    supplierName: string,
    prices: Array<{ itemName: string; price: number; date?: string; barcode?: string }>
  ): Promise<boolean> {
    const url = this.getGoogleSheetsUrl();
    if (!url || prices.length === 0) return false;

    try {
      const payload = {
        action: 'addPrices',
        sheet: 'الأسعار',
        supplier: supplierName,
        data: prices.map(p => ({
          item: p.itemName,
          supplier: supplierName,
          price: p.price,
          barcode: p.barcode || '',
          date: p.date || new Date().toISOString().slice(0, 10),
        })),
      };

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
      });

      return true;
    } catch (err) {
      console.warn('Failed to append prices to Google Sheets:', err);
      return false;
    }
  }

  public getConfirmedMappings(): ConfirmedMapping[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIRMED_MAPPINGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveConfirmedMapping(mapping: Omit<ConfirmedMapping, 'id' | 'confirmedAt' | 'timesUsed'>): ConfirmedMapping {
    const mappings = this.getConfirmedMappings();
    const existingIndex = mappings.findIndex(m => m.supplierNameCleaned === mapping.supplierNameCleaned);

    const now = new Date().toISOString();
    let saved: ConfirmedMapping;

    if (existingIndex >= 0) {
      saved = {
        ...mappings[existingIndex],
        ...mapping,
        timesUsed: (mappings[existingIndex].timesUsed || 1) + 1,
        lastUsedAt: now,
      };
      mappings[existingIndex] = saved;
    } else {
      saved = {
        ...mapping,
        id: `MAP-${Date.now()}`,
        confirmedAt: now,
        timesUsed: 1,
      };
      mappings.push(saved);
    }

    localStorage.setItem(STORAGE_KEYS.CONFIRMED_MAPPINGS, JSON.stringify(mappings));
    this.addAuditLog('حفظ مطابقة مؤكدة', `ربط: "${mapping.supplierNameOriginal}" مع "${mapping.masterItemName}"`);

    // Asynchronously push to persistent Google Sheets database
    this.appendMappingToGoogleSheets(saved);

    return saved;
  }

  public deleteConfirmedMapping(id: string): void {
    const mappings = this.getConfirmedMappings().filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.CONFIRMED_MAPPINGS, JSON.stringify(mappings));
    this.addAuditLog('حذف مطابقة معتمدة', `تم حذف المعرف: ${id}`);
  }

  public getStoredInvoices(): StoredInvoice[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STORED_INVOICES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveInvoice(invoice: StoredInvoice): void {
    const invoices = this.getStoredInvoices();
    const idx = invoices.findIndex(i => i.header.id === invoice.header.id);
    if (idx >= 0) {
      invoices[idx] = invoice;
    } else {
      invoices.unshift(invoice);
    }
    localStorage.setItem(STORAGE_KEYS.STORED_INVOICES, JSON.stringify(invoices));
    this.addAuditLog('حفظ فاتورة مورد', `فاتورة رقم ${invoice.header.invoiceNumber || invoice.header.id} من مورد ${invoice.header.supplierName}`);

    // Automatically append prices to Google Sheets in sheet 'الأسعار'
    const pricesList: Array<{ itemName: string; price: number; barcode?: string; date?: string }> = [];
    invoice.matchResults.forEach(r => {
      const name = r.matchedItem?.name || r.invoiceLine.rawSupplierName;
      if (r.invoiceLine.unitPrice > 0 && name) {
        pricesList.push({
          itemName: name,
          price: r.invoiceLine.unitPrice,
          barcode: r.matchedItem?.barcode || r.invoiceLine.supplierBarcode,
          date: invoice.header.invoiceDate,
        });
      }
    });

    if (pricesList.length > 0) {
      this.appendPricesToGoogleSheets(invoice.header.supplierName, pricesList);
    }
  }

  public deleteStoredInvoice(id: string): void {
    const invoices = this.getStoredInvoices().filter(i => i.header.id !== id);
    localStorage.setItem(STORAGE_KEYS.STORED_INVOICES, JSON.stringify(invoices));
    this.addAuditLog('حذف فاتورة', `حذف الفاتورة رقم ${id}`);
  }

  public getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  public getAuditLog(): AuditLogEntry[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AUDIT_LOG);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public addAuditLog(action: string, details: string, user = 'صيدلي النظام'): void {
    const logs = this.getAuditLog();
    logs.unshift({
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      action,
      details,
      user,
    });
    // Keep last 500 records
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(logs.slice(0, 500)));
  }

  /**
   * Export full system snapshot as downloadable JSON object (Full Export / التصدير الشامل)
   */
  public createFullBackup(): string {
    const supplierPrices: Array<{ item: string; supplier: string; price: number; date: string; barcode?: string }> = [];
    this.getStoredInvoices().forEach(inv => {
      inv.matchResults.forEach(r => {
        if (r.matchedItem && r.invoiceLine.unitPrice > 0) {
          supplierPrices.push({
            item: r.matchedItem.name,
            supplier: inv.header.supplierName,
            price: r.invoiceLine.unitPrice,
            date: inv.header.invoiceDate,
            barcode: r.matchedItem.barcode,
          });
        }
      });
    });

    const backup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      masterItems: this.getMasterItems(),
      confirmedMappings: this.getConfirmedMappings(),
      storedInvoices: this.getStoredInvoices(),
      settings: this.getSettings(),
      auditLog: this.getAuditLog(),
      supplierPrices,
    };
    return JSON.stringify(backup, null, 2);
  }

  /**
   * Restore full system snapshot (Full Import / الاستيراد الشامل)
   */
  public restoreFullBackup(jsonString: string): { success: boolean; message: string } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !Array.isArray(data.masterItems)) {
        return { success: false, message: 'ملف النسخة الاحتياطية غير صالح أو تالف' };
      }

      this.saveMasterItems(data.masterItems);
      if (Array.isArray(data.confirmedMappings)) {
        localStorage.setItem(STORAGE_KEYS.CONFIRMED_MAPPINGS, JSON.stringify(data.confirmedMappings));
        // Also sync all restored mappings to Google Sheets in the background
        data.confirmedMappings.forEach((m: ConfirmedMapping) => this.appendMappingToGoogleSheets(m));
      }
      if (Array.isArray(data.storedInvoices)) {
        localStorage.setItem(STORAGE_KEYS.STORED_INVOICES, JSON.stringify(data.storedInvoices));
      }
      if (data.settings) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
      if (Array.isArray(data.auditLog)) {
        localStorage.setItem(STORAGE_KEYS.AUDIT_LOG, JSON.stringify(data.auditLog));
      }

      this.addAuditLog('استعادة نسخة احتياطية شاملة', `تم استعادة ${data.masterItems.length} صنف رسمي و${(data.confirmedMappings || []).length} مطابقة معتمدة بنجاح`);
      return { success: true, message: `تمت استعادة كافة البيانات بنجاح (${data.masterItems.length} صنف، ${(data.confirmedMappings || []).length} مطابقة معتمدة، ${(data.storedInvoices || []).length} فاتورة)` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطأ أثناء فك تشفير النسخة الاحتياطية';
      return { success: false, message: msg };
    }
  }
}

export const storage = new StorageService();    



