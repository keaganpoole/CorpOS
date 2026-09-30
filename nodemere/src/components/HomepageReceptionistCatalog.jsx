import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Hand, MousePointer2 } from 'lucide-react';
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
  const [showGestureHint, setShowGestureHint] = useState(true);
  const [gestureMode, setGestureMode] = useState('pan');
  const [showContinueCue, setShowContinueCue] = useState(false);
  const hasListenedRef = useRef(false);
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
        const rows = Array.isArray(data) ? data : [];
        let catalogRowsForHomepage = rows;
        try {
          const enrichedRows = await api.getReceptionistCatalog();
          if (Array.isArray(enrichedRows) && enrichedRows.length > 0) catalogRowsForHomepage = enrichedRows;
        } catch {
          // Keep the public Supabase rows when the authenticated catalog route is unavailable.
        }
        catalogRowsForHomepage = catalogRowsForHomepage.filter((person) => (
          person.source !== 'created_receptionist' && person.created_receptionist_id == null && person.is_custom !== true
        ));
        const personalityIds = [...new Set(catalogRowsForHomepage.map((person) => person.personality_id).filter(Boolean))];
        const personalityMap = new Map();
        await Promise.all(personalityIds.map(async (personalityId) => {
          const personalityResponse = await fetch(`${supabaseUrl}/rest/v1/personalities?id=eq.${encodeURIComponent(personalityId)}&select=mbti,personality`, {
            headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
          });
          if (personalityResponse.ok) {
            const personalityRows = await personalityResponse.json();
            if (personalityRows[0]) personalityMap.set(String(personalityId), personalityRows[0]);
          }
        }));
        if (cancelled) return;
        setCatalogRows(catalogRowsForHomepage
          .filter((person) => person.id != null)
          .map((person) => ({
            ...person,
            personality: person.personality || personalityMap.get(String(person.personality_id)),
            catalog_id: person.catalog_id ?? person.id,
          })));
      } catch (error) {
        if (cancelled) return;
        console.error('Homepage receptionist catalog could not load.', error);
        setCatalogRows([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    if (!hasListenedRef.current) {
      setShowGestureHint(true);
      setGestureMode('pan');
    }
    setShowContinueCue(false);
    const timer = window.setTimeout(() => setShowContinueCue(true), 4500);
    return () => window.clearTimeout(timer);
  }, [active]);

  const handleGalleryInteraction = useCallback((interaction) => {
    if (interaction === 'tap') {
      hasListenedRef.current = true;
      setShowGestureHint(false);
      return;
    }
    if (interaction === 'drag' && !hasListenedRef.current) {
      setGestureMode('tap');
      setShowGestureHint(true);
    }
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
        showGalleryZoomControls={false}
        galleryDefaultZoom={typeof window !== 'undefined' && window.innerWidth > 1180 ? 2.05 : undefined}
        randomizeGalleryRoster
        galleryIntroReveal
        onGalleryInteraction={handleGalleryInteraction}
        interactive={active}
        portalDetail
      />
      {active && catalogRows?.length > 0 && showGestureHint && (
        <div className="homepage-catalog-gesture-hint" aria-hidden="true">
          <div className="homepage-catalog-gesture-icon">
            {gestureMode === 'pan' ? <Hand className="is-pan-hand" size={24} /> : <MousePointer2 size={25} />}
          </div>
          <span>{gestureMode === 'pan' ? 'Drag to explore' : 'Tap to listen'}</span>
          <small>Tap to listen</small>
        </div>
      )}
      {active && showContinueCue && (
        <button type="button" className="homepage-catalog-continue" onClick={onContinue} aria-label="Continue past receptionist catalog">
          <ArrowDown size={22} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
