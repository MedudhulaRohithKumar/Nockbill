import React, { useState, useEffect } from 'react';
import { Plus, Wallet, Trash2, X, IndianRupee, TrendingDown } from 'lucide-react';
import { expensesApi } from '../api';
import { Expense } from '../types';
import { safeNumber, formatCurrency } from '../utils/formatters';

const CATEGORY_COLORS: Record<string, string> = {
  Transport: 'bg-blue-100 text-blue-800',
  Labor: 'bg-purple-100 text-purple-800',
  Rent: 'bg-amber-100 text-amber-800',
  Electricity: 'bg-yellow-100 text-yellow-800',
  Packaging: 'bg-teal-100 text-teal-800',
  Office: 'bg-indigo-100 text-indigo-800',
  Misc: 'bg-slate-100 text-slate-700',
};

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [category, setCategory] = useState<'Rent' | 'Electricity' | 'Transport' | 'Labor' | 'Packaging' | 'Office' | 'Misc'>('Transport');
  const [amount, setAmount] = useState<number>(1200);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('Fertilizer unloading labor charges at godown');
  const [paymentMode, setPaymentMode] = useState('Cash');

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const data = await expensesApi.getAll();
      setExpenses(data);
    } catch {
      setExpenses([
        { id: 1, category: 'Transport', amount: 4500, expense_date: '2024-08-16', description: 'Freight charges for 200 bags DAP transport from railway siding', payment_mode: 'Cash' },
        { id: 2, category: 'Labor', amount: 2400, expense_date: '2024-08-17', description: 'Loading & stacking labor for godown', payment_mode: 'Cash' },
        { id: 3, category: 'Electricity', amount: 3200, expense_date: '2024-08-20', description: 'APMC Godown electricity bill', payment_mode: 'UPI' },
        { id: 4, category: 'Rent', amount: 8000, expense_date: '2024-08-01', description: 'Monthly shop & warehouse rent', payment_mode: 'Bank Transfer' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadExpenses(); }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Expense> = { category, amount, expense_date: expenseDate, description, payment_mode: paymentMode };
    try {
      await expensesApi.create(payload);
      setIsModalOpen(false);
      loadExpenses();
    } catch {
      setExpenses([{ id: Date.now(), ...payload } as Expense, ...expenses]);
      setIsModalOpen(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    try {
      await expensesApi.delete(id);
      setExpenses(expenses.filter(e => e.id !== id));
    } catch {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + safeNumber(e.amount), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Shop Expenses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Transport, labor, rent, electricity &amp; more
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-brand-700 hover:bg-brand-600 text-white font-bold py-3 sm:py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Expenses</p>
          <p className="text-xl sm:text-2xl font-black text-red-600 mt-1">₹{formatCurrency(totalExpense)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{expenses.length} entries recorded</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="p-2 bg-red-50 text-red-600 rounded-xl w-fit mb-1">
            <TrendingDown className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Biggest</p>
          <p className="font-black text-slate-800 text-sm mt-0.5">
            ₹{formatCurrency(Math.max(...expenses.map(e => e.amount), 0))}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="p-2 bg-brand-50 text-brand-700 rounded-xl w-fit mb-1">
            <IndianRupee className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Avg/Entry</p>
          <p className="font-black text-slate-800 text-sm mt-0.5">
            ₹{formatCurrency(expenses.length ? totalExpense / expenses.length : 0)}
          </p>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand-700" />
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">Expenses Ledger</h3>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-xs">Loading...</div>
        ) : expenses.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">No expenses recorded yet.</div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="md:hidden divide-y divide-slate-100">
              {expenses.map((item: any) => {
                const catClass = CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-700';
                return (
                  <div key={item.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase ${catClass}`}>
                            {item.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.expense_date}</span>
                        </div>
                        <p className="font-semibold text-xs text-slate-800 mt-1 leading-snug">
                          {item.description || item.expense_name || 'Expense'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.payment_mode || 'Cash'}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-2">
                        <span className="font-black text-base text-red-600">-₹{formatCurrency(item.amount)}</span>
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3">Payment Mode</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((item: any) => {
                    const catClass = CATEGORY_COLORS[item.category] || 'bg-slate-100 text-slate-700';
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-600 font-mono">{item.expense_date}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${catClass}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-800 font-medium">{item.description || item.expense_name}</td>
                        <td className="py-3 px-3 text-slate-600">{item.payment_mode || 'Cash'}</td>
                        <td className="py-3 px-4 text-right font-black text-red-600">
                          -₹{formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeleteExpense(item.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-brand-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Expense Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-brand-200 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                >
                  <option value="Transport">Transport / Freight</option>
                  <option value="Labor">Labor / Handling</option>
                  <option value="Rent">Shop / Godown Rent</option>
                  <option value="Electricity">Electricity / Power</option>
                  <option value="Packaging">Packaging Material</option>
                  <option value="Office">Office &amp; Stationary</option>
                  <option value="Misc">Miscellaneous</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Note *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Unloading 100 bags from truck"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none text-sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-brand-700 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold shadow transition-all text-sm"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
