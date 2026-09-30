import { MatchResult, MasterItem, StoredInvoice } from '../types/pharmacy';

export interface PriceVarianceRow {
  rowNumber: number;
  itemName: string;
  barcode: string;
  supplierRawName: string;
  quantity: number;
  bonusQuantity: number;
  oldPrice: number; // Reference purchase price in system
  newPrice: number; // Supplier invoice price
  effectiveNewPrice: number; // True cost after bonus: (totalPaid / (quantity + bonus))
  difference: number; // newPrice - oldPrice
  effectiveDifference: number; // effectiveNewPrice - oldPrice
  changePercentage: number;
  totalRowLossOrGain: number; // difference * quantity
  isPriceIncreased: boolean;
  isPriceDecreased: boolean;
  cheapestHistoricalSupplier?: {
    supplierName: string;
    lowestPrice: number;
    difference: number; // newPrice - lowestPrice
    alertMessage: string;
  };
}

export interface PurchasingAnalysisSummary {
  totalInvoiceAmount: number;
  totalReferenceAmount: number;
  netFinancialDifference: number; // positive = extra cost/loss, negative = savings
  totalPriceIncreaseLoss: number; // sum of price increases
  totalPriceDecreaseSavings: number; // sum of price drops
  increasedItemsCount: number;
  decreasedItemsCount: number;
  stableItemsCount: number;
  totalBonusUnits: number;
  totalBonusFinancialValue: number;
  avgExpectedMarginPercentage: number;
  cheapestSupplierOpportunities: Array<{
    itemName: string;
    currentSupplier: string;
    currentPrice: number;
    cheapestSupplier: string;
    cheapestPrice: number;
    savingPerUnit: number;
    totalPotentialSaving: number;
    alertMessage: string;
  }>;
  financialAdvice: string[];
}

