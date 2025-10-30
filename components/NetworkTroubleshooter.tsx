import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { SparklesIcon, NetworkIcon } from './Icons';

export const NetworkTroubleshooter: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const SYSTEM_INSTRUCTION = `You are an expert network engineer and IT support specialist. Your task is to provide clear, step-by-step troubleshooting guides for network-related problems.
    When a user describes an issue, provide a structured response.
    Start with the most likely and simplest solutions first, then move to more complex ones.
    For example:
    1.  **Check Physical Connections:** Ensure cables are plugged in.
    2.  **Restart Equipment:** Reboot the router and the user's computer.
    3.  **IP Configuration:** Guide the user to check their IP address using 'ipconfig' or 'ifconfig'.
    4.  **DNS Check:** Suggest pinging a known domain like google.com to test DNS.
    Format your response using Markdown for clarity.`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            if (!process.env.API_KEY) throw new Error("API Key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const result: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: prompt,
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
                <NetworkIcon /> AI Network Troubleshooter
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the network problem, e.g., 'User reports no internet access, but WiFi is connected.'"
                    className="w-full h-24 bg-gray-900/50 text-white placeholder-gray-500 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="w-full bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:bg-teal-800 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isLoading || !prompt.trim()}
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Diagnosing...' : 'Get Troubleshooting Steps'}
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
                    Analyzing problem and generating steps...
                </div>
            )}
        </div>
    );
};
