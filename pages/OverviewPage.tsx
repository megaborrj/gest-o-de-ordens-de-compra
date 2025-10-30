import React, { useState, useMemo } from 'react';
import type { PurchaseOrder, PurchaseOrderStatus } from '../types';
import Spinner from '../components/Spinner';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import CustomDatePicker from '../components/CustomDatePicker';

interface OverviewPageProps {
    orders: PurchaseOrder[];
    loading: boolean;
    error: string | null;
    onNavigateToOrder: (orderId: string) => void;
}

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

// --- Helper Functions ---
const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const parseDate = (dateString: string): Date | null => {
    if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return null;
    const [day, month, year] = dateString.split('/').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    // Create date in UTC to avoid timezone issues
    return new Date(Date.UTC(year, month - 1, day));
};

// Helper to convert YYYY-MM-DD to DD/MM/YYYY
const ymdToDmy = (dateString: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Helper to convert DD/MM/YYYY to YYYY-MM-DD
const dmyToYmd = (dateString: string): string => {
  if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return '';
  const [day, month, year] = dateString.split('/');
  return `${year}-${month}-${day}`;
};

// --- Icon Components ---
const DollarSignIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v1m0 6v1m0-1c-1.11 0-2.08.402-2.599 1M12 8V7m0 1v.01" />
    </svg>
);
const DocumentTextIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);
const CalculatorIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
);

