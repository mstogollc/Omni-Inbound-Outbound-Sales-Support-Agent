
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audio';
import { SYSTEM_PROMPT, FUNCTION_DECLARATIONS } from '../services/geminiService';
import { Cog6ToothIcon, InformationCircleIcon, PhoneIcon, StopIcon, UserIcon, SparklesIcon } from './Icons';

interface Transcription {
    text: string;
    source: 'user' | 'model';
}

export const LiveAgent: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [notifications, setNotifications] = useState<string[]>([]);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);

    const sessionPromise = useRef<Promise<LiveSession> | null>(null);
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

    useEffect(() => {
        return () => {
            endSession();
        };
    }, []);

    useEffect(() => {
        if (isAutoScrollEnabled && transcriptionContainerRef.current) {
            transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
        }
    }, [transcriptions, isAutoScrollEnabled]);


    const addNotification = (message: string) => {
        setNotifications(prev => [...prev.slice(-4), message]); // Keep last 5 notifications
    };

    const handleToolCall = (functionCall: any) => {
        const { name, args } = functionCall;
        const argsString = JSON.stringify(args, null, 2);
        addNotification(`Tool Call: ${name}\nArguments: ${argsString}`);

        // In a real app, you would execute the function here.
        // For this demo, we'll just send a confirmation back.
        const result = `Function ${name} executed successfully.`;

        sessionPromise.current?.then((session) => {
            session.sendToolResponse({
                functionResponses: {
                    id: functionCall.id,
                    name: functionCall.name,
                    response: { result: result },
                }
            });
        });
    };

    const startSession = async () => {
        addNotification('Starting session...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStream.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            setTranscriptions([]);
            currentInputTranscription.current = '';
            currentOutputTranscription.current = '';

            sessionPromise.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: SYSTEM_PROMPT,
                    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        addNotification('Session opened. Microphone is active.');
                        setIsSessionActive(true);

                        mediaStreamSource.current = inputAudioContext.current!.createMediaStreamSource(stream);
                        scriptProcessor.current = inputAudioContext.current!.createScriptProcessor(4096, 1, 1);

                        scriptProcessor.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        mediaStreamSource.current.connect(scriptProcessor.current);
                        scriptProcessor.current.connect(inputAudioContext.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        }
                        if (message.serverContent?.outputTranscription) {
                            currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        }

                        if (message.toolCall) {
                            message.toolCall.functionCalls.forEach(handleToolCall);
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription.current.trim();
                            const fullOutput = currentOutputTranscription.current.trim();

                            setTranscriptions(prev => {
                                let newTranscriptions = [...prev];
                                if (fullInput) newTranscriptions.push({ text: fullInput, source: 'user' });
                                if (fullOutput) newTranscriptions.push({ text: fullOutput, source: 'model' });
                                return newTranscriptions;
                            });

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
                            
                            source.addEventListener('ended', () => {
                                audioPlaybackQueue.current.delete(source);
                            });
                            
                            source.start(nextStartTime.current);
                            nextStartTime.current += audioBuffer.duration;
                            audioPlaybackQueue.current.add(source);
                        }
                        
                        if (message.serverContent?.interrupted) {
                            addNotification('Model speech interrupted.');
                            for (const source of audioPlaybackQueue.current.values()) {
                                source.stop();
                                audioPlaybackQueue.current.delete(source);
                            }
                            nextStartTime.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        addNotification(`Error: ${e.message}`);
                        console.error(e);
                        endSession();
                    },
                    onclose: () => {
                        addNotification('Session closed.');
                        setIsSessionActive(false);
                    },
                },
            });

        } catch (error) {
            addNotification(`Failed to start session: ${error}`);
            console.error("Session start error:", error);
            endSession();
        }
    };

    const endSession = () => {
        if (sessionPromise.current) {
            sessionPromise.current.then(session => session.close());
            sessionPromise.current = null;
        }
        
        scriptProcessor.current?.disconnect();
        scriptProcessor.current = null;
        mediaStreamSource.current?.disconnect();
        mediaStreamSource.current = null;
        
        mediaStream.current?.getTracks().forEach(track => track.stop());
        mediaStream.current = null;

        inputAudioContext.current?.close();
        outputAudioContext.current?.close();
        
        setIsSessionActive(false);
    };

    const TranscriptionBubble: React.FC<{ transcription: Transcription }> = ({ transcription }) => (
        <div className={`flex items-start gap-3 ${transcription.source === 'user' ? 'justify-end' : ''}`}>
            {transcription.source === 'model' && (
                <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                    <SparklesIcon className="w-5 h-5 text-white" />
                </div>
            )}
            <div className={`p-3 rounded-lg max-w-lg ${transcription.source === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                <p className="text-sm">{transcription.text}</p>
            </div>
            {transcription.source === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-white" />
                </div>
            )}
        </div>
    );

    return (
        <div className="h-[75vh] flex flex-col p-4 bg-gray-800">
            <div ref={transcriptionContainerRef} className="flex-1 overflow-y-auto mb-4 space-y-4 p-2">
                {transcriptions.map((t, i) => <TranscriptionBubble key={i} transcription={t} />)}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <div className="flex items-center gap-4">
                    {!isSessionActive ? (
                        <button onClick={startSession} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition">
                            <PhoneIcon /> Start Call
                        </button>
                    ) : (
                        <button onClick={endSession} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">
                            <StopIcon /> End Call
                        </button>
                    )}
                    <div className={`flex items-center gap-2 text-sm ${isSessionActive ? 'text-green-400' : 'text-gray-400'}`}>
                        <span className={`w-3 h-3 rounded-full ${isSessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                        {isSessionActive ? 'Active' : 'Inactive'}
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="autoScroll"
                        checked={isAutoScrollEnabled}
                        onChange={(e) => setIsAutoScrollEnabled(e.target.checked)}
                        className="w-4 h-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="autoScroll" className="text-sm text-gray-400 cursor-pointer">Auto-scroll</label>
                </div>
            </div>

            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg min-h-[100px] text-xs font-mono text-gray-400 space-y-1 overflow-y-auto">
                <p className="font-bold text-gray-300 flex items-center gap-1"><Cog6ToothIcon /> System Notifications:</p>
                {notifications.length > 0 ? notifications.map((n, i) => (
                    <p key={i} className="whitespace-pre-wrap">&gt; {n}</p>
                )) : <p>&gt; Waiting for session to start...</p>}
            </div>
        </div>
    );
};