export class PurchasingAdvisor {
  /**
   * Analyzes an invoice against reference database and historical invoices
   */
  public analyzeInvoice(
    results: MatchResult[],
    currentSupplier: string,
    masterItems: MasterItem[],
    pastInvoices: StoredInvoice[] = []
  ): {
    rows: PriceVarianceRow[];
    summary: PurchasingAnalysisSummary;
  } {
    // Build historical price map per masterItemId or barcode
    // itemIdentifier -> { supplierName, price, date }
    const historicalPriceMap = new Map<string, Array<{ supplier: string; price: number; date: string }>>();

    pastInvoices.forEach(inv => {
      const sup = inv.header.supplierName;
      inv.matchResults.forEach(r => {
        const id = r.matchedItem?.id || r.matchedItem?.barcode;
        if (id && r.invoiceLine.unitPrice > 0) {
          const list = historicalPriceMap.get(id) || [];
          list.push({
            supplier: sup,
            price: r.invoiceLine.unitPrice,
            date: inv.header.invoiceDate,
          });
          historicalPriceMap.set(id, list);
        }
      });
    });

    const rows: PriceVarianceRow[] = [];
    let totalPriceIncreaseLoss = 0;
    let totalPriceDecreaseSavings = 0;
    let totalInvoiceAmount = 0;
    let totalReferenceAmount = 0;
    let increasedCount = 0;
    let decreasedCount = 0;
    let stableCount = 0;
    let totalBonusUnits = 0;
    let totalBonusFinancialValue = 0;

    const opportunities: PurchasingAnalysisSummary['cheapestSupplierOpportunities'] = [];

    results.forEach(res => {
      const line = res.invoiceLine;
      const matched = res.matchedItem;
      const qty = line.quantity || 1;
      const bonus = line.bonusQuantity || 0;
      const newPrice = line.unitPrice || 0;
      const totalPaid = line.totalPrice || (qty * newPrice);

      totalInvoiceAmount += totalPaid;
      totalBonusUnits += bonus;

      // 1. Reference / Old Price (costPrice or selling price * 0.75 fallback)
      const oldPrice = matched ? (matched.costPrice || matched.price * 0.8) : newPrice;
      const totalRef = oldPrice * qty;
      totalReferenceAmount += totalRef;

      // 2. Bonus True Cost Calculation:
      // (إجمالي المبلغ المدفوع ÷ (الكمية المشتراة + الكمية المجانية))
      const totalPhysicalUnits = qty + bonus;
      const effectiveNewPrice = totalPhysicalUnits > 0
        ? Math.round((totalPaid / totalPhysicalUnits) * 100) / 100
        : newPrice;

      if (bonus > 0) {
        totalBonusFinancialValue += bonus * newPrice;
      }

      // 3. Price Difference
      const difference = Math.round((newPrice - oldPrice) * 100) / 100;
      const effectiveDifference = Math.round((effectiveNewPrice - oldPrice) * 100) / 100;
      const changePercentage = oldPrice > 0 ? Math.round(((newPrice - oldPrice) / oldPrice) * 1000) / 10 : 0;
      const totalRowLossOrGain = Math.round(difference * qty * 100) / 100;

      const isPriceIncreased = difference > 0.05;
      const isPriceDecreased = difference < -0.05;

      if (isPriceIncreased) {
        increasedCount++;
        totalPriceIncreaseLoss += totalRowLossOrGain;
      } else if (isPriceDecreased) {
        decreasedCount++;
        totalPriceDecreaseSavings += Math.abs(totalRowLossOrGain);
      } else {
        stableCount++;
      }

      // 4. Cheapest Historical Supplier Analysis
      let cheapestAlert: PriceVarianceRow['cheapestHistoricalSupplier'];
      if (matched) {
        const historyList = historicalPriceMap.get(matched.id) || historicalPriceMap.get(matched.barcode) || [];
        // Filter different suppliers who sold at lower price
        const cheaperOptions = historyList
          .filter(h => h.supplier !== currentSupplier && h.price < newPrice)
          .sort((a, b) => a.price - b.price);

        if (cheaperOptions.length > 0) {
          const cheapest = cheaperOptions[0];
          const diff = Math.round((newPrice - cheapest.price) * 100) / 100;
          const savingTotal = Math.round(diff * qty * 100) / 100;

          const alertMessage = `تنبيه: يمكن شراء الصنف [${matched.name}] بسعر أقل قدره [${cheapest.price.toFixed(2)}] من المورد [${cheapest.supplier}].`;

          cheapestAlert = {
            supplierName: cheapest.supplier,
            lowestPrice: cheapest.price,
            difference: diff,
            alertMessage,
          };

          opportunities.push({
            itemName: matched.name,
            currentSupplier,
            currentPrice: newPrice,
            cheapestSupplier: cheapest.supplier,
            cheapestPrice: cheapest.price,
            savingPerUnit: diff,
            totalPotentialSaving: savingTotal,
            alertMessage,
          });
        }
      }

      rows.push({
        rowNumber: res.rowNumber,
        itemName: matched ? matched.name : `[غير مطابق] ${line.rawSupplierName}`,
        barcode: matched ? matched.barcode : (line.supplierBarcode || '—'),
        supplierRawName: line.rawSupplierName,
        quantity: qty,
        bonusQuantity: bonus,
        oldPrice: Math.round(oldPrice * 100) / 100,
        newPrice: Math.round(newPrice * 100) / 100,
        effectiveNewPrice,
        difference,
        effectiveDifference,
        changePercentage,
        totalRowLossOrGain,
        isPriceIncreased,
        isPriceDecreased,
        cheapestHistoricalSupplier: cheapestAlert,
      });
    });

    const netFinancialDifference = Math.round((totalInvoiceAmount - totalReferenceAmount) * 100) / 100;

    // Expected profit margin calculation based on master selling prices
    const totalSellingValue = results.reduce((acc, r) => {
      const sellPrice = r.matchedItem?.price || (r.invoiceLine.unitPrice * 1.25);
      return acc + (sellPrice * (r.invoiceLine.quantity || 1));
    }, 0);

    const avgExpectedMarginPercentage = totalSellingValue > 0
      ? Math.round(((totalSellingValue - totalInvoiceAmount) / totalSellingValue) * 1000) / 10
      : 22.5;

    // Generate actionable purchasing advice
    const financialAdvice: string[] = [];

    if (opportunities.length > 0) {
      const totalPotentialLoss = opportunities.reduce((acc, o) => acc + o.totalPotentialSaving, 0);
      financialAdvice.push(
        `توجد ${opportunities.length} أصناف في هذه الفاتورة يمكن شراؤها بأسعار أرخص من موردين مسجلين سابقاً، مما قد يوفر سيولة قدرها ${totalPotentialLoss.toFixed(2)}.`
      );
    }

    if (totalBonusUnits > 0) {
      financialAdvice.push(
        `تم الاستفادة من ${totalBonusUnits} قطعة بونص مجانية بقيمة وفر شرائي ${totalBonusFinancialValue.toFixed(2)}. ساهم ذلك في خفض تكلفة الوحدة الفعلية.`
      );
    }

    if (increasedCount > 0) {
      financialAdvice.push(
        `هناك ${increasedCount} أصناف شهدت ارتفاعاً في سعر الشراء بإجمالي تكلفة إضافية قدرها ${totalPriceIncreaseLoss.toFixed(2)}. يُنصح بالتفاوض مع المورد أو مراجعة هامش البيع للجمهور.`
      );
    }

    if (decreasedCount > 0) {
      financialAdvice.push(
        `تم تحقيق وفر فوري قدره ${totalPriceDecreaseSavings.toFixed(2)} في ${decreasedCount} أصناف بفضل أسعار شراء مخفضة عن المرجع.`
      );
    }

    financialAdvice.push(
      'توصية السيولة: جدولة سداد الفاتورة وفق فترات التحصيل لضمان تدوير رأس المال، وتفضيل شراء الأصناف ذات التدوير السريع مع كميات بونص أعلى.'
    );

    return {
      rows,
      summary: {
        totalInvoiceAmount: Math.round(totalInvoiceAmount * 100) / 100,
        totalReferenceAmount: Math.round(totalReferenceAmount * 100) / 100,
        netFinancialDifference,
        totalPriceIncreaseLoss: Math.round(totalPriceIncreaseLoss * 100) / 100,
        totalPriceDecreaseSavings: Math.round(totalPriceDecreaseSavings * 100) / 100,
        increasedItemsCount: increasedCount,
        decreasedItemsCount: decreasedCount,
        stableItemsCount: stableCount,
        totalBonusUnits,
        totalBonusFinancialValue: Math.round(totalBonusFinancialValue * 100) / 100,
        avgExpectedMarginPercentage,
        cheapestSupplierOpportunities: opportunities,
        financialAdvice,
      },
    };
  }
}

export const purchasingAdvisor = new PurchasingAdvisor();