// --- Reusable UI Components ---
const KPICard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4">
        <div className="bg-slate-100 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-sm text-slate-600">{title}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-white p-6 rounded-lg shadow-md ${className}`}>
        <h3 className="text-lg font-semibold text-slate-700 mb-4">{title}</h3>
        <div>{children}</div>
    </div>
);

// --- Chart Component ---
interface BarChartData {
    label: string;
    value: number;
    color?: string;
}

const HorizontalBarChart: React.FC<{ data: BarChartData[]; formatLabel?: (value: number) => string }> = ({ data, formatLabel }) => {
    const maxValue = Math.max(...data.map(d => d.value), 0);
    const defaultColor = 'bg-blue-500';

    return (
        <div className="space-y-3">
            {data.length > 0 ? data.map(({ label, value, color }) => (
                <div key={label} className="grid grid-cols-4 gap-2 items-center">
                    <p className="col-span-1 text-sm text-slate-600 truncate" title={label}>{label}</p>
                    <div className="col-span-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-full bg-slate-200 rounded-full h-5">
                                <div
                                    className={`${color || defaultColor} h-5 rounded-full flex items-center justify-end pr-2`}
                                    style={{ width: maxValue > 0 ? `${(value / maxValue) * 100}%` : '0%' }}
                                >
                                </div>
                            </div>
                             <span className="text-sm font-semibold text-slate-700 w-24 text-right">
                                {formatLabel ? formatLabel(value) : value}
                            </span>
                        </div>
                    </div>
                </div>
            )) : <p className="text-center text-sm text-slate-500 py-4">Nenhum dado para exibir no período selecionado.</p>}
        </div>
    );
};

// --- View Components (Kanban/List) ---
const statusOptions: PurchaseOrderStatus[] = ['Iniciado', 'Recebido', 'Cancelado'];
const statusStyles: { [key in PurchaseOrderStatus]: { bg: string; text: string; } } = {
  'Iniciado': { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Recebido': { bg: 'bg-green-100', text: 'text-green-800' },
  'Cancelado': { bg: 'bg-red-100', text: 'text-red-800' },
};

const KanbanCard: React.FC<{ order: PurchaseOrder; onClick: () => void; }> = ({ order, onClick }) => (
    <div
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
        role="button"
        tabIndex={0}
        className={`p-4 rounded-lg shadow-sm space-y-2 cursor-pointer transition-transform transform hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${statusStyles[order.status]?.bg || 'bg-gray-100'}`}
    >
        <div className="flex justify-between items-start">
            <h4 className="font-bold text-slate-800 flex-1 truncate pr-2" title={order.fornecedor}>
                {order.fornecedor}
            </h4>
            <p className={`text-xs font-bold uppercase tracking-wider ${statusStyles[order.status]?.text || 'text-gray-800'}`}>
                {order.status}
            </p>
        </div>
        <p className="text-sm text-slate-700">
            Pedido: <span className="font-medium text-slate-800">{order.pedido}</span>
        </p>
        <p className="text-sm text-slate-700">
            Data: <span className="font-medium text-slate-800">{formatDateToDDMMYYYY(order.data)}</span>
        </p>
        <p className="text-right font-bold text-lg text-slate-900">
            {formatCurrency(order.totalGeral)}
        </p>
    </div>
);

const KanbanColumn: React.FC<{ status: PurchaseOrderStatus; orders: PurchaseOrder[]; onCardClick: (orderId: string) => void; }> = ({ status, orders, onCardClick }) => (
    <div className="w-80 bg-slate-100 rounded-lg p-3 flex-shrink-0 flex flex-col">
        <h3 className="font-semibold text-slate-700 px-1 mb-3 flex items-center">
             <span className={`w-3 h-3 rounded-full mr-2 ${statusStyles[status]?.bg.replace('100', '500') || 'bg-gray-500'}`}></span>
            {status}
            <span className="ml-2 text-sm text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{orders.length}</span>
        </h3>
        <div className="space-y-3">
            {orders.map(order => <KanbanCard key={order.id} order={order} onClick={() => onCardClick(order.id)} />)}
            {orders.length === 0 && <div className="text-center text-sm text-slate-400 pt-10">Nenhum pedido aqui.</div>}
        </div>
    </div>
);

const OrderListItem: React.FC<{ order: PurchaseOrder; onClick: () => void; }> = ({ order, onClick }) => (
    <div
        onClick={onClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
        role="button"
        tabIndex={0}
        className={`grid grid-cols-1 md:grid-cols-5 gap-2 md:gap-4 items-center p-3 rounded-lg cursor-pointer transition-shadow hover:ring-2 hover:ring-indigo-300 ${statusStyles[order.status]?.bg || 'bg-gray-100'}`}>
        <div className="font-medium text-slate-800 truncate" title={order.fornecedor}>
            <span className="md:hidden font-bold text-slate-500 text-xs">FORNECEDOR: </span>{order.fornecedor}
        </div>
        <div className="text-sm text-slate-700">
            <span className="md:hidden font-bold text-slate-500 text-xs">PEDIDO: </span>{order.pedido}
        </div>
        <div className="text-sm text-slate-700">
             <span className="md:hidden font-bold text-slate-500 text-xs">DATA: </span>{formatDateToDDMMYYYY(order.data)}
        </div>
        <div className={`text-sm md:text-right font-semibold ${statusStyles[order.status]?.text || 'text-gray-800'}`}>
            <span className="md:hidden font-bold text-slate-500 text-xs">STATUS: </span>{order.status}
        </div>
        <div className="font-bold text-slate-800 md:text-right text-lg">{formatCurrency(order.totalGeral)}</div>
    </div>
);

const OrderList: React.FC<{ orders: PurchaseOrder[]; onCardClick: (orderId: string) => void; }> = ({ orders, onCardClick }) => (
    <div className="space-y-2">
        <div className="hidden md:grid grid-cols-5 gap-4 px-3 py-2 text-xs font-bold text-slate-600 uppercase">
            <span>Fornecedor</span>
            <span>Pedido</span>
            <span>Data</span>
            <span className="text-right">Status</span>
            <span className="text-right">Total</span>
        </div>
        {orders.length > 0 ? (
          orders.map(order => <OrderListItem key={order.id} order={order} onClick={() => onCardClick(order.id)} />)
        ) : (
          <div className="text-center py-10 text-slate-500">Nenhuma ordem de compra encontrada.</div>
        )}
    </div>
);

const ViewSwitcher: React.FC<{ viewMode: 'kanban' | 'list'; setViewMode: (mode: 'kanban' | 'list') => void; }> = ({ viewMode, setViewMode }) => {
    const baseClasses = 'px-4 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200';
    const activeClasses = 'bg-white text-indigo-600 shadow';
    const inactiveClasses = 'text-slate-700 hover:bg-slate-200';

    return (
        <div className="inline-flex rounded-lg shadow-sm bg-slate-100 p-1">
            <button onClick={() => setViewMode('kanban')} className={`${baseClasses} ${viewMode === 'kanban' ? activeClasses : inactiveClasses}`}>
                Kanban
            </button>
            <button onClick={() => setViewMode('list')} className={`${baseClasses} ${viewMode === 'list' ? activeClasses : inactiveClasses}`}>
                Lista
            </button>
        </div>
    );
};

// --- Main Page Component ---
const OverviewPage: React.FC<OverviewPageProps> = ({ orders, loading, error, onNavigateToOrder }) => {
    const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
    const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
    const [endDate, setEndDate] = useState(''); // YYYY-MM-DD

    const filteredOrders = useMemo(() => {
        const dateFiltered = orders.filter(order => {
            if (!startDate && !endDate) return true;
        
            const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : null;
            const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : null;

            const orderDate = parseDate(order.data);
            if (!orderDate) return false;

            if (start && orderDate < start) return false;
            if (end && orderDate > end) return false;

            return true;
        });

        // Explicitly sort by creation date (most recent first) to ensure consistent ordering.
        return dateFiltered.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
            const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
            return dateB - dateA;
        });
    }, [orders, startDate, endDate]);

    const memoizedData = useMemo(() => {
        // All calculations are now based on the date-filtered orders
        const ordersToAnalyze = filteredOrders;

        if (!ordersToAnalyze || ordersToAnalyze.length === 0) {
            return {
                totalValue: 0,
                totalCount: 0,
                averageValue: 0,
                byStatusChart: [],
                topSuppliers: [],
                byMonth: [],
                ordersByStatusKanban: statusOptions.reduce((acc, status) => ({...acc, [status]: []}), {} as Record<PurchaseOrderStatus, PurchaseOrder[]>)
            };
        }

        const totalValue = ordersToAnalyze.reduce((sum, order) => sum + order.totalGeral, 0);
        const totalCount = ordersToAnalyze.length;
        const averageValue = totalCount > 0 ? totalValue / totalCount : 0;

        const statusCounts: { [key: string]: number } = {};
        const statusColorsChart: { [key in PurchaseOrderStatus]: string } = {
            'Iniciado': 'bg-blue-500',
            'Recebido': 'bg-green-500', 
            'Cancelado': 'bg-red-500',
        };
        
        const supplierValues: { [key: string]: number } = {};
        const monthValues: { [key: string]: number } = {};
        const monthOrder: string[] = [];

        const ordersByStatusKanban = statusOptions.reduce((acc, status) => {
          acc[status] = [];
          return acc;
        }, {} as Record<PurchaseOrderStatus, PurchaseOrder[]>);

        for (const order of ordersToAnalyze) {
            statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
            supplierValues[order.fornecedor] = (supplierValues[order.fornecedor] || 0) + order.totalGeral;
            const date = parseDate(order.data);
            if (date) {
                const monthKey = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
                if (!monthValues[monthKey]) {
                    monthValues[monthKey] = 0;
                    monthOrder.push(monthKey);
                }
                monthValues[monthKey] += order.totalGeral;
            }
             if (order.status && ordersByStatusKanban[order.status as PurchaseOrderStatus]) {
              ordersByStatusKanban[order.status as PurchaseOrderStatus].push(order);
          }
        }
        
        const byStatusChart = Object.entries(statusCounts)
            .map(([label, value]) => ({ label, value: value!, color: statusColorsChart[label as PurchaseOrderStatus] || 'bg-gray-500' }))
            .sort((a, b) => b.value - a.value);

        const topSuppliers = Object.entries(supplierValues)
            .sort(([, a], [, b]) => b - a).slice(0, 5).map(([label, value]) => ({ label, value }));

        const byMonth = monthOrder.sort().map(key => {
            const [year, month] = key.split('-');
            const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' });
            return { label: label.charAt(0).toUpperCase() + label.slice(1), value: monthValues[key] }
        });

        return { totalValue, totalCount, averageValue, byStatusChart, topSuppliers, byMonth, ordersByStatusKanban };
    }, [filteredOrders]);

    if (loading) {
        return <div className="flex justify-center items-center h-64"><Spinner /></div>;
    }

    if (error) {
        return <p className="text-red-500 text-center">{error}</p>;
    }

    const handleClearFilters = () => {
      setStartDate('');
      setEndDate('');
    }

    return (
        <div className="space-y-8">
            <h2 className="text-3xl font-bold text-slate-800">Visão Geral</h2>
            
            {/* Date Filter Section */}
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-semibold text-slate-700 mb-2">Filtrar por Período</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="start-date" className="block text-sm font-medium text-slate-600">Data Início</label>
                        <CustomDatePicker
                            value={ymdToDmy(startDate)}
                            onChange={(dmy) => setStartDate(dmyToYmd(dmy))}
                        />
                    </div>
                    <div>
                        <label htmlFor="end-date" className="block text-sm font-medium text-slate-600">Data Fim</label>
                        <CustomDatePicker
                             value={ymdToDmy(endDate)}
                             onChange={(dmy) => setEndDate(dmyToYmd(dmy))}
                        />
                    </div>
                    <button
                        onClick={handleClearFilters}
                        className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300 transition-colors"
                    >
                        Limpar Filtro
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <KPICard title="Valor Total (Período)" value={formatCurrency(memoizedData.totalValue)} icon={<DollarSignIcon />} />
                <KPICard title="Qtd. de Pedidos (Período)" value={memoizedData.totalCount.toString()} icon={<DocumentTextIcon />} />
                <KPICard title="Valor Médio (Período)" value={formatCurrency(memoizedData.averageValue)} icon={<CalculatorIcon />} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Pedidos por Status (Período)">
                    <HorizontalBarChart data={memoizedData.byStatusChart} />
                </ChartCard>
                <ChartCard title="Top 5 Fornecedores (Período)">
                    <HorizontalBarChart data={memoizedData.topSuppliers} formatLabel={formatCurrency} />
                </ChartCard>
                 <ChartCard title="Valor Total por Mês (Período)" className="lg:col-span-2">
                    <HorizontalBarChart data={memoizedData.byMonth} formatLabel={formatCurrency} />
                </ChartCard>
            </div>
            
            {/* Orders Section */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-800">Quadro de Pedidos (Período)</h3>
                    <ViewSwitcher viewMode={viewMode} setViewMode={setViewMode} />
                </div>
                 <div key={viewMode} className="animate-content-fade-in">
                    {viewMode === 'kanban' ? (
                        <div className="flex space-x-4 overflow-x-auto pb-4">
                            {statusOptions.map(status => (
                                <KanbanColumn
                                  key={status}
                                  status={status}
                                  orders={memoizedData.ordersByStatusKanban[status] || []}
                                  onCardClick={onNavigateToOrder}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="max-h-[70vh] overflow-y-auto pr-2">
                            <OrderList orders={filteredOrders} onCardClick={onNavigateToOrder} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverviewPage;