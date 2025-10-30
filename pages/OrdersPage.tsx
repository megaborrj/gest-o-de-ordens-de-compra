import React, { useState, useMemo, useEffect, useRef } from 'react';
// FIX: Import PurchaseOrderItem type to resolve reference error in handleExportCSV.
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderItem } from '../types';
import Spinner from '../components/Spinner';
import OrderModal from '../components/OrderModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { deletePurchaseOrder } from '../services/firebase';
import { ExportIcon } from '../components/icons/ExportIcon';

interface OrdersPageProps {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
  notification: string | null;
  onUpdateOrder: (order: PurchaseOrder) => Promise<void>;
  highlightedOrderId: string | null;
  onHighlightComplete: () => void;
}

// --- VIRTUALIZATION CONSTANTS ---
const ROW_HEIGHT = 68; // The fixed height of each table row in pixels.
const OVERSCAN_COUNT = 5; // The number of rows to render above and below the visible area to reduce flickering on scroll.


const formatDateToDDMMYYYY = (dateString: string | undefined | null): string => {
    if (!dateString || typeof dateString !== 'string') return '';

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
        return dateString;
    }
    
    // Handles ISO YYYY-MM-DD and some MM/DD/YYYY
    const date = new Date(dateString);

    if (!isNaN(date.getTime())) {
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    
    // Fallback for DD-MM-YYYY or DD.MM.YYYY
    const parts = dateString.replace(/[.\/]/g, '-').split('-');
    if (parts.length === 3) {
        const [part1, part2, part3] = parts.map(p => parseInt(p, 10));
        if (part1 > 0 && part1 <= 31 && part2 > 0 && part2 <= 12 && part3 > 1900) {
            const manualDate = new Date(Date.UTC(part3, part2 - 1, part1));
            if (!isNaN(manualDate.getTime())) {
                const day = String(manualDate.getUTCDate()).padStart(2, '0');
                const month = String(manualDate.getUTCMonth() + 1).padStart(2, '0');
                const year = manualDate.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }
        }
    }

    return dateString;
};

const isUrl = (text: string | null | undefined): boolean => {
    if (!text) return false;
    return text.startsWith('http://') || text.startsWith('https://');
};

const statusOptions: PurchaseOrderStatus[] = ['Iniciado', 'Recebido', 'Cancelado'];

const statusStyles: { [key in PurchaseOrderStatus]: { bg: string; text: string; ring: string; } } = {
  'Iniciado': { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'focus:ring-blue-500' },
  'Recebido': { bg: 'bg-green-100', text: 'text-green-800', ring: 'focus:ring-green-500' },
  'Cancelado': { bg: 'bg-red-100', text: 'text-red-800', ring: 'focus:ring-red-500' },
};

const statusRowStyles: { [key in PurchaseOrderStatus]: string } = {
  'Iniciado': 'bg-blue-100/60 hover:bg-blue-200/60',
  'Recebido': 'bg-green-100/60 hover:bg-green-200/60',
  'Cancelado': 'bg-red-100/60 hover:bg-red-200/60',
};

const statusAnimationClasses: { [key in PurchaseOrderStatus]: string } = {
  'Iniciado': 'animate-status-glow-blue',
  'Recebido': 'animate-status-glow-green',
  'Cancelado': 'animate-status-glow-red',
};


