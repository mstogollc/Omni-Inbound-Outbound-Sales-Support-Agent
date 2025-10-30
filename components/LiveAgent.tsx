import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audio';
import { SessionPromiseRef, Transcription } from '../types';
import { Cog6ToothIcon, SparklesIcon, StopIcon, UserIcon, PhoneIcon } from './Icons';

export const LiveAgent: React.FC = () => {
    const [isActive, setIsActive] = useState(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [notifications, setNotifications] = useState<string[]>([]);
    
    const sessionPromise: SessionPromiseRef = useRef(null);
    const inputAudioContext = useRef<AudioContext | null>(null);
    const outputAudioContext = useRef<AudioContext | null>(null);
    const mediaStream = useRef<MediaStream | null>(null);
    const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSource = useRef<MediaStreamAudioSourceNode | null>(null);

    const transcriptionContainerRef = useRef<HTMLDivElement | null>(null);
    const currentInputTranscription = useRef('');
    const currentOutputTranscription = useRef('');

    const nextStartTime = useRef(0);
    const audioPlaybackQueue = useRef(new Set<AudioBufferSourceNode>());

    const addNotification = useCallback((message: string) => {
        setNotifications(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
    }, []);

    const endCall = useCallback(() => {
        sessionPromise.current?.then(s => s.close());
        sessionPromise.current = null;
        scriptProcessor.current?.disconnect();
        mediaStreamSource.current?.disconnect();
        mediaStream.current?.getTracks().forEach(t => t.stop());
        inputAudioContext.current?.close().catch(() => {});
        outputAudioContext.current?.close().catch(() => {});
        setIsActive(false);
    }, []);

    useEffect(() => { return () => { endCall(); }; }, [endCall]);
    
    useEffect(() => {
        if (transcriptionContainerRef.current) {
            transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
        }
    }, [transcriptions]);

    const startCall = async () => {
        if (!process.env.API_KEY) {
            addNotification("Gemini API Key is not configured.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStream.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            setTranscriptions([]);
            setNotifications(['Attempting to establish connection...']);

            sessionPromise.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: "You are a helpful and friendly AI assistant. Keep your responses concise and clear.",
                    inputAudioTranscription: {}, outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        addNotification('Connection established.');
                        setIsActive(true);
                        mediaStreamSource.current = inputAudioContext.current!.createMediaStreamSource(stream);
                        scriptProcessor.current = inputAudioContext.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob: Blob = { data: encode(new Uint8Array(new Int16Array(inputData.map(v => v * 32768)).buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.current?.then((s) => s.sendRealtimeInput({ media: pcmBlob }));
                        };
                        mediaStreamSource.current.connect(scriptProcessor.current);
                        scriptProcessor.current.connect(inputAudioContext.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        if (message.serverContent?.outputTranscription) currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription.current.trim();
                            const fullOutput = currentOutputTranscription.current.trim();
                            const newTurns: Transcription[] = [];
                            if(fullInput) newTurns.push({ text: fullInput, source: 'user' });
                            if(fullOutput) newTurns.push({ text: fullOutput, source: 'model' });

                            if(newTurns.length > 0) setTranscriptions(p => [...p, ...newTurns]);
                            currentInputTranscription.current = '';
                            currentOutputTranscription.current = '';
                        }
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio) {
                            nextStartTime.current = Math.max(nextStartTime.current, outputAudioContext.current!.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext.current!, 24000, 1);
                            const source = outputAudioContext.current!.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.current!.destination);
                            source.addEventListener('ended', () => audioPlaybackQueue.current.delete(source));
                            source.start(nextStartTime.current);
                            nextStartTime.current += audioBuffer.duration;
                            audioPlaybackQueue.current.add(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => { addNotification(`Error: ${e.message}`); endCall(); },
                    onclose: () => { addNotification('Session ended.'); endCall(); },
                },
            });
        } catch (error) { addNotification(`Failed to start session: ${(error as Error).message}`); endCall(); }
    };

    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-3">Live AI Agent</h3>
            <div ref={transcriptionContainerRef} className="flex-1 overflow-y-auto mb-4 space-y-3 p-2 bg-gray-900/50 rounded-lg min-h-[250px] max-h-[250px]">
                {transcriptions.map((t, i) => (
                     <div key={i} className={`flex items-start gap-2 ${t.source === 'user' ? 'justify-end' : ''}`}>
                        {t.source === 'model' && <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-white" /></div>}
                        <div className={`p-2.5 rounded-lg max-w-sm text-sm ${t.source === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>{t.text}</div>
                        {t.source === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UserIcon className="w-4 h-4 text-white" /></div>}
                    </div>
                ))}
            </div>
             <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                {!isActive ? (
                    <button onClick={startCall} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition">
                        <PhoneIcon /> Start Session
                    </button>
                ) : (
                    <button onClick={endCall} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">
                        <StopIcon /> End Session
                    </button>
                )}
                <div className={`flex items-center gap-2 text-sm ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                    <span className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                    {isActive ? 'Active' : 'Inactive'}
                </div>
            </div>
            <div className="mt-3 p-2 bg-gray-900/50 rounded-lg text-xs font-mono text-gray-400 space-y-1 h-[100px] overflow-y-auto">
                <p className="font-bold text-gray-300 flex items-center gap-1"><Cog6ToothIcon className="w-4 h-4"/> System:</p>
                {notifications.length > 0 ? notifications.map((n, i) => <p key={i} className="whitespace-pre-wrap">&gt; {n}</p>) : <p>&gt; Waiting to start session...</p>}
            </div>
        </div>
    );
};
