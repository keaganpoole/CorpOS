import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Hand, MousePointer2, Pointer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../sonar/lib/api';
import HireReceptionistModal from '../sonar/pages/HireReceptionistModal';
import '../sonar/studio/studio.css';
import '../sonar/studio/receptionistGallery.css';
import './HomepageReceptionistCatalog.css';

const catalogFields = 'id,full_name,description,stereotype,avatar,avatar_video,traits,voice,age,first_name,is_active,showcase_in_hero,hero_avatar,banner_id,gender,personality_id,personality:personalities!receptionist_catalog_personality_id_fkey(mbti,personality)';

export default function HomepageReceptionistCatalog({ active, ambientDrift, onContinue }) {
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
        catalogRowsForHomepage = catalogRowsForHomepage.filter((person) => (
          person.source !== 'created_receptionist' && person.created_receptionist_id == null && person.is_custom !== true
        ));
        if (cancelled) return;
        setCatalogRows(catalogRowsForHomepage
          .filter((person) => person.id != null)
          .map((person) => ({
            ...person,
            personality: Array.isArray(person.personality) ? person.personality[0] : person.personality,
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
    if (!active) {
      setShowContinueCue(false);
      return undefined;
    }
    if (!hasListenedRef.current) {
      setShowGestureHint(true);
      setGestureMode('pan');
    }
    setShowContinueCue(false);
    const timer = window.setTimeout(() => setShowContinueCue(true), 3000);
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
      <div className="ns-persistent-wordmark homepage-catalog-wordmark" style={{ opacity: active ? 1 : 0, transition: 'opacity 500ms ease-out' }} aria-label="Receptionist collection">Receptionist <span>collection</span></div>
      <div className="homepage-catalog-ambient-drift" data-drifting={ambientDrift ? 'true' : 'false'}>
        <div className="homepage-catalog-ambient-drift-y">
          <HireReceptionistModal
            embedded
            catalogRows={catalogRows}
            onHire={hire}
            autoPlayOnOpen
            hideVoiceButton
            allowGalleryWheelZoom={false}
            showGalleryZoomControls={false}
            galleryDefaultZoom={typeof window !== 'undefined' && window.innerWidth > 1180 ? 2.05 : undefined}
            galleryRosterConfig={{ seed: 'homepage-receptionist-order-v2', featuredNames: ['brice', 'piper', 'bonnie'] }}
            galleryIntroReveal
            onGalleryInteraction={handleGalleryInteraction}
            interactive={active}
            portalDetail
          />
        </div>
      </div>
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
        <div className="homepage-catalog-continue-surface">
          <button type="button" className="homepage-catalog-continue" onClick={onContinue} aria-label="Tap to continue">
            <Pointer className="homepage-catalog-swipe-icon" size={30} aria-hidden="true" />
            <span>Tap to continue</span>
          </button>
        </div>
      )}
    </div>
  );
}
