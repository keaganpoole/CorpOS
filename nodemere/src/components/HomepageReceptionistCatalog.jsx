import React, { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../sonar/lib/api';
import HireReceptionistModal from '../sonar/pages/HireReceptionistModal';
import '../sonar/studio/studio.css';
import '../sonar/studio/receptionistGallery.css';
import './HomepageReceptionistCatalog.css';

const catalogFields = 'id,full_name,description,stereotype,avatar,avatar_video,traits,voice,age,first_name,is_active,showcase_in_hero,hero_avatar,banner_id,gender,personality_type,personality_id,personality:personalities(mbti,personality)';

export default function HomepageReceptionistCatalog({ active, onContinue }) {
  const [catalogRows, setCatalogRows] = useState(null);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const query = new URLSearchParams({ select: catalogFields, order: 'full_name.asc' });
        const response = await fetch(`${supabaseUrl}/rest/v1/receptionist_catalog?${query}`, {
          headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
        });
        if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
        const data = await response.json();
        if (cancelled) return;
        setCatalogRows((Array.isArray(data) ? data : [])
          .filter((person) => person.id != null)
          .map((person) => ({ ...person, catalog_id: person.catalog_id ?? person.id })));
      } catch (error) {
        if (cancelled) return;
        console.error('Homepage receptionist catalog could not load.', error);
        setCatalogRows([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const hire = async (receptionist) => {
    const catalogId = receptionist.catalog_id ?? receptionist.id;
    if (!session) {
      window.sessionStorage.setItem('nodemere:pending-receptionist-catalog-id', String(catalogId));
      navigate('/auth', { state: { receptionistCatalogId: catalogId } });
      return;
    }
    await api.hireReceptionist(receptionist);
    navigate('/dashboard');
  };

  return (
    <div className="homepage-receptionist-catalog">
      <div className="ns-persistent-wordmark homepage-catalog-wordmark" aria-label="Receptionist catalog">Receptionist <span>catalog</span></div>
      <HireReceptionistModal
        embedded
        catalogRows={catalogRows}
        onHire={hire}
        autoPlayOnOpen
        hideVoiceButton
        allowGalleryWheelZoom={false}
        interactive={active}
        portalDetail
      />
      {active && (
        <button type="button" className="homepage-catalog-continue" onClick={onContinue}>
          <span>Continue</span>
          <ArrowDown size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
