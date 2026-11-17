import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { AuctionListPage } from './pages/AuctionListPage';
import { AuctionDetailPage } from './pages/AuctionDetailPage';
import { CreateRFQModal } from './components/CreateRFQModal';
import { RFQDetail } from './types/rfq';

export const App: React.FC = () => {
  const [selectedRFQId, setSelectedRFQId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const handleSelectRFQ = (id: number) => {
    setSelectedRFQId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setSelectedRFQId(null);
  };

  const handleRFQCreated = (newRFQ: RFQDetail) => {
    setRefreshTrigger((prev) => prev + 1);
    setSelectedRFQId(newRFQ.id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
        onNavigateHome={handleBackToList}
      />

      <main className="flex-1">
        {selectedRFQId ? (
          <AuctionDetailPage
            key={`${selectedRFQId}-${refreshTrigger}`}
            rfqId={selectedRFQId}
            onBack={handleBackToList}
          />
        ) : (
          <AuctionListPage
            key={refreshTrigger}
            onSelectRFQ={handleSelectRFQ}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-5 mt-12 text-center text-xs text-slate-500">
        <p>British Auction RFQ System</p>
      </footer>

      <CreateRFQModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleRFQCreated}
      />
    </div>
  );
};

export default App;
