import React, { useState, useEffect } from 'react';
import { Plus, Wallet, Trash2, Calendar, IndianRupee, Tag, X } from 'lucide-react';
import { expensesApi } from '../api';
import { Expense } from '../types';
import { safeNumber, safeString, formatCurrency } from '../utils/formatters';


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
      // Demo fallback
      setExpenses([
        {
          id: 1,
          category: 'Transport',
          amount: 4500,
          expense_date: '2024-08-16',
          description: 'Freight charges for 200 bags DAP transport from railway siding',
          payment_mode: 'Cash'
        },
        {
          id: 2,
          category: 'Labor',
          amount: 2400,
          expense_date: '2024-08-17',
          description: 'Loading & stacking labor for godown',
          payment_mode: 'Cash'
        },
        {
          id: 3,
          category: 'Electricity',
          amount: 3200,
          expense_date: '2024-08-20',
          description: 'APMC Godown electricity bill',
          payment_mode: 'UPI'
        },
        {
          id: 4,
          category: 'Rent',
          amount: 8000,
          expense_date: '2024-08-01',
          description: 'Monthly shop & warehouse rent',
          payment_mode: 'Bank Transfer'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Expense> = {
      category,
      amount,
      expense_date: expenseDate,
      description,
      payment_mode: paymentMode,
    };

    try {
      await expensesApi.create(payload);
      setIsModalOpen(false);
      loadExpenses();
    } catch {
      // Local fallback
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Shop Operational Expenses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track transport freight, labor handling, shop rent, and power bills for accurate P&L
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-700 hover:bg-brand-600 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-xs shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Expense</span>
        </button>
      </div>

      {/* Summary Stat Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Recorded Expenses</p>
          <p className="text-2xl font-black text-slate-900 mt-1">₹{formatCurrency(totalExpense)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{expenses.length} transaction entries</p>
        </div>
      </div>


      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-brand-700" />
            Expenses Ledger
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Payment Mode</th>
                <th className="py-3 px-4 text-right">Amount (₹)</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((item: any) => {
                const expDesc = item.description || item.expense_name || 'Expense item';
                const payMode = item.payment_mode || 'Cash';
                const expAmt = safeNumber(item.amount);

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600 font-mono">
                      {item.expense_date}
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-800 font-medium">
                      {expDesc}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {payMode}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-red-600">
                      -₹{formatCurrency(expAmt)}
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
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 bg-brand-800 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Add Expense Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-brand-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Transport">Transport / Freight</option>
                  <option value="Labor">Labor / Handling</option>
                  <option value="Rent">Shop / Godown Rent</option>
                  <option value="Electricity">Electricity / Power</option>
                  <option value="Packaging">Packaging Material</option>
                  <option value="Office">Office & Stationary</option>
                  <option value="Misc">Miscellaneous</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 font-black text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Note *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Unloading 100 bags from truck"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brand-700 hover:bg-brand-600 text-white px-5 py-2 rounded-xl font-bold shadow transition-all"
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
