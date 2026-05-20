// src/contexts/AuthContext.jsx — Sonar Auth (simplified, no WYSL backend)

import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAppLoading, setIsAppLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const ensureProfile = async (user) => {
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
        };

        const hydrateAuthState = async (nextSession) => {
            if (!isMounted) return;
            setSession(nextSession);

            if (nextSession?.user) {
                try {
                    const data = await ensureProfile(nextSession.user);
                    if (isMounted) setProfile(data || null);
                } catch {
                    if (isMounted) setProfile(null);
                }
            } else if (isMounted) {
                setProfile(null);
            }

            if (isMounted) setIsLoading(false);
        };

        supabase.auth.getSession().then(({ data }) => {
            hydrateAuthState(data.session ?? null);
        }).catch(() => {
            if (isMounted) {
                setSession(null);
                setProfile(null);
                setIsLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                await hydrateAuthState(session);
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

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
