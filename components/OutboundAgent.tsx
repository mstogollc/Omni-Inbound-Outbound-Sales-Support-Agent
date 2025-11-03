import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audio';
import { SessionPromiseRef, Transcription, CallQueueItem, Prospect } from '../types';
import { SYSTEM_PROMPT, FUNCTION_DECLARATIONS } from '../services/geminiService';
import { apiService } from '../services/apiService';
import { Cog6ToothIcon, SparklesIcon, StopIcon, UserIcon, PlayIcon, PauseIcon } from './Icons';

type CampaignStatus = 'idle' | 'calling' | 'pausing' | 'paused' | 'finished';

export const OutboundAgent: React.FC = () => {
    const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>('idle');
    const [callQueue, setCallQueue] = useState<CallQueueItem[]>([]);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [notifications, setNotifications] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    
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
    const statusRef = useRef(campaignStatus);

    useEffect(() => { statusRef.current = campaignStatus; }, [campaignStatus]);

    const addNotification = useCallback((message: string) => {
        setNotifications(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
    }, []);

    const fetchQueue = useCallback(async () => {
        try {
            const queue = await apiService.getOutboundCallQueue();
            setCallQueue(queue);
            if (queue.length === 0) {
                addNotification("Call queue is empty.");
            } else {
                addNotification(`Loaded ${queue.length} prospects in the queue.`);
            }
        } catch (error) {
            addNotification(`Error fetching call queue: ${(error as Error).message}`);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchQueue();
    }, [fetchQueue]);
    
    useEffect(() => {
        if (transcriptionContainerRef.current) {
            transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
        }
    }, [transcriptions]);

    const closeCall = useCallback((shouldContinue: boolean) => {
        sessionPromise.current?.then(s => s.close());
        sessionPromise.current = null;
        scriptProcessor.current?.disconnect();
        mediaStreamSource.current?.disconnect();
        mediaStream.current?.getTracks().forEach(t => t.stop());
        inputAudioContext.current?.close().catch(() => {});
        outputAudioContext.current?.close().catch(() => {});
        
        const isPausing = statusRef.current === 'pausing';
        if (isPausing) {
            setCampaignStatus('paused');
            addNotification('Campaign paused.');
            return;
        }

        if (shouldContinue && statusRef.current === 'calling') {
            addNotification('Waiting 5 seconds before next call...');
            setTimeout(() => {
                if (statusRef.current === 'calling') {
                    setCurrentIndex(prev => prev + 1);
                }
            }, 5000);
        } else if (!shouldContinue) {
             setCampaignStatus('idle');
             setCurrentIndex(-1);
             addNotification('Campaign stopped by user.');
        }
    }, [addNotification]);
    
    useEffect(() => {
        return () => { closeCall(false); };
    }, [closeCall]);

    const handleToolCall = useCallback(async (functionCall: any, prospect: Prospect) => {
        const { name, args } = functionCall;
        addNotification(`AI Tool: ${name}`);
        
        if (name === 'write_to_call_log') {
            addNotification(`AI logging call for ${prospect.contact}.`);
            try {
                await apiService.addCallLog(prospect.id, {
                    summary: args.summary,
                    disposition: args.disposition,
                    transcription: [...transcriptions, { text: currentInputTranscription.current, source: 'user' }, { text: currentOutputTranscription.current, source: 'model' }].filter(t => t.text.trim()),
                });
                await apiService.updateProspectStatus(prospect.id, args.disposition);
                addNotification(`Log successful. Disposition: ${args.disposition}.`);
                setCallQueue(prev => prev.filter(p => p.id !== prospect.id));
            } catch (error) {
                 addNotification(`Error logging call: ${(error as Error).message}`);
            }
            closeCall(true);
            return;
        }

        let resultMessage = `Function ${name} executed successfully.`;
        try {
            switch(name) {
                case 'schedule_meeting':
                    await apiService.scheduleMeeting(prospect.id, { startTime: args.start_time, agenda: args.agenda });
                    break;
                case 'send_sms':
                     await apiService.sendSms(args.phone_number, args.message);
                     break;
            }
        } catch (error) {
            resultMessage = `Function ${name} failed: ${(error as Error).message}`;
            addNotification(resultMessage);
        }
        
        sessionPromise.current?.then((session) => {
            session.sendToolResponse({
                functionResponses: { id: functionCall.id, name: functionCall.name, response: { result: resultMessage } }
            });
        });
    }, [addNotification, closeCall, transcriptions]);

    const startCall = useCallback(async (prospect: Prospect) => {
        if (!process.env.API_KEY) {
            addNotification("Error: Gemini API Key is not configured in this environment.");
            setCampaignStatus('idle');
            return;
        }

        addNotification(`Calling ${prospect.contact} at ${prospect.company}...`);
        setTranscriptions([]);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStream.current = stream;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            inputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

            sessionPromise.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: SYSTEM_PROMPT + `\nThis is an outbound call. The current prospect is ${prospect.contact} from ${prospect.company}. Your goal is to qualify them and book a meeting if appropriate.`,
                    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
                    inputAudioTranscription: {}, outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        addNotification('Connection established.');
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
                        if (message.toolCall) message.toolCall.functionCalls.forEach(fc => handleToolCall(fc, prospect));
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
                    onerror: (e: ErrorEvent) => { 
                        console.error("Outbound agent session error:", e);
                        addNotification(`Error: ${e.message || 'An unknown connection error occurred.'}`); 
                        closeCall(true); 
                    },
                    onclose: () => { /* Main teardown handled by closeCall */ },
                },
            });
        } catch (error) {
            let errorMessage = "An unknown error occurred. Check browser console for details.";
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (error) {
                errorMessage = String(error);
            }
            console.error("Failed to start outbound call:", error);
            addNotification(`Error: ${errorMessage}`);
            closeCall(true);
        }
    }, [addNotification, handleToolCall, closeCall]);

    useEffect(() => {
        if (campaignStatus === 'calling' && currentIndex >= 0 && currentIndex < callQueue.length) {
            const prospect = callQueue[currentIndex];
            startCall(prospect);
        } else if (campaignStatus === 'calling' && callQueue.length > 0 && currentIndex >= callQueue.length) {
            addNotification("Campaign finished. All prospects have been contacted.");
            setCampaignStatus('finished');
            setCurrentIndex(-1);
        }
    }, [currentIndex, campaignStatus, callQueue, startCall, addNotification]);

    const handleStartCampaign = () => {
        if (callQueue.length === 0) {
            addNotification("Cannot start: queue is empty.");
            return;
        }
        addNotification("Starting campaign...");
        setCampaignStatus('calling');
        setCurrentIndex(0);
    };

    const handlePauseCampaign = () => {
        if (campaignStatus !== 'calling') return;
        setCampaignStatus('pausing');
        addNotification("Pausing campaign after this call...");
    };

    const handleResumeCampaign = () => {
        if (campaignStatus !== 'paused') return;
        setCampaignStatus('calling');
        addNotification("Resuming campaign...");
    };

    const handleStopCampaign = () => {
        closeCall(false);
    };

    const currentProspect = (currentIndex >= 0 && currentIndex < callQueue.length) ? callQueue[currentIndex] : null;

    const getStatusText = () => {
        switch (campaignStatus) {
            case 'idle': return 'Ready to start.';
            case 'calling': return `Calling: ${currentProspect?.contact || '...'}`;
            case 'pausing': return `Pausing after current call...`;
            case 'paused': return 'Paused. Press Resume to continue.';
            case 'finished': return 'Campaign complete.';
        }
    };

    const isCallActive = campaignStatus === 'calling' && !!currentProspect;

    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg flex flex-col h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                {/* Left Panel: Queue & Controls */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h3 className="font-semibold text-white mb-2">Campaign Controls</h3>
                         <div className="flex gap-2">
                             {campaignStatus === 'calling' ? (
                                <button onClick={handlePauseCampaign} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 text-white font-semibold rounded-lg hover:bg-yellow-700 transition">
                                    <PauseIcon /> Pause
                                </button>
                             ) : (
                                <button onClick={campaignStatus === 'paused' ? handleResumeCampaign : handleStartCampaign} disabled={callQueue.length === 0} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed">
                                    <PlayIcon /> {campaignStatus === 'paused' ? 'Resume' : 'Start'}
                                </button>
                             )}
                             <button onClick={handleStopCampaign} disabled={campaignStatus === 'idle' || campaignStatus === 'finished'} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed">
                                <StopIcon /> Stop
                            </button>
                        </div>
                        <p className="text-sm text-center mt-3 text-gray-400">Status: <span className="font-semibold text-white">{getStatusText()}</span></p>
                    </div>
                     <div className="bg-gray-900/50 p-4 rounded-lg flex-1 overflow-y-auto">
                        <h3 className="font-semibold text-white mb-2">Call Queue ({callQueue.length})</h3>
                        <ul className="space-y-2">
                            {callQueue.map((p, index) => (
                                <li key={p.id} className={`p-2 rounded-md transition-colors ${index === currentIndex ? 'bg-teal-600/50 ring-2 ring-teal-500' : 'bg-gray-800'}`}>
                                    <p className="font-semibold text-white text-sm">{p.contact}</p>
                                    <p className="text-xs text-gray-400">{p.company}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Right Panel: Call Interface */}
                <div className="md:col-span-2 flex flex-col bg-gray-900/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                         <h3 className="text-lg font-semibold text-white">
                            {currentProspect ? `Current Call: ${currentProspect.contact}` : 'Awaiting Campaign Start'}
                         </h3>
                         {isCallActive && (
                            <div className="flex items-center gap-2 text-red-400">
                                <span className="relative flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                                <span className="text-sm font-semibold">LIVE</span>
                            </div>
                         )}
                    </div>
                    <div ref={transcriptionContainerRef} className="flex-1 overflow-y-auto mb-4 space-y-3 p-2 bg-gray-800/60 rounded-lg min-h-[250px]">
                         {transcriptions.map((t, i) => (
                             <div key={i} className={`flex items-start gap-2 ${t.source === 'user' ? 'justify-end' : ''}`}>
                                {t.source === 'model' && <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-white" /></div>}
                                <div className={`p-2.5 rounded-lg max-w-sm text-sm ${t.source === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>{t.text}</div>
                                {t.source === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UserIcon className="w-4 h-4 text-white" /></div>}
                            </div>
                        ))}
                         {!currentProspect && campaignStatus === 'idle' && <p className="text-center text-gray-500 p-8">Press 'Start' to begin the campaign.</p>}
                    </div>
                    <div className="p-2 bg-gray-800/60 rounded-lg text-xs font-mono text-gray-400 space-y-1 h-[120px] overflow-y-auto">
                        <p className="font-bold text-gray-300 flex items-center gap-1"><Cog6ToothIcon className="w-4 h-4"/> System:</p>
                        {notifications.length > 0 ? notifications.map((n, i) => <p key={i} className="whitespace-pre-wrap">&gt; {n}</p>) : <p>&gt; Waiting to start campaign...</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};