const OrdersPage: React.FC<OrdersPageProps> = ({ orders, loading, error, notification, onUpdateOrder, highlightedOrderId, onHighlightComplete }) => {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // State for filters
  const [filterFornecedor, setFilterFornecedor] = useState<string>('');
  const [filterCnpj, setFilterCnpj] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('Iniciado');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // State for virtualization
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State for animation
  const [animatingStatus, setAnimatingStatus] = useState<string | null>(null);

  // Memoized values for filter options
  const uniqueFornecedores = useMemo(() => {
    const fornecedores = new Set(orders.map(o => o.fornecedor));
    return Array.from(fornecedores).sort();
  }, [orders]);

  // Memoized filtered orders
  const filteredOrders = useMemo(() => {
    const filtered = orders.filter(order => {
      const searchTermMatch = searchTerm.toLowerCase() === '' ||
        order.pedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.sequencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.fornecedor.toLowerCase().includes(searchTerm.toLowerCase());
      
      const fornecedorMatch = filterFornecedor === '' || order.fornecedor === filterFornecedor;
      const cnpjMatch = filterCnpj === '' || (order.cnpj && order.cnpj.replace(/[^\d]/g, '').includes(filterCnpj.replace(/[^\d]/g, '')));
      const statusMatch = filterStatus === '' || order.status === filterStatus;

      return searchTermMatch && fornecedorMatch && statusMatch && cnpjMatch;
    });

    // Explicitly sort by creation date (most recent first) to ensure consistent ordering.
    return filtered.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
    });
  }, [orders, searchTerm, filterFornecedor, filterStatus, filterCnpj]);
  
  // Effect to scroll to and highlight an order when navigated from another page
  useEffect(() => {
    if (highlightedOrderId) {
        const orderIndex = filteredOrders.findIndex(o => o.id === highlightedOrderId);
        
        if (orderIndex > -1 && scrollContainerRef.current) {
            const containerHeight = scrollContainerRef.current.clientHeight;
            const targetScrollTop = orderIndex * ROW_HEIGHT;
            // Center the item in the viewport for better visibility
            const centeredScrollTop = Math.max(0, targetScrollTop - (containerHeight / 2) + (ROW_HEIGHT / 2));
            
            scrollContainerRef.current.scrollTo({ top: centeredScrollTop, behavior: 'smooth' });
            
            const timer = setTimeout(() => {
                onHighlightComplete();
            }, 2500); // Duration of the highlight animation
            
            return () => clearTimeout(timer);
        } else {
             // If order not found with current filters, just clear the highlight.
             onHighlightComplete();
        }
    }
  }, [highlightedOrderId, filteredOrders, onHighlightComplete]);


  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterFornecedor('');
    setFilterCnpj('');
    setFilterStatus('');
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
        alert("Nenhuma ordem para exportar com os filtros atuais.");
        return;
    }

    const headers = [
        "ID Ordem", "Sequencia", "Pedido", "Nota Fiscal", "Fornecedor", "CNPJ", "Data", "Status", "Total Ordem", "Criado Por", "Email Criador", "Data Criacao",
        "Item Codigo", "Item Descricao", "Item Unidade", "Item Quantidade", "Item Preco Unitario", "Item Preco Total"
    ];

    const escapeCsvCell = (cell: any): string => {
        const strCell = String(cell === null || cell === undefined ? '' : cell);
        if (strCell.includes(',') || strCell.includes('"') || strCell.includes('\n')) {
            return `"${strCell.replace(/"/g, '""')}"`;
        }
        return strCell;
    };

    const rows = filteredOrders.flatMap(order =>
        (order.items && order.items.length > 0 ? order.items : [{} as PurchaseOrderItem]).map(item => [
            order.id,
            order.sequencia,
            order.pedido,
            order.notaFiscal,
            order.fornecedor,
            order.cnpj,
            order.data,
            order.status,
            order.totalGeral,
            order.createdBy,
            order.creatorEmail,
            order.createdAt?.toDate().toLocaleString('pt-BR') || '',
            item.codigo,
            item.descricao,
            item.unidade,
            item.quantidade,
            item.precoUnitario,
            item.precoTotal
        ].map(escapeCsvCell))
    );

    let csvContent = headers.join(',') + '\n';
    rows.forEach(rowArray => {
        csvContent += rowArray.join(',') + '\n';
    });
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `ordens_compra_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
  };

  const handleViewDetails = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (order: PurchaseOrder) => {
    setOrderToDelete(order);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (orderToDelete) {
      try {
        await deletePurchaseOrder(orderToDelete.id);
      } catch (e) {
        console.error("Failed to delete order", e);
      } finally {
        setIsDeleteModalOpen(false);
        setOrderToDelete(null);
      }
    }
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
  
  const handleStatusChange = async (orderId: string, newStatus: PurchaseOrderStatus) => {
    const orderToUpdate = orders.find(o => o.id === orderId);
    if (orderToUpdate) {
      const updatedOrder = { ...orderToUpdate, status: newStatus };
      await onUpdateOrder(updatedOrder);
      setAnimatingStatus(orderId);
      setTimeout(() => setAnimatingStatus(null), 1500);
    }
  };
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // --- VIRTUALIZATION CALCULATIONS ---
  const containerHeight = scrollContainerRef.current?.clientHeight || window.innerHeight * 0.7; // Use 70vh as fallback
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_COUNT);
  const visibleItemCount = Math.ceil(containerHeight / ROW_HEIGHT) + 2 * OVERSCAN_COUNT;
  const endIndex = Math.min(filteredOrders.length, startIndex + visibleItemCount);

  const visibleOrders = useMemo(() => filteredOrders.slice(startIndex, endIndex), [filteredOrders, startIndex, endIndex]);
  
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = Math.max(0, (filteredOrders.length - endIndex) * ROW_HEIGHT);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg relative">
      {notification && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-md" role="alert">
          <span className="block sm:inline">{notification}</span>
        </div>
      )}
      <h2 className="text-2xl font-bold text-slate-800 mb-4 uppercase">Ordens de Compra Salvas</h2>

      {/* Filter Bar */}
      <div className="p-4 mb-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="lg:col-span-1">
            <label htmlFor="search" className="block text-sm font-bold text-slate-700 uppercase">Pesquisar</label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pedido, sequência ou fornecedor..."
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-bold normal-case"
            />
          </div>
           <div>
            <label htmlFor="cnpjFilter" className="block text-sm font-bold text-slate-700 uppercase">CNPJ</label>
            <input
              type="text"
              id="cnpjFilter"
              value={filterCnpj}
              onChange={(e) => setFilterCnpj(e.target.value)}
              placeholder="Filtrar por CNPJ..."
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-bold normal-case"
            />
          </div>
          <div>
            <label htmlFor="fornecedorFilter" className="block text-sm font-bold text-slate-700 uppercase">Fornecedor</label>
            <select
              id="fornecedorFilter"
              value={filterFornecedor}
              onChange={(e) => setFilterFornecedor(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-bold normal-case"
            >
              <option value="">Todos</option>
              {uniqueFornecedores.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="statusFilter" className="block text-sm font-bold text-slate-700 uppercase">Status</label>
            <select
              id="statusFilter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-bold"
            >
              <option value="">Todos</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
              onClick={handleClearFilters}
              className="w-full px-4 py-2 text-sm font-bold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors uppercase"
            >
              Limpar Filtros
          </button>
           <button
              onClick={handleExportCSV}
              className="w-full px-4 py-2 text-sm font-bold text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 uppercase"
            >
              <ExportIcon className="w-4 h-4" />
              Exportar CSV
            </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-slate-700 uppercase font-bold">
        <strong>{filteredOrders.length}</strong> ordens encontradas.
      </div>

      <div ref={scrollContainerRef} onScroll={handleScroll} className="overflow-x-auto" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <table className="min-w-full divide-y divide-slate-300 border-x border-slate-300">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="divide-x divide-slate-300">
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Sequência</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Pedido</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Nota Fiscal</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Fornecedor</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">CNPJ</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Referência</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-2 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Link</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 relative">
            {loading ? (
                <tr>
                    <td colSpan={11} className="text-center py-20">
                        <div className="flex flex-col justify-center items-center gap-2">
                            <Spinner />
                            <span className="text-slate-500 font-bold uppercase">Carregando...</span>
                        </div>
                    </td>
                </tr>
            ) : error ? (
                <tr>
                    <td colSpan={11} className="text-center py-20 text-red-500 uppercase font-bold">
                        {error}
                    </td>
                </tr>
            ) : filteredOrders.length > 0 ? (
              <>
                {paddingTop > 0 && (
                  <tr style={{ height: `${paddingTop}px` }}>
                    <td colSpan={11} style={{ padding: 0, border: 'none' }}></td>
                  </tr>
                )}
                {visibleOrders.map((order, index) => (
                  <tr 
                    key={order.id} 
                    onDoubleClick={() => handleViewDetails(order)}
                    className={`cursor-pointer ${statusRowStyles[order.status]} transition-colors duration-300 ease-in-out divide-x divide-slate-300 ${order.id === highlightedOrderId ? 'animate-row-highlight' : ''}`}
                    style={{
                        animation: `fadeIn 0.5s ease-out ${index * 50}ms forwards`,
                        opacity: 0,
                        height: `${ROW_HEIGHT}px`,
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold">{order.sequencia}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 uppercase text-center font-bold">{order.pedido}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold">{order.notaFiscal || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold truncate max-w-xs">{order.fornecedor}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold">{order.cnpj || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold truncate max-w-xs">{order.nomeReferencia || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 uppercase text-center font-bold">{formatDateToDDMMYYYY(order.data)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-800 font-bold text-center">
                      R$ {order.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as PurchaseOrderStatus)}
                        className={`text-xs font-bold rounded-full px-2 py-1 border-2 border-transparent appearance-none uppercase ${statusStyles[order.status]?.bg || 'bg-gray-100'} ${statusStyles[order.status]?.text || 'text-gray-800'} ${statusStyles[order.status]?.ring || 'focus:ring-gray-500'} ${animatingStatus === order.id ? statusAnimationClasses[order.status] : ''}`}
                        onClick={(e) => e.stopPropagation()} // Prevent row click events if any
                      >
                        {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-4 whitespace-nowrap text-center">
                      {isUrl(order.observacoes) ? (
                          <a
                              href={order.observacoes}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-2 text-slate-600 rounded-full hover:bg-slate-200 hover:text-slate-800 transition-colors"
                              title="Abrir nota fiscal em nova aba"
                              onClick={(e) => e.stopPropagation()}
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                          </a>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold">
                      <button onClick={() => handleViewDetails(order)} className="text-indigo-600 hover:text-indigo-900 mr-4 uppercase">Detalhes</button>
                      <button onClick={() => handleDeleteClick(order)} className="text-red-600 hover:text-red-900 uppercase">Excluir</button>
                    </td>
                  </tr>
                ))}
                {paddingBottom > 0 && (
                  <tr style={{ height: `${paddingBottom}px` }}>
                    <td colSpan={11} style={{ padding: 0, border: 'none' }}></td>
                  </tr>
                )}
              </>
            ) : (
              <tr style={{ animation: `fadeIn 0.5s ease-out forwards`, opacity: 0 }}>
                  <td colSpan={11} className="text-center py-10 text-slate-500 uppercase font-bold">
                    {orders.length > 0 ? 'Nenhuma ordem corresponde aos filtros.' : 'Nenhuma ordem de compra encontrada.'}
                  </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isModalOpen && selectedOrder && (
        <OrderModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          order={selectedOrder}
          onSave={handleSaveChanges}
        />
      )}
      {isDeleteModalOpen && orderToDelete && (
        <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          order={orderToDelete}
        />
      )}
    </div>
  );
};

export default OrdersPage;
