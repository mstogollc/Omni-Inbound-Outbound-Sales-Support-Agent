import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { SparklesIcon } from './Icons';

interface Message {
    text: string;
    isUser: boolean;
    sources?: { uri: string; title: string }[];
}

export const GroundedChat: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isLoading) return;

        const userMessage: Message = { text: query, isUser: true };
        setMessages(prev => [...prev, userMessage]);
        setQuery('');
        setIsLoading(true);
        setError(null);

        try {
            if (!process.env.API_KEY) throw new Error("API Key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const result: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: query,
                config: { tools: [{ googleSearch: {} }] },
            });
            
            const text = result.text;
            const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            const sources = groundingChunks
                .filter(chunk => chunk.web)
                .map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title }))
                // Deduplicate sources
                .filter((source, index, self) => index === self.findIndex(s => s.uri === source.uri));

            const modelMessage: Message = { text, isUser: false, sources };
            setMessages(prev => [...prev, modelMessage]);

        } catch (err) {
            setError((err as Error).message || "An unknown error occurred.");
            const errorMessage: Message = { text: "Sorry, I ran into an error. Please try again.", isUser: false };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg flex flex-col h-full">
            <h3 className="text-lg font-semibold text-white mb-3">AI Research Assistant</h3>
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-2 bg-gray-900/50 rounded-lg min-h-[300px]">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}>
                        <div className={`p-2.5 rounded-lg max-w-xl text-sm ${msg.isUser ? 'bg-blue-600' : 'bg-gray-700'}`}>
                           <div className="prose prose-sm prose-invert max-w-none"><ReactMarkdown>{msg.text}</ReactMarkdown></div>
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                             <div className="mt-2 text-xs text-gray-400 w-full max-w-xl">
                                <strong>Sources:</strong>
                                <ul className="list-disc list-inside ml-1">
                                    {msg.sources.map((source, i) => (
                                        <li key={i} className="truncate">
                                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:text-teal-400 hover:underline">
                                                {source.title || source.uri}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
                 {isLoading && <div className="text-sm text-gray-400">Thinking...</div>}
                <div ref={messagesEndRef} />
            </div>
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask a research question..."
                    className="flex-grow bg-gray-900 text-white placeholder-gray-500 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    disabled={isLoading}
                />
                <button type="submit" className="bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:bg-teal-800 disabled:cursor-not-allowed" disabled={isLoading || !query.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
};
