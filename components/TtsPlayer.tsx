import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audio';

export const TtsPlayer: React.FC = () => {
    const [text, setText] = useState('Hello! I am an AI voice from OmniTech. How can I help you today?');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const audioContext = useRef<AudioContext | null>(null);
    const audioSource = useRef<AudioBufferSourceNode | null>(null);

    const handleGenerateAndPlay = async () => {
        if (!text.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);

        // Stop any currently playing audio
        if (audioSource.current) {
            audioSource.current.stop();
        }
        if (!audioContext.current || audioContext.current.state === 'closed') {
            audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }

        try {
            if (!process.env.API_KEY) throw new Error("API Key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                    },
                },
            });
            
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) {
                throw new Error("No audio data received from API.");
            }

            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                audioContext.current,
                24000,
                1
            );
            
            const source = audioContext.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.current.destination);
            source.start();
            audioSource.current = source;

        } catch (err) {
            setError((err as Error).message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Text-to-Speech Player</h3>
            <div className="space-y-3">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text to generate audio..."
                    className="w-full h-28 bg-gray-900/50 text-white placeholder-gray-500 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    disabled={isLoading}
                />
                <button
                    onClick={handleGenerateAndPlay}
                    className="w-full bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:bg-teal-800 disabled:cursor-not-allowed"
                    disabled={isLoading || !text.trim()}
                >
                    {isLoading ? 'Generating Audio...' : 'Generate & Play'}
                </button>
            </div>
            {error && <div className="mt-3 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">{error}</div>}
        </div>
    );
};
