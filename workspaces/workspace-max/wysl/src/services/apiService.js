// src/services/apiService.js — Sonar API Service
import axios from 'axios';
import { supabase } from '../supabaseClient';

// No external backend for the marketing site — Sonar dashboard connects directly
const api = axios.create({ baseURL: '' });

// Visitor tracking (public, no auth needed)
export const trackVisitor = async (userAgent) => {
    try {
        // Log visitor to Supabase if needed
        console.log('[Visitor]', userAgent);
    } catch (error) {
        console.error('[Visitor] Tracking failed:', error);
    }
};

export default api;
