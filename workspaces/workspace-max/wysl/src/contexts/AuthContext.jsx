// src/contexts/AuthContext.jsx — Sonar Auth (simplified, no WYSL backend)

import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);
    const [isAppLoading, setIsAppLoading] = useState(false);
    const currentUserIdRef = useRef(null);

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
        };

        const { data: createdProfile, error: upsertError } = await supabase
            .from('users')
            .upsert(fallbackProfile, { onConflict: 'id' })
            .select()
            .single();

        if (upsertError) {
            throw upsertError;
        }

        return createdProfile || fallbackProfile;
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
                console.error('[Auth] Failed to hydrate user profile:', error);
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
            setProfile(data || null);
            setIsProfileLoaded(true);
            return data || null;
        },
        login: async (email, password) => {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        },
        logout: async () => {
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
