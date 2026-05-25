// src/components/ReferralHandler.jsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setCookie } from '../utils/cookieUtils';

const ReferralHandler = ({ referralSource }) => {
    const navigate = useNavigate();

    useEffect(() => {
        // Set a cookie indicating the referral source
        setCookie('referredBySales', 'true', 7); // Cookie lasts for 7 days
        console.log(`Referral from ${referralSource} detected. Cookie set.`);
        // Redirect to the homepage
        navigate('/', { replace: true });
    }, [referralSource, navigate]);

    return null; // This component doesn't render anything
};

export default ReferralHandler;