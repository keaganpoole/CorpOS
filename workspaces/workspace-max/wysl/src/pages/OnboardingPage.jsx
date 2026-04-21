// src/pages/OnboardingPage.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import IdentityQuestionsSlide from '../components/onboarding/IdentityQuestionsSlide';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://keyquarters.onrender.com';

const SelectionItem = ({ label, selected, onClick, disabled = false }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={`w-full text-left p-3 text-sm border rounded-xl transition-all duration-200 ${selected ? 'bg-white/10 border-[#ef8f20]' : 'bg-transparent border-gray-700 hover:bg-white/5'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} md:p-4 md:text-base md:rounded-2xl`}>
        <span className={`font-semibold ${selected ? 'text-white' : 'text-white'}`}>{label}</span>
    </button>
);

const OnboardingPage = () => {
    const navigate = useNavigate();
    const { updateProfile } = useAuth();
    const [step, setStep] = useState(1);
    const [isLoaded, setIsLoaded] = useState(false);

    // Step 3 State
    const [selectedQuestions, setSelectedQuestions] = useState(['', '', '']);
    const [answers, setAnswers] = useState(['', '', '']);
    
    // Step 1 State
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [howHeard, setHowHeard] = useState('');
    const [otherHeard, setOtherHeard] = useState('');
    const [associateName, setAssociateName] = useState(''); // For friend's name

    // Step 2 State
    const [makes, setMakes] = useState([]);
    const [models, setModels] = useState([]);
    const [selectedMake, setSelectedMake] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [comfortLevel, setComfortLevel] = useState('');

    const [saveError, setSaveError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch device data for Step 2 dropdowns
    useEffect(() => {
        const fetchMakes = async () => {
            const { data, error } = await supabase.from('devices').select('make');
            if (!error) {
                const distinctMakes = [...new Set(data.map(device => device.make))].sort();
                setMakes(distinctMakes);
            }
        };
        fetchMakes();
    }, []);

    useEffect(() => {
        const fetchModels = async () => {
            if (selectedMake) {
                const { data, error } = await supabase.from('devices').select('model').eq('make', selectedMake);
                if (!error) {
                    const distinctModels = [...new Set(data.map(device => device.model))].sort();
                    setModels(distinctModels);
                }
            }
        };
        setSelectedModel('');
        setModels([]);
        fetchModels();
    }, [selectedMake]);




    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 10);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (typeof fbq === 'function') {
            fbq('track', 'CompleteRegistration');
        }
    }, []);

    const isStep1Complete = firstName.trim() !== '';
    const isHeardOtherSelected = howHeard === 'Other';
    const isFriendSelected = howHeard === 'A friend';
    const isStep2Complete = (selectedMake === 'other' ? selectedMake && comfortLevel : selectedMake && selectedModel && comfortLevel);
    const isStep3Complete = selectedQuestions.every(q => q !== '') && answers.every(a => a.trim() !== '');

    const nextStep = () => {
        if (step === 1 && !isStep1Complete) return;
        if (step === 2 && !isStep2Complete) return;
        if (step < 3) {
            setStep(step + 1);
        } else if (step === 3 && isStep3Complete) {
            saveOnboardingData();
        }
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const saveOnboardingData = async () => {
        setIsSaving(true);
        setSaveError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/auth'); return;
            }
            const device = {
                make: selectedMake,
                model: selectedModel,
            };
            const security_questions = selectedQuestions.map((question, index) => ({
                question: question,
                answer: answers[index],
            }));
            const dataToUpdate = {
                "first_name": firstName,
                "last_name": lastName.trim() || null,
                "device": device,
                "associate": associateName.trim() || null,
                "comfort_level": comfortLevel,
                "referral": howHeard === 'Other' ? otherHeard.trim() : howHeard,
                "identity_questions": security_questions,
            };
            const response = await axios.put(`${API_BASE_URL}/users/me`, dataToUpdate, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (response.status === 200) {
                updateProfile(response.data);
                navigate('/dashboard');
            }
        } catch (error) {
            setSaveError(error.response?.data?.detail || "Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const inputGroupClasses = "relative group";
    const inputClasses = "relative w-full px-5 py-3 bg-[#1c1c1c] border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-transparent transition-all peer";
    const labelClasses = "absolute left-4 -top-2 text-xs text-gray-400 bg-[#1c1c1c] px-2 rounded-md transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-focus:-top-2 peer-focus:text-xs";
    const selectClasses = `w-full text-left p-3 text-sm bg-[#f7f7f8] border border-gray-700 rounded-xl focus:outline-none focus:border-[#b5b6c4] transition-all appearance-none bg-no-repeat bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")] bg-[position:right_0.75rem_center] md:p-4 md:text-base md:rounded-2xl`;
    const gradientBorderClasses = "absolute -inset-px bg-gradient-to-r from-[#f7f7f8] to-[#b5b6c4] rounded-full opacity-0 group-focus-within:opacity-100 transition duration-150";
    const continueButtonClasses = "w-full py-3 font-semibold text-black bg-gradient-to-r from-[#ef8f20] to-[#ba5914] rounded-full hover:opacity-90 transition-all duration-300 shadow-lg shadow-[#f7f7f8]/10 disabled:opacity-50 disabled:cursor-not-allowed";

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/auth');
    };

    return (
        <div className="min-h-screen bg-black text-gray-300 flex justify-center p-4 font-inter antialiased pt-8 md:items-center">
            <div className={`w-full max-w-md md:max-w-2xl mx-auto transition-all duration-500 ease-in-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="w-full bg-gray-800 rounded-full h-1.5 mb-10">
                    <div className="bg-gradient-to-r from-[#ef8f20] to-[#ba5914] h-1.5 rounded-full transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}></div>
                </div>

                {step === 1 && (
                    <div className="space-y-6">
                        <h1 className="text-2xl font-bold text-white text-center md:text-3xl">Hey there. What's your name?</h1>
                        <div className={inputGroupClasses}><div className={gradientBorderClasses}></div><input id="firstName" type="text" placeholder=" " value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClasses} required /><label htmlFor="firstName" className={labelClasses}>First name *</label></div>
                        <div className={inputGroupClasses}><div className={gradientBorderClasses}></div><input id="lastName" type="text" placeholder=" " value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClasses} /><label htmlFor="lastName" className={labelClasses}>Last name (optional)</label></div>
                        <div className="pt-4">
                            <h2 className="text-base font-semibold text-white text-center mb-4 md:text-lg">How did you hear about us? (optional)</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{['Facebook', 'YouTube', 'Google', 'TikTok', 'A friend', 'Other'].map(source => (<SelectionItem key={source} label={source} selected={howHeard === source} onClick={() => setHowHeard(source)} />))}
                            </div>
                            {isHeardOtherSelected && (<div className={`${inputGroupClasses} mt-4 transition-all duration-300`}><div className={gradientBorderClasses}></div><input id="otherHeard" type="text" placeholder=" " value={otherHeard} onChange={(e) => setOtherHeard(e.target.value)} className={inputClasses} /><label htmlFor="otherHeard" className={labelClasses}>Please specify</label></div>)}
                            {isFriendSelected && (<div className={`${inputGroupClasses} mt-4 transition-all duration-300`}><div className={gradientBorderClasses}></div><input id="associateName" type="text" placeholder=" " value={associateName} onChange={(e) => setAssociateName(e.target.value)} className={inputClasses} /><label htmlFor="associateName" className={labelClasses}>Friend's name</label></div>)}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <h1 className="text-2xl font-bold text-white text-center md:text-3xl">Tell us about your setup</h1>
                        <p className="text-center text-gray-400 -mt-4 text-sm md:text-base">This helps us provide more accurate assistance.</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <select value={selectedMake} onChange={(e) => setSelectedMake(e.target.value)} className={`${selectClasses} ${selectedMake === '' ? 'text-gray-500' : 'text-black'}`} required><option value="" disabled>Choose Make</option><option value="other" className="text-black bg-white">Other</option>{makes.map(make => <option key={make} value={make} className="text-black bg-white">{make}</option>)}</select>
                            {selectedMake !== 'other' && (
                                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className={`${selectClasses} ${selectedModel === '' ? 'text-gray-500' : 'text-black'}`} disabled={!selectedMake && selectedMake !== 'not_sure'} required><option value="" disabled>Choose Model</option><option value="not_sure" className="text-black bg-white">I'm not sure</option>{models.map(model => <option key={model} value={model} className="text-black bg-white">{model}</option>)}</select>
                            )}
                        </div>
                        <select value={comfortLevel} onChange={(e) => setComfortLevel(e.target.value)} className={`${selectClasses} ${comfortLevel === '' ? 'text-gray-500' : 'text-black'}`} required><option value="" disabled>Your tech comfort level?</option><option value="basic" className="text-black bg-white">Basic</option><option value="intermediate" className="text-black bg-white">Intermediate</option><option value="advanced" className="text-black bg-white">Advanced</option></select>
                    </div>
                )}

                {step === 3 && (
                    <IdentityQuestionsSlide
                        selectedQuestions={selectedQuestions}
                        setSelectedQuestions={setSelectedQuestions}
                        answers={answers}
                        setAnswers={setAnswers}
                        inputGroupClasses={inputGroupClasses}
                        inputClasses={inputClasses}
                        labelClasses={labelClasses}
                        selectClasses={selectClasses}
                        gradientBorderClasses={gradientBorderClasses}
                    />
                )}

                <div className="mt-10 flex flex-col items-stretch gap-3">
                    <button onClick={nextStep} disabled={(step === 1 && !isStep1Complete) || (step === 2 && !isStep2Complete) || (step === 3 && !isStep3Complete) || isSaving} className={continueButtonClasses} style={{ background: 'linear-gradient(to right, var(--color1), var(--color2))' }}>{isSaving ? 'Saving...' : (step < 3 ? 'Continue' : 'Finish')}</button>
                </div>
                {saveError && <p className="text-sm text-red-500 text-center pt-4">{saveError}</p>}
                <div className="flex flex-col items-center mt-6">
                    {step > 1 && (
                        <button onClick={prevStep} disabled={isSaving} className="text-base py-1 px-2 text-gray-500 hover:text-black transition-colors duration-200 mb-4">Back</button>
                    )}
                    <button 
                        onClick={handleSignOut}
                        className="text-sm text-gray-500 hover:text-white transition-colors duration-200"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
