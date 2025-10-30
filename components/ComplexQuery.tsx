
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';

export const ComplexQuery: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setError('');
        setResponse('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    thinkingConfig: { thinkingBudget: 32768 }
                }
            });
            setResponse(result.text);
        } catch (err) {
            console.error("Error with complex query:", err);
            setError("Failed to get a response. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[75vh] flex flex-col p-4 sm:p-6 bg-gray-800">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-teal-400">Complex Query Analyzer</h2>
                <p className="text-sm text-gray-400">
                    Use Gemini 2.5 Pro with maximum "thinking budget" for your most complex problems, such as coding, advanced reasoning, or strategic planning.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter your complex prompt here..."
                    disabled={isLoading}
                    className="w-full h-32 bg-gray-900 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-none"
                />
                <button
                    type="submit"
                    disabled={isLoading || !prompt.trim()}
                    className="w-full sm:w-auto self-start px-6 py-2 bg-teal-600 text-white rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-teal-700 transition font-semibold"
                >
                    {isLoading ? 'Analyzing...' : 'Analyze'}
                </button>
            </form>
            <div className="mt-6 flex-1 overflow-y-auto bg-gray-900/50 p-4 rounded-lg">
                {isLoading && (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
                    </div>
                )}
                {error && <p className="text-red-400">{error}</p>}
                {response && (
                    <div className="prose prose-sm prose-invert max-w-none">
                         <Markdown>{response}</Markdown>
                    </div>
                )}
            </div>
        </div>
    );
};
