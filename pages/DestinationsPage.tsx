import React, { useState, useMemo } from 'react';
import type { PurchaseOrder } from '../types';
import Spinner from '../components/Spinner';
import DestinationsModal from '../components/DestinationsModal';

interface DestinationsPageProps {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
  onUpdateOrder: (order: PurchaseOrder) => Promise<void>;
}

const DestinationsPage: React.FC<DestinationsPageProps> = ({ orders, loading, error, onUpdateOrder }) => {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const ordersWithMappingStatus = useMemo(() => {
    // Explicitly sort orders by creation date (most recent first) for consistency.
    return [...orders]
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      })
      .map(order => {
        const isMapped = order.items.every(item => item.codigoDestino && item.codigoDestino.trim() !== '');
        return { ...order, isMapped };
      });
  }, [orders]);

  const handleOpenModal = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleSaveChanges = async (updatedOrder: PurchaseOrder) => {
    try {
      await onUpdateOrder(updatedOrder);
    } catch (e) {
      console.error("Failed to update order", e);
    } finally {
      setIsModalOpen(false);
      setSelectedOrder(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center">{error}</p>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-slate-800 mb-4 uppercase">Mapeamento de Produtos para ERP</h2>
      <p className="mb-6 text-slate-700">
        Esta seção permite que você traduza os dados da ordem de compra do fornecedor para os códigos e descrições internas do seu sistema ERP.
      </p>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-300 border-x border-slate-300">
          <thead className="bg-slate-50">
            <tr className="divide-x divide-slate-300">
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Fornecedor</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Pedido</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Status Mapeamento</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {loading ? (
                <tr>
                    <td colSpan={5} className="text-center py-20">
                        <div className="flex flex-col justify-center items-center gap-2">
                            <Spinner />
                            <span className="text-slate-500 font-bold uppercase">Carregando...</span>
                        </div>
                    </td>
                </tr>
            ) : error ? (
                <tr>
                    <td colSpan={5} className="text-center py-20 text-red-500 uppercase font-bold">
                        {error}
                    </td>
                </tr>
            ) : ordersWithMappingStatus.length > 0 ? (
              ordersWithMappingStatus.map((order, index) => (
              <tr 
                key={order.id} 
                onDoubleClick={() => handleOpenModal(order)}
                className="cursor-pointer hover:bg-slate-50 divide-x divide-slate-300 transition-colors duration-200"
                style={{
                    animation: `fadeIn 0.5s ease-out ${index * 50}ms forwards`,
                    opacity: 0,
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold truncate max-w-xs">{order.fornecedor}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 uppercase text-center font-bold">{order.pedido}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold">{order.data}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {order.isMapped ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Mapeado
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Pendente
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold">
                  <button onClick={() => handleOpenModal(order)} className="text-indigo-600 hover:text-indigo-900 uppercase">
                    {order.isMapped ? 'Ver / Editar' : 'Mapear'}
                  </button>
                </td>
              </tr>
              ))
            ) : (
              <tr style={{ animation: `fadeIn 0.5s ease-out forwards`, opacity: 0 }}>
                  <td colSpan={5} className="text-center py-10 text-slate-500 uppercase font-bold">
                    Nenhuma ordem de compra encontrada.
                  </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && selectedOrder && (
        <DestinationsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          order={selectedOrder}
          onSave={handleSaveChanges}
        />
      )}
    </div>
  );
};

export default DestinationsPage;