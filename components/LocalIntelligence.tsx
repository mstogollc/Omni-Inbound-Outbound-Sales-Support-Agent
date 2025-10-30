import React, { useState, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { Prospect } from '../types';
import { MapPinIcon, SparklesIcon } from './Icons';

interface MapGroundingSource {
    uri: string;
    title: string;
}

interface MapGroundingResponse {
    text: string;
    sources: MapGroundingSource[];
}

export const LocalIntelligence: React.FC<{ prospect: Prospect }> = ({ prospect }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState<MapGroundingResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                (err) => {
                    console.warn(`Geolocation error: ${err.message}`);
                    setError("Could not get your location. 'Nearby' queries may be less accurate.");
                }
            );
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            if (!process.env.API_KEY) {
                throw new Error("Gemini API Key is not configured.");
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const fullPrompt = `Regarding ${prospect.contact} at ${prospect.company}, ${query}`;

            const result: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: fullPrompt,
                config: {
                    tools: [{ googleMaps: {} }],
                    ...(userLocation && {
                        toolConfig: {
                            retrievalConfig: {
                                latLng: userLocation
                            }
                        }
                    })
                },
            });
            
            const text = result.text;
            const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            const sources: MapGroundingSource[] = groundingChunks
                .filter(chunk => chunk.maps)
                .map(chunk => ({
                    uri: chunk.maps.uri,
                    title: chunk.maps.title
                }));

            setResponse({ text, sources });

        } catch (err) {
            setError((err as Error).message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <MapPinIcon className="w-6 h-6 text-teal-400" />
                Local Intelligence
            </h2>
            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`e.g., "Find coffee shops near ${prospect.company}"`}
                    className="flex-grow bg-gray-900/50 text-white placeholder-gray-500 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:bg-teal-800 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={isLoading || !query.trim()}
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Thinking...' : 'Ask'}
                </button>
            </form>

            {error && <div className="p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">{error}</div>}

            {isLoading && <div className="text-center p-4 text-gray-400">Fetching location-based insights...</div>}
            
            {response && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg">
                    <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{response.text}</ReactMarkdown>
                    </div>
                    {response.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-700">
                            <h4 className="text-xs font-bold text-gray-400 mb-2">Sources:</h4>
                            <ul className="space-y-1">
                                {response.sources.map((source, index) => (
                                    <li key={index}>
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 hover:text-teal-300 hover:underline truncate">
                                            {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};