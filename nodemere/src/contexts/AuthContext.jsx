// src/contexts/AuthContext.jsx — Sonar Auth (simplified, no Nodemere backend)

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { supabase, setWorkforceContext } from '../supabaseClient';
import { needsMfa } from '../lib/workforceSecurity';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(false);
    const currentUserIdRef = useRef(null);
    const [workforce, setWorkforce] = useState(null);
    const refreshWorkforce = useCallback(async () => {
        const { data } = await supabase.auth.getSession();
        const active = data.session;
        if (!active) { setWorkforce(null); setWorkforceContext(null); return null; }
        try {
            const response = await fetch(`${window.sonar?.apiUrl || import.meta.env.VITE_API_URL || ''}/api/workforce/session`, { headers: { Authorization: `Bearer ${active.access_token}` } });
            if (!response.ok) throw new Error('Workforce access is unavailable. Check that the backend and security migrations are ready.');
            const body = await response.json();
            const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
            if (assurance.error) throw new Error('Could not verify authentication assurance. Please sign in again.');
            const value = { tenant: body.tenant, policy_requires_mfa: body.policy_requires_mfa, needsMfa: needsMfa(assurance.data, body.tenant) };
            if (currentUserIdRef.current !== active.user.id) return null;
            setWorkforceContext(body.tenant); setWorkforce(value); return value;
        } catch (error) {
            if (currentUserIdRef.current === active.user.id) { setWorkforceContext(null); setWorkforce({ error: error.message }); }
            return null;
        }
    }, []);

    useEffect(() => {
        if (session?.access_token) refreshWorkforce();
        else { setWorkforce(null); setWorkforceContext(null); }
    }, [session?.access_token, refreshWorkforce]);
    useEffect(() => {
        if (!session?.user) return undefined;
        const timer = setInterval(refreshWorkforce, 60000);
        window.addEventListener('focus', refreshWorkforce);
        return () => { clearInterval(timer); window.removeEventListener('focus', refreshWorkforce); };
    }, [session?.user?.id, refreshWorkforce]);

    const ensureProfile = useCallback(async (user) => {
        const { data: existingProfile, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        if (!error && existingProfile) {
            return existingProfile;
        }

        const fallbackProfile = {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            phone: user.user_metadata?.phone || null,
            onboarded: false,
        };

        return fallbackProfile;
    }, []);

    useEffect(() => {
        currentUserIdRef.current = session?.user?.id ?? null;
    }, [session?.user?.id]);

    useEffect(() => {
        let isMounted = true;

        supabase.auth.getSession().then(({ data }) => {
            if (!isMounted) return;
            const nextSession = data.session ?? null;
            setSession(nextSession);
            setIsProfileLoaded(!nextSession?.user);
            setIsSessionLoading(false);
        }).catch(() => {
            if (isMounted) {
                setSession(null);
                setProfile(null);
                setIsProfileLoaded(true);
                setIsSessionLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, nextSession) => {
                const nextUserId = nextSession?.user?.id ?? null;
                const isSameUser = Boolean(nextUserId && nextUserId === currentUserIdRef.current);

                setSession(nextSession ?? null);

                if (!nextUserId) {
                    setWorkforce(null);
                    setWorkforceContext(null);
                    supabase.removeAllChannels();
                    setProfile(null);
                    setIsProfileLoaded(true);
                    return;
                }

                if (!isSameUser) {
                    setIsProfileLoaded(false);
                }
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (isSessionLoading) return undefined;

        if (!session?.user) {
            setProfile(null);
            setIsProfileLoaded(true);
            return undefined;
        }

        let isCancelled = false;
        setIsProfileLoaded(false);

        ensureProfile(session.user)
            .then((data) => {
                if (!isCancelled) setProfile(data || null);
            })
            .catch((error) => {
                console.error("AuthContext.jsx:event_136");
                if (!isCancelled) setProfile(null);
            })
            .finally(() => {
                if (!isCancelled) setIsProfileLoaded(true);
            });

        return () => {
            isCancelled = true;
        };
    }, [ensureProfile, isSessionLoading, session?.user?.id]);

    const isLoading = isSessionLoading || Boolean(session?.user && !isProfileLoaded);

    const value = {
        session,
        workforce,
        refreshWorkforce,
        profile,
        isLoading,
        isAppLoading,
        setIsAppLoading,
        refreshProfile: async () => {
            if (!session?.user) return null;
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
            const nextProfile = data || {
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || null,
                phone: session.user.user_metadata?.phone || null,
                onboarded: true,
            };
            setProfile(nextProfile);
            setIsProfileLoaded(true);
            return nextProfile;
        },
        login: async (email, password) => {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        },
        logout: async () => {
            setWorkforce(null);
            setWorkforceContext(null);
            setProfile(null);
            await supabase.removeAllChannels();
            await supabase.auth.signOut();
        },
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
