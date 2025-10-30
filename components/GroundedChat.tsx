
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage, GroundingSource } from '../types';
import { PaperAirplaneIcon, SparklesIcon, UserIcon } from './Icons';
import Markdown from 'react-markdown';

export const GroundedChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', content: "Hello! I can answer questions using up-to-date information from Google Search and Maps. What would you like to know?" }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            () => {
                console.warn("Geolocation permission denied. Maps grounding may be less accurate.");
            }
        );
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;

        const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userInput }];
        setMessages(newMessages);
        setUserInput('');
        setIsLoading(true);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: userInput,
                config: {
                    tools: [{ googleSearch: {} }, { googleMaps: {} }],
                    ...(location && {
                        toolConfig: {
                            retrievalConfig: {
                                latLng: {
                                    latitude: location.latitude,
                                    longitude: location.longitude
                                }
                            }
                        }
                    })
                },
            });
            
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            const sources: GroundingSource[] = groundingChunks.map((chunk: any) => {
                if (chunk.web) {
                    return { uri: chunk.web.uri, title: chunk.web.title, type: 'web' };
                }
                if (chunk.maps) {
                    return { uri: chunk.maps.uri, title: chunk.maps.title, type: 'maps' };
                }
                return null;
            }).filter((source: any): source is GroundingSource => source !== null);

            setMessages([...newMessages, { role: 'model', content: response.text, sources }]);
        } catch (error) {
            console.error("Error with grounded chat:", error);
            const errorMessage = "Sorry, I encountered an error. Please try again.";
            setMessages([...newMessages, { role: 'model', content: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[75vh] flex flex-col p-4 bg-gray-800">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 p-2">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                         {msg.role === 'model' && (
                            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                                <SparklesIcon className="w-5 h-5 text-white" />
                            </div>
                        )}
                        <div className={`p-3 rounded-lg max-w-xl ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                             <div className="prose prose-sm prose-invert max-w-none">
                                <Markdown>{msg.content}</Markdown>
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-600">
                                    <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                                    <ul className="text-xs space-y-1">
                                        {msg.sources.map((source, i) => (
                                            <li key={i}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline break-all">
                                                    [{source.type === 'web' ? 'Web' : 'Map'}] {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                           <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                                <UserIcon className="w-5 h-5 text-white" />
                           </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                     <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                            <SparklesIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="p-3 rounded-lg bg-gray-700 flex items-center gap-2">
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
                             <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex items-center gap-3 pt-4 border-t border-gray-700">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Ask a question..."
                    disabled={isLoading}
                    className="flex-1 w-full bg-gray-700 text-white placeholder-gray-400 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
                <button
                    type="submit"
                    disabled={isLoading || !userInput.trim()}
                    className="p-3 bg-teal-600 text-white rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-teal-700 transition"
                >
                    <PaperAirplaneIcon className="w-6 h-6" />
                </button>
            </form>
        </div>
    );
};
