
import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { decode, decodeAudioData } from '../utils/audio';
import { SpeakerWaveIcon } from './Icons';

export const TtsPlayer: React.FC = () => {
    const [text, setText] = useState('Hello! I am an AI assistant powered by Gemini. You can type any text here and I will read it aloud for you.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const audioContextRef = useRef<AudioContext | null>(null);

    const handleSpeak = async () => {
        if (!text.trim() || isLoading) return;

        setIsLoading(true);
        setError('');

        try {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: text }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    audioContextRef.current,
                    24000,
                    1,
                );
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.start();
            } else {
                throw new Error("No audio data received from API.");
            }
        } catch (err) {
            console.error("Error with TTS:", err);
            setError("Failed to generate speech. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-[75vh] flex flex-col p-4 sm:p-6 bg-gray-800">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-teal-400">Text-to-Speech Player</h2>
                <p className="text-sm text-gray-400">
                    Convert text into natural-sounding speech with Gemini.
                </p>
            </div>
            <div className="flex flex-col gap-4 flex-1">
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text to be spoken..."
                    disabled={isLoading}
                    className="w-full flex-1 bg-gray-900 text-white p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-none"
                />
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                <button
                    onClick={handleSpeak}
                    disabled={isLoading || !text.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-teal-700 transition font-semibold"
                >
                    {isLoading ? (
                         <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>Generating...</span>
                         </>
                    ) : (
                        <>
                            <SpeakerWaveIcon className="w-6 h-6" />
                            <span>Speak</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
