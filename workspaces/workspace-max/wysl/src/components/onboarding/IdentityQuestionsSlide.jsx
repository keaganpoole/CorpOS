// src/components/onboarding/IdentityQuestionsSlide.jsx

import React from 'react';

const identityQuestionsList = [
    "What was your childhood nickname?",
    "What is the name of your favorite childhood friend?",
    "What is your oldest sibling's middle name?",
    "What was the first car you owned?",
    "What is your mother's maiden name?",
    "What is the name of the street you grew up on?",
    "What was the name of your first pet?",
    "What is your favorite book?",
    "What is your favorite movie?",
    "What is your favorite food?",
    "What is the name of your elementary school?",
    "What is your favorite sports team?",
    "What is your dream travel destination?",
    "What is the name of your favorite teacher?",
    "What is your favorite color?",
    "What is the model of your first phone?",
    "What is your favorite animal?",
    "What is your favorite song?",
    "What is your favorite hobby?",
    "What is the name of your favorite fictional character?",
];

const IdentityQuestionsSlide = ({
    selectedQuestions,
    setSelectedQuestions,
    answers,
    setAnswers,
    inputGroupClasses,
    inputClasses,
    labelClasses,
    selectClasses,
    gradientBorderClasses,
}) => {
    const handleQuestionChange = (index, value) => {
        const newSelectedQuestions = [...selectedQuestions];
        newSelectedQuestions[index] = value;
        setSelectedQuestions(newSelectedQuestions);
        // Clear the answer when the question changes
        const newAnswers = [...answers];
        newAnswers[index] = '';
        setAnswers(newAnswers);
    };

    const handleAnswerChange = (index, value) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white text-center md:text-3xl">Secure Your Account</h1>
            <p className="text-center text-gray-400 -mt-4 text-sm md:text-base">Choose 3 security questions and provide your answers. These are required to help keep your account safe.</p>

            {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-4">
                    <select
                        value={selectedQuestions[index] || ''}
                        onChange={(e) => handleQuestionChange(index, e.target.value)}
                        className={`${selectClasses} ${selectedQuestions[index] === '' ? 'text-gray-500' : 'text-black'}`}
                        required
                    >
                        <option value="" disabled>Choose Question {index + 1}</option>
                        {identityQuestionsList.map((question) => (
                            <option
                                key={question}
                                value={question}
                                className="text-white bg-[#1c1c1c]"
                                disabled={selectedQuestions.includes(question) && selectedQuestions[index] !== question}
                            >
                                {question}
                            </option>
                        ))}
                    </select>
                    <div className={inputGroupClasses}>
                        <div className={gradientBorderClasses}></div>
                        <input
                            id={`answer-${index}`}
                            type="text"
                            placeholder=" "
                            value={answers[index] || ''}
                            onChange={(e) => handleAnswerChange(index, e.target.value)}
                            className={inputClasses}
                            required
                            disabled={!selectedQuestions[index]}
                        />
                        <label htmlFor={`answer-${index}`} className={labelClasses}>Answer {index + 1} *</label>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default IdentityQuestionsSlide;
