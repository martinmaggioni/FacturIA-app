import React, { useEffect } from 'react';
import { InvoiceData, LineItem, InvoiceType, PaymentCondition } from '../types';
import { Calendar, Clock, Edit2, Plus, Trash2 } from 'lucide-react';

interface InvoiceReviewProps {
  data: InvoiceData;
  onUpdate: (data: InvoiceData) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const InvoiceReview: React.FC<InvoiceReviewProps> = ({ data, onUpdate, onConfirm, onCancel, isLoading }) => {

  // Al montar, corregir fechas viejas y asegurar hora
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    const currentTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

    let updates: Partial<InvoiceData> = {};
    
    // LÓGICA DE CORRECCIÓN DE FECHA:
    // 1. Si no hay fecha.
    // 2. Si la fecha es del 2024 (asumimos error de IA, ya que estamos en 2025+).
    if (!data.date || data.date.startsWith('2024')) {
        updates.date = currentDate;
    }
    
    // Si no hay hora, poner la actual
    if (!data.time) {
        updates.time = currentTime;
    }

    if (Object.keys(updates).length > 0) {
        onUpdate({ ...data, ...updates });
    }
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
  };

  const calculateTotal = () => {
    return data.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  const handleDeleteItem = (index: number) => {
    const newItems = [...data.items];
    newItems.splice(index, 1);
    onUpdate({ ...data, items: newItems });
  };

  const handleAddItem = () => {
    const newItem: LineItem = { name: "Nuevo Item", quantity: 1, unitPrice: 0 };
    onUpdate({ ...data, items: [...data.items, newItem] });
  };

  const handleItemChange = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...data.items];
    newItems[index] = { ...newItems[index], [field]: value };
    onUpdate({ ...data, items: newItems });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl p-6 max-w-2xl w-full mx-auto animate-fade-in-up pb-24">
      <div className="flex justify-between items-center mb-6 border-b pb-4 border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800">Revisar Comprobante</h2>
        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wide">
          {data.scheduledFor ? 'Programado' : 'Borrador'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Type & Condition Row */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Tipo</label>
                <select 
                    value={data.type} 
                    onChange={(e) => onUpdate({...data, type: e.target.value as InvoiceType})}
                    className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-gray-800 font-semibold focus:ring-2 focus:ring-blue-500 text-sm"
                >
                    {Object.values(InvoiceType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Pago</label>
                 <select 
                    value={data.paymentCondition} 
                    onChange={(e) => onUpdate({...data, paymentCondition: e.target.value as PaymentCondition})}
                    className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 text-sm"
                >
                    {Object.values(PaymentCondition).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
        </div>

        {/* Date & Time Row (GRID 50/50) */}
        <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Fecha Emisión</label>
                <div className="relative">
                    <input 
                        type="date" 
                        value={data.date}
                        onChange={(e) => onUpdate({...data, date: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 text-sm min-h-[42px]"
                    />
                </div>
             </div>
             <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Hora</label>
                <div className="relative">
                    <input 
                        type="time" 
                        value={data.time || ''}
                        onChange={(e) => onUpdate({...data, time: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-xl px-3 py-2 text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 text-sm min-h-[42px]"
                    />
                </div>
             </div>
        </div>
             
        {/* Programación (Opcional) */}
        {data.scheduledFor && (
             <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-800">
                   <strong>Programado:</strong> Se generará automáticamente el {data.scheduledFor}.
                </p>
             </div>
        )}
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Items (Palabras Clave)</label>
        </div>
        
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            {data.items.map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <input 
                        type="text" 
                        value={item.name} 
                        onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                        className="flex-grow bg-transparent border-none focus:ring-0 font-medium text-gray-800 placeholder-gray-400 w-full capitalize"
                        placeholder="Producto"
                    />
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                value={item.quantity} 
                                onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                                className="w-14 bg-gray-50 rounded-lg px-1 py-1 text-center text-sm font-semibold"
                                placeholder="Cant"
                            />
                            <span className="text-gray-400 text-xs">x</span>
                            <input 
                                type="number" 
                                value={item.unitPrice} 
                                onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value))}
                                className="w-20 bg-gray-50 rounded-lg px-1 py-1 text-right text-sm font-semibold"
                                placeholder="Price"
                            />
                        </div>
                        <button onClick={() => handleDeleteItem(idx)} className="p-2 text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
            <button 
                onClick={handleAddItem}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 text-sm font-medium hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" /> Agregar Item
            </button>
        </div>
      </div>

      {/* Footer Totals */}
      <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-100 gap-4">
        <div className="text-2xl font-bold text-gray-900">
            Total: <span className="text-blue-600">{formatCurrency(calculateTotal())}</span>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
            <button 
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 sm:flex-none px-6 py-3 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
                Cancelar
            </button>
            <button 
                onClick={onConfirm}
                disabled={isLoading}
                className="flex-1 sm:flex-none px-8 py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-transform transform active:scale-95 shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {isLoading ? (
                    <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Enviando...</span>
                    </>
                ) : (
                    data.scheduledFor ? 'Programar' : 'Generar'
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceReview;