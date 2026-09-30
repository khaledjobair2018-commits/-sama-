import React from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Database,
  BookOpen,
  History,
  HardDriveDownload,
  Settings,
  FlaskConical,
  TrendingDown,
  PlusCircle,
  Cpu,
  Printer,
  ShoppingBag,
} from 'lucide-react';
import { MatchResult } from '../types/pharmacy';

export type ActiveTab =
  | 'matching'
  | 'new_invoice'
  | 'review'
  | 'match_engine_test'
  | 'price_report'
  | 'purchasing_guide'
  | 'master_db'
  | 'mappings'
  | 'history'
  | 'backup'
  | 'tests'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  results: MatchResult[];
  pharmacyName: string;
  invoiceSupplier?: string;
  invoiceNumber?: string;
  onOpenPrintReport?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  results,
  pharmacyName,
  invoiceSupplier,
  invoiceNumber,
  onOpenPrintReport,
}) => {
  const reviewCount = results.filter(r => r.status === 'REVIEW_REQUIRED').length;
  const unmatchedCount = results.filter(r => r.status === 'UNMATCHED').length;

  const navItems = [
    {
      id: 'matching' as ActiveTab,
      label: 'مطابقة الفاتورة',
      icon: FileSpreadsheet,
      badge: results.length > 0 ? results.length : undefined,
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'review' as ActiveTab,
      label: 'شاشة المراجعة',
      icon: AlertTriangle,
      badge: reviewCount > 0 ? reviewCount : undefined,
      badgeColor: 'bg-amber-600 animate-pulse',
    },
    {
      id: 'match_engine_test' as ActiveTab,
      label: 'MATCH ENGINE TEST',
      icon: Cpu,
      badge: 'جديد',
      badgeColor: 'bg-emerald-600 font-mono',
    },
    {
      id: 'price_report' as ActiveTab,
      label: 'تقرير الأسعار',
      icon: TrendingDown,
    },
    {
      id: 'purchasing_guide' as ActiveTab,
      label: 'دليل المشتريات الذكي',
      icon: ShoppingBag,
      badge: 'وفورات',
      badgeColor: 'bg-emerald-600',
    },
    {
      id: 'new_invoice' as ActiveTab,
      label: 'فاتورة جديدة',
      icon: PlusCircle,
    },
    {
      id: 'master_db' as ActiveTab,
      label: 'قاعدة الأصناف الرسمية',
      icon: Database,
    },
    {
      id: 'mappings' as ActiveTab,
      label: 'قاموس المطابقات',
      icon: BookOpen,
    },
    {
      id: 'history' as ActiveTab,
      label: 'الفواتير والسجل',
      icon: History,
    },
    {
      id: 'tests' as ActiveTab,
      label: 'الاختبارات الآلية',
      icon: FlaskConical,
    },
    {
      id: 'backup' as ActiveTab,
      label: 'النسخ الاحتياطي',
      icon: HardDriveDownload,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'الإعدادات',
      icon: Settings,
    },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-slate-800">
      {/* Top Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 border-b border-slate-800/80">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-black text-white">Rx</span>
            </div>
            <div>
              <div className="flex items-center space-x-2 space-x-reverse">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  نظام مطابقة وإدخال فواتير الأدوية
                </h1>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-medium border border-emerald-500/30">
                  محلي 100% بدون إنترنت
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">{pharmacyName}</p>
            </div>
          </div>

          {/* Current Active Invoice Info Pill & Print Button */}
          {invoiceSupplier ? (
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="flex items-center space-x-3 space-x-reverse bg-slate-800/90 px-3.5 py-1.5 rounded-lg border border-slate-700/80 text-xs">
                <div className="flex items-center text-slate-300">
                  <span className="text-slate-400 ml-1">المورد:</span>
                  <span className="font-semibold text-emerald-400">{invoiceSupplier}</span>
                </div>
                {invoiceNumber && (
                  <div className="text-slate-300 border-r border-slate-700 pr-3">
                    <span className="text-slate-400 ml-1">رقم الفاتورة:</span>
                    <span className="font-mono text-slate-200">{invoiceNumber}</span>
                  </div>
                )}
                <div className="border-r border-slate-700 pr-3 flex items-center space-x-1.5 space-x-reverse">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-medium">{results.length} سطر</span>
                </div>
              </div>

              {onOpenPrintReport && (
                <button
                  onClick={onOpenPrintReport}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1 space-x-reverse shadow-xs cursor-pointer"
                  title="عرض وطباعة تقرير الفحص والمطابقة مع كود QR"
                >
                  <Printer className="w-3.5 h-3.5 ml-1" />
                  <span className="hidden sm:inline">طباعة التقرير (QR)</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('new_invoice')}
              className="flex items-center space-x-2 space-x-reverse bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg font-medium text-xs transition shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إدخال فاتورة جديدة</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 space-x-reverse overflow-x-auto py-2 scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 space-x-reverse px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`mr-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white ${
                      item.badgeColor || 'bg-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
