import React from 'react';
import { Trash2 } from 'lucide-react';
import { getItemFullDescription } from '../../lib/utils';
import type { Cart } from './useCart';

/** Cart lines with an editable VAT-inclusive price per item. */
export const CartTable: React.FC<{ cart: Cart }> = ({ cart }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase font-extrabold pb-3 font-bold">
          <th className="pb-3 pr-2">Article / Barcode</th>
          <th className="pb-3 px-2 text-center text-xs">Poids</th>
          <th className="pb-3 px-2 text-right text-xs">Prix TTC (Rs)</th>
          <th className="pb-3 pl-2 text-center text-xs">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {cart.items.map((item, idx) => (
          <tr key={item.id} className="text-sm">
            <td className="py-4 pr-2 font-bold text-slate-900">
              <div>{getItemFullDescription(item.stockItem)}</div>
              <div className="text-xs text-slate-400 font-mono">{item.barcode}</div>
            </td>
            <td className="py-4 px-2 text-center font-bold text-amber-600 italic">
              {item.stockItem.category === 'Jewellery' && item.stockItem.weightGrams ? `${item.stockItem.weightGrams}g` : '-'}
            </td>
            <td className="py-4 px-2 text-right">
              <input
                type="number"
                step="0.01"
                min="0"
                aria-label={`Prix TTC de ${item.barcode}`}
                aria-invalid={!!cart.lines[idx]?.error}
                className={`w-28 bg-slate-50 border rounded-xl py-1 px-2 font-extrabold text-right focus:border-amber-400 outline-none text-slate-900 transition-all font-mono ${
                  cart.lines[idx]?.error ? 'border-red-400' : 'border-slate-200'
                }`}
                value={item.editedInclusivePrice}
                onChange={(e) => cart.setPrice(idx, e.target.value)}
              />
            </td>
            <td className="py-4 pl-2 text-center">
              <button
                type="button"
                onClick={() => cart.remove(idx)}
                className="text-slate-400 hover:text-red-500 p-2 rounded-lg transition-colors"
                title="Supprimer du panier"
                aria-label={`Retirer ${item.barcode} du panier`}
              >
                <Trash2 size={18} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
