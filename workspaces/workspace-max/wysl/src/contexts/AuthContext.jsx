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

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!isMounted) return;
                setSession(session);

                if (session?.user) {
                    // Fetch basic profile from Sonar Supabase
                    try {
                        const { data } = await supabase
                            .from('users')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                        if (isMounted) setProfile(data || null);
                    } catch {
                        if (isMounted) setProfile(null);
                    }
                } else {
                    setProfile(null);
                }

                if (isMounted) setIsLoading(false);
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
