// FIX: Implement the main App component to handle authentication, routing, and data management.
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { getPurchaseOrders, savePurchaseOrder, updatePurchaseOrder, serverTimestamp } from './services/firebase';
import type { User, Page, PurchaseOrder, ExtractedPurchaseOrder } from './types';

import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import Spinner from './components/Spinner';
import ExtractorPage from './pages/ExtractorPage';
import OrdersPage from './pages/OrdersPage';
import OverviewPage from './pages/OverviewPage';
import DestinationsPage from './pages/DestinationsPage';


const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('extractor');

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorOrders, setErrorOrders] = useState<string | null>(null);
  
  const [notification, setNotification] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;
    if (user) {
      setLoadingOrders(true);
      unsubscribe = getPurchaseOrders(
        (fetchedOrders) => {
          setOrders(fetchedOrders);
          setLoadingOrders(false);
          setErrorOrders(null);
        },
        (error) => {
          console.error(error);
          setErrorOrders("Falha ao carregar as ordens de compra.");
          setLoadingOrders(false);
        }
      );
    } else {
      setOrders([]);
      setLoadingOrders(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);
  
  // Clear notification after a delay
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000); // 5 seconds
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleSaveOrder = useCallback(async (orderData: ExtractedPurchaseOrder) => {
    if (!user) {
      throw new Error("Usuário não autenticado.");
    }

    const newOrder: Omit<PurchaseOrder, 'id'> = {
      ...orderData,
      cnpj: orderData.cnpj || '',
      userId: user.uid,
      createdBy: user.displayName || 'Usuário Desconhecido',
      creatorEmail: user.email || 'Email Desconhecido',
      createdAt: serverTimestamp() as any, // Let server generate timestamp
      updatedAt: serverTimestamp() as any,
      attachments: [], // Attachments will be handled in the modal
    };
    
    const newOrderId = await savePurchaseOrder(newOrder);
    
    setNotification('Ordem de compra salva com sucesso!');
    setCurrentPage('orders');
    setHighlightedOrderId(newOrderId);

  }, [user]);

  const handleUpdateOrder = useCallback(async (orderToUpdate: PurchaseOrder) => {
    if (!user) {
      throw new Error("Usuário não autenticado.");
    }
    
    const { id, ...dataToUpdate } = orderToUpdate;

    const updates = {
        ...dataToUpdate,
        updatedBy: user.displayName || 'Usuário Desconhecido',
        updaterEmail: user.email || 'Email Desconhecido',
        updatedAt: serverTimestamp(),
    };

    await updatePurchaseOrder(id, updates);
    setNotification('Ordem de compra atualizada com sucesso!');
  }, [user]);
  
  const handleNavigateToOrder = useCallback((orderId: string) => {
      setCurrentPage('orders');
      setHighlightedOrderId(orderId);
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage orders={orders} loading={loadingOrders} error={errorOrders} onNavigateToOrder={handleNavigateToOrder} />;
      case 'extractor':
        return <ExtractorPage onSaveSuccess={handleSaveOrder} />;
      case 'orders':
        return <OrdersPage 
                    orders={orders} 
                    loading={loadingOrders} 
                    error={errorOrders}
                    notification={notification}
                    onUpdateOrder={handleUpdateOrder} 
                    highlightedOrderId={highlightedOrderId}
                    onHighlightComplete={() => setHighlightedOrderId(null)}
                />;
      case 'destinations':
        return <DestinationsPage orders={orders} loading={loadingOrders} error={errorOrders} onUpdateOrder={handleUpdateOrder} />;
      default:
        return <ExtractorPage onSaveSuccess={handleSaveOrder} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Header user={user} currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderCurrentPage()}
      </main>
    </div>
  );
};

export default App;