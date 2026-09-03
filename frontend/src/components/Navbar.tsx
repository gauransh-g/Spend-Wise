import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  ScanLine, 
  BrainCircuit, 
  Bot, 
  PlusCircle, 
  Sparkles 
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenAddModal }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'groups', label: 'Groups & Splits', icon: Users },
    { id: 'ocr', label: 'Receipt OCR', icon: ScanLine },
    { id: 'intelligence', label: 'Intelligence', icon: BrainCircuit },
    { id: 'copilot', label: 'AI Copilot', icon: Bot },
  ];

  return (
    <header className="glass-card mb-8 px-6 py-4 flex items-center justify-between border border-teal-500/20 bg-slate-950/80 sticky top-4 z-50 shadow-2xl shadow-teal-950/40">
      {/* Brand Logo */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-500 via-cyan-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/40 text-slate-950 font-extrabold text-xl">
          <Sparkles className="w-6 h-6 text-slate-950 fill-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold bg-gradient-to-r from-teal-200 via-teal-100 to-cyan-300 bg-clip-text text-transparent tracking-tight">
              SpendWise <span className="text-teal-400">2.0</span>
            </h1>
            <span className="glass-pill text-[10px] py-0.5 px-2.5 font-bold tracking-wide uppercase bg-teal-500/10 text-teal-300 border-teal-500/30">
              AI TURQUOISE
            </span>
          </div>
          <p className="text-[11px] text-teal-200/70 font-medium">Smart Financial & Social Expense Engine</p>
        </div>
      </div>

      {/* Center Tabs Navigation */}
      <nav className="hidden lg:flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-teal-500/20 shadow-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 shadow-md shadow-teal-500/30 font-extrabold'
                  : 'text-teal-100/70 hover:text-white hover:bg-teal-500/10'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-teal-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Action Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenAddModal}
          className="btn-primary shadow-lg shadow-teal-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>
    </header>
  );
};
