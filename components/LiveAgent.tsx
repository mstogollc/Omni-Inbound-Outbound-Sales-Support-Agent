
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audio';
import { SYSTEM_PROMPT, FUNCTION_DECLARATIONS } from '../services/geminiService';
import { Cog6ToothIcon, InformationCircleIcon, PhoneIcon, StopIcon } from './Icons';

interface Transcription {
    text: string;
    source: 'user' | 'model';
}

export const LiveAgent: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [notifications, setNotifications] = useState<string[]>([]);
    
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const currentInputTranscriptionRef = useRef('');
    const currentOutputTranscriptionRef = useRef('');
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const transcriptEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcriptions, notifications]);


    const addNotification = (message: string) => {
        setNotifications(prev => [...prev, message]);
    };

    const handleToggleSession = async () => {
        if (isSessionActive) {
            // Stop session
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => session.close());
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if(scriptProcessorRef.current) {
                scriptProcessorRef.current.disconnect();
            }
            if(mediaStreamSourceRef.current) {
                mediaStreamSourceRef.current.disconnect();
            }
            if(inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
                inputAudioContextRef.current.close();
            }
            if(outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
                outputAudioContextRef.current.close();
            }
            
            setIsSessionActive(false);
            sessionPromiseRef.current = null;
            addNotification("Call ended.");
        } else {
            // Start session
            setTranscriptions([]);
            setNotifications([]);
            currentInputTranscriptionRef.current = '';
            currentOutputTranscriptionRef.current = '';
            nextStartTimeRef.current = 0;
            addNotification("Connecting...");

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                streamRef.current = stream;

                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

                inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                
                sessionPromiseRef.current = ai.live.connect({
                    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                    callbacks: {
                        onopen: () => {
                            setIsSessionActive(true);
                            addNotification("Connection open. Start speaking.");
                            
                            mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
                            scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                            
                            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                                // FIX: The encode function expects a Uint8Array. Convert the Int16Array's buffer to a Uint8Array.
                                const pcmBlob: Blob = {
                                    data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                                    mimeType: 'audio/pcm;rate=16000',
                                };
                                
                                if(sessionPromiseRef.current){
                                    sessionPromiseRef.current.then((session) => {
                                        session.sendRealtimeInput({ media: pcmBlob });
                                    });
                                }
                            };
                            
                            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                        },
                        onmessage: async (message: LiveServerMessage) => {
                            if (message.serverContent?.outputTranscription) {
                                currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                            }
                            if (message.serverContent?.inputTranscription) {
                                currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                            }

                            if (message.serverContent?.turnComplete) {
                                const finalInput = currentInputTranscriptionRef.current.trim();
                                const finalOutput = currentOutputTranscriptionRef.current.trim();
                                if (finalInput) {
                                    setTranscriptions(prev => [...prev, { text: finalInput, source: 'user' }]);
                                }
                                if (finalOutput) {
                                    setTranscriptions(prev => [...prev, { text: finalOutput, source: 'model' }]);
                                }
                                currentInputTranscriptionRef.current = '';
                                currentOutputTranscriptionRef.current = '';
                            }
                            
                            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                            if (base64Audio) {
                                const audioCtx = outputAudioContextRef.current!;
                                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
                                const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
                                
                                const source = audioCtx.createBufferSource();
                                source.buffer = audioBuffer;
                                source.connect(audioCtx.destination);
                                source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                                source.start(nextStartTimeRef.current);
                                nextStartTimeRef.current += audioBuffer.duration;
                                audioSourcesRef.current.add(source);
                            }

                            if (message.toolCall?.functionCalls) {
                                for(const fc of message.toolCall.functionCalls) {
                                    addNotification(`Calling function: ${fc.name} with args: ${JSON.stringify(fc.args)}`);
                                    sessionPromiseRef.current?.then(session => {
                                        session.sendToolResponse({
                                            functionResponses: {
                                                id: fc.id,
                                                name: fc.name,
                                                response: { result: "Function executed successfully." }
                                            }
                                        });
                                    });
                                }
                            }
                        },
                        onerror: (e: ErrorEvent) => {
                            console.error(e);
                            addNotification(`Error: ${e.message}`);
                            setIsSessionActive(false);
                        },
                        onclose: () => {
                            addNotification("Session closed.");
                            setIsSessionActive(false);
                        },
                    },
                    config: {
                        responseModalities: [Modality.AUDIO],
                        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                        inputAudioTranscription: {},
                        outputAudioTranscription: {},
                        systemInstruction: SYSTEM_PROMPT,
                        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
                    }
                });

            } catch (error) {
                console.error("Failed to start session:", error);
                addNotification(`Error: Could not start audio session. Please grant microphone permissions.`);
            }
        }
    };
    
    return (
        <div className="h-[75vh] flex flex-col p-4 bg-gray-800">
            <div className="flex-1 overflow-y-auto mb-4 p-4 bg-gray-900/50 rounded-lg">
                 {transcriptions.length === 0 && notifications.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <PhoneIcon className="w-16 h-16 mb-4" />
                        <h2 className="text-xl font-semibold">Live Agent is ready</h2>
                        <p className="text-center">Press the "Start Call" button below to begin a conversation.</p>
                    </div>
                )}
                {transcriptions.map((t, i) => (
                    <div key={i} className={`flex items-start gap-3 my-3 ${t.source === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {t.source === 'model' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold">A</div>}
                        <div className={`p-3 rounded-lg max-w-lg ${t.source === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                            <p className="text-sm">{t.text}</p>
                        </div>
                         {t.source === 'user' && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center font-bold">Y</div>}
                    </div>
                ))}
                {notifications.map((n, i) => (
                    <div key={`notif-${i}`} className="flex items-center gap-2 text-xs text-gray-400 my-2 px-2 py-1 bg-gray-700/50 rounded-md">
                        {n.startsWith("Calling function:") ? <Cog6ToothIcon className="w-4 h-4 text-yellow-400"/> : <InformationCircleIcon className="w-4 h-4 text-blue-400" />}
                        <p>{n}</p>
                    </div>
                ))}
                <div ref={transcriptEndRef} />
            </div>
            <div className="flex justify-center items-center pt-4 border-t border-gray-700">
                <button
                    onClick={handleToggleSession}
                    className={`flex items-center justify-center gap-3 w-48 h-16 rounded-full font-bold text-xl transition-all duration-300 transform hover:scale-105 shadow-lg
                    ${isSessionActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                    aria-label={isSessionActive ? 'End Call' : 'Start Call'}
                >
                    {isSessionActive ? (
                        <>
                            <StopIcon className="w-8 h-8" />
                            <span>End Call</span>
                        </>
                    ) : (
                        <>
                            <PhoneIcon className="w-8 h-8" />
                            <span>Start Call</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
