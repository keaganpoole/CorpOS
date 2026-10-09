import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MoneyTable from './MoneyTable';
import BreakroomLoginModal from './modals/BreakroomLoginModal';
import CommissionLogicModal from './modals/CommissionLogicModal'; // Import the new modal
import { supabase } from '../supabaseClient';
import '../styles/BreakroomCanvas.css';

const repsData = [
  {
    id: 'uuid1',
    firstName: 'Elara',
    lastName: 'Vance',
    commission_weekly: 1200,
    commission_monthly: 4800,
    commission_annually: 57600,
    plan_count_free: 50,
    plan_count_unlimited: 30,
    plan_count_unlimited_pro: 15,
  },
  {
    id: 'uuid2',
    firstName: 'Kael',
    lastName: 'Thorne',
    commission_weekly: 2500,
    commission_monthly: 10000,
    commission_annually: 120000,
    plan_count_free: 20,
    plan_count_unlimited: 45,
    plan_count_unlimited_pro: 35,
  },
  {
    id: 'uuid3',
    firstName: 'Seraphina',
    lastName: 'Reed',
    commission_weekly: 800,
    commission_monthly: 3200,
    commission_annually: 38400,
    plan_count_free: 120,
    plan_count_unlimited: 15,
    plan_count_unlimited_pro: 5,
  },
  {
    id: 'uuid4',
    firstName: 'Orion',
    lastName: 'Bell',
    commission_weekly: 1800,
    commission_monthly: 7200,
    commission_annually: 86400,
    plan_count_free: 30,
    plan_count_unlimited: 25,
    plan_count_unlimited_pro: 25,
  }
];

const Breakroom = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false); // State for the new modal
  const [commissionStructure, setCommissionStructure] = useState({ data: null, tiers: [] });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCommissionData = async () => {
      try {
        const [plansRes, tiersRes, masterRes] = await Promise.all([
          supabase.from('plans').select('slug, name, display'),
          supabase.from('tiers').select('*').order('name'),
          supabase.from('master').select('points_multiplier').eq('id', '0').single()
        ]);

        if (plansRes.error || tiersRes.error) {
          console.error("Breakroom.jsx:event_73");
          setCommissionStructure({ data: [], tiers: [] });
          return;
        }

        const plans = plansRes.data;
        const tiers = tiersRes.data;
        // Match backend logic: default to 1.0 if record or value is missing
        const globalMultiplier = masterRes.data?.points_multiplier ?? 1.0;
        
        console.debug("Breakroom.jsx:event_83");

        if (plans && tiers) {
          const formattedData = [];

          plans.forEach(plan => {
            const planName = (plan.slug || plan.name || 'Unknown').replace('_', ' ').toUpperCase();
            // The catalog deliberately does not persist Stripe prices. Legacy
            // commission views may supply optional display values, otherwise
            // they leave those rows out until a server-side pricing source is used.
            const monthlyPrice = Number(plan.display?.monthly_price || 0);
            const annualPrice = Number(plan.display?.annual_price || 0);

            // Monthly Calculation
            if (monthlyPrice > 0) {
              const monthlyRow = {
                plan: `${planName} (MONTHLY)`,
                price: monthlyPrice
              };
              tiers.forEach(tier => {
                monthlyRow[tier.name] = {
                  new: Math.round(monthlyPrice * (tier.multiplier_new_acquisition || 0) * globalMultiplier),
                  rebill: Math.round(monthlyPrice * (tier.multiplier_rebill || 0) * globalMultiplier)
                };
              });
              formattedData.push(monthlyRow);
            }

            // Annual Calculation
            if (annualPrice > 0) {
              const annualRow = {
                plan: `${planName} (ANNUAL)`,
                price: annualPrice
              };
              tiers.forEach(tier => {
                annualRow[tier.name] = {
                  new: Math.round(annualPrice * (tier.multiplier_new_acquisition || 0) * globalMultiplier),
                  rebill: Math.round(annualPrice * (tier.multiplier_rebill || 0) * globalMultiplier)
                };
              });
              formattedData.push(annualRow);
            }
          });

          // Sort by price for logical progression in the table
          formattedData.sort((a, b) => a.price - b.price);

          setCommissionStructure({ 
            data: formattedData, 
            tiers: tiers.map(t => t.name) 
          });
        } else {
          setCommissionStructure({ data: [], tiers: [] });
        }
      } catch (error) {
        console.error("Breakroom.jsx:event_137");
        setCommissionStructure({ data: [], tiers: [] });
      }
    };

    fetchCommissionData();
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleRefresh = () => {
    setRefreshKey(prevKey => prevKey + 1);
  };

  const handleGoToEmporium = () => {
    navigate('/emporium');
  };

  const handleOpenCommissionModal = () => {
    setIsCommissionModalOpen(true);
  };

  const handleCloseCommissionModal = () => {
    setIsCommissionModalOpen(false);
  };

  return (
    <div className="breakroom-canvas">
      {!isLoggedIn && <BreakroomLoginModal onLogin={handleLogin} />}
      <div className={`money-table-wrapper ${!isLoggedIn ? 'blur-md' : ''}`}>
        <div className="w-full flex justify-end p-2 space-x-2">
          <button 
            onClick={handleOpenCommissionModal} 
            className="bg-gray-700 text-white hover:bg-gray-600 rounded-full px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
          >
            Points Structure
          </button>
          <button 
            onClick={handleGoToEmporium} 
            className="bg-gray-700 text-white hover:bg-gray-600 roundedfull px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
          >
            Emporium
          </button>
          <button 
            onClick={handleRefresh} 
            className="bg-gray-700 text-white hover:bg-gray-600 rounded-full p-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
            aria-label="Refresh Money Table"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.899 2.466 1 1 0 11-1.79 1.002A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm12 14a1 1 0 01-1-1v-2.101a7.002 7.002 0 01-11.899-2.466 1 1 0 111.79-1.002A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 01-1 1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <MoneyTable key={refreshKey} />
      </div>
      <CommissionLogicModal 
        isOpen={isCommissionModalOpen} 
        onClose={handleCloseCommissionModal} 
        commissionData={commissionStructure.data}
        tiers={commissionStructure.tiers}
      />
    </div>
  );
};

export default Breakroom;
