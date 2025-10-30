import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { SparklesIcon, EnvelopeIcon } from './Icons';

type EmailType = 'New User Onboarding' | 'Support Ticket Response' | 'Client Follow-up';

export const EmailGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [emailType, setEmailType] = useState<EmailType>('New User Onboarding');
    const [response, setResponse] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const SYSTEM_INSTRUCTION = `You are a professional business communication assistant for OmniTech, an IT services company.
    Your task is to generate clear, concise, and friendly emails based on the user's request.
    The tone should be helpful and professional.
    Format the output as a complete email, including a subject line (e.g., "Subject: Your New OmniTech Account").
    Use markdown for formatting like bolding and bullet points.`;

    const getPlaceholderText = () => {
        switch (emailType) {
            case 'New User Onboarding':
                return "User: John Doe, Company: Innovate LLC, Temporary Password: 'ChangeMe123!'. Mention setting up OmniTalk VoIP.";
            case 'Support Ticket Response':
                return "Ticket #12345, Issue: Cannot print. Resolution: Restarted the print spooler service on the server. The issue is now resolved.";
            case 'Client Follow-up':
                return "Follow up with Jane Smith from Synergy Corp about our meeting last week. Reiterate the benefits of the OmniSupport package we discussed.";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            if (!process.env.API_KEY) throw new Error("API Key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const fullPrompt = `Generate a "${emailType}" email with the following details: ${prompt}`;

            const result: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: fullPrompt,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                },
            });
            
            setResponse(result.text);

        } catch (err) {
            setError((err as Error).message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg h-full flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <EnvelopeIcon /> AI Email Generator
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
                 <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-300">Email Type:</label>
                    <select
                        value={emailType}
                        onChange={(e) => setEmailType(e.target.value as EmailType)}
                        className="bg-gray-900/50 text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition text-sm"
                    >
                        <option>New User Onboarding</option>
                        <option>Support Ticket Response</option>
                        <option>Client Follow-up</option>
                    </select>
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`Provide key details...\n e.g., ${getPlaceholderText()}`}
                    className="w-full h-24 bg-gray-900/50 text-white placeholder-gray-500 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="w-full bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:bg-teal-800 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isLoading || !prompt.trim()}
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Drafting...' : 'Generate Email'}
                </button>
            </form>

            {error && <div className="mt-4 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">{error}</div>}

            {response && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg flex-1 overflow-y-auto">
                    <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{response}</ReactMarkdown>
                    </div>
                </div>
            )}
             {isLoading && (
                <div className="mt-4 p-4 text-center text-gray-400">
                    Drafting {emailType} email...
                </div>
            )}
        </div>
    );
};
