import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { decode, decodeAudioData, encode } from '../utils/audio';
import { SYSTEM_PROMPT, FUNCTION_DECLARATIONS } from '../services/geminiService';
import { apiService } from '../services/apiService';
import { Cog6ToothIcon, PhoneArrowUpRightIcon, StopIcon, UserIcon, SparklesIcon } from './Icons';
import { Prospect, CallLog, Transcription, SessionPromiseRef } from '../types';
import { LocalIntelligence } from './LocalIntelligence';

interface ProspectDetailViewProps {
    prospect: Prospect;
    initialCallLogs: CallLog[];
    onDataRefresh: () => void;
    onBack: () => void;
}

// Confirmation Dialog Component
const CallEndConfirmationDialog: React.FC<{
    isOpen: boolean;
    logData: { summary: string; disposition: Prospect['status'] };
    onConfirm: (summary: string, disposition: Prospect['status']) => void;
    onCancel: () => void;
}> = ({ isOpen, logData, onConfirm, onCancel }) => {
    const [summary, setSummary] = useState('');
    const [disposition, setDisposition] = useState<Prospect['status']>('Contacted');

    useEffect(() => {
        if (logData) {
            setSummary(logData.summary);
            setDisposition(logData.disposition);
        }
    }, [logData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg">
                <h2 className="text-xl font-bold text-white mb-4">Confirm Call Log</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-300">Summary</label>
                        <textarea
                            value={summary}
                            onChange={(e) => setSummary(e.target.value)}
                            className="w-full h-32 mt-1 bg-gray-900 text-white p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                            placeholder="Enter a brief summary of the call..."
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-300">Disposition</label>
                        <select
                            value={disposition}
                            onChange={(e) => setDisposition(e.target.value as Prospect['status'])}
                            className="w-full mt-1 bg-gray-900 text-white p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                        >
                            <option>Pending</option>
                            <option>Contacted</option>
                            <option>Meeting Booked</option>
                            <option>Not Interested</option>
                            <option>Follow Up</option>
                        </select>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition">
                        Cancel
                    </button>
                    <button onClick={() => onConfirm(summary, disposition)} className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition">
                        Confirm & Log
                    </button>
                </div>
            </div>
        </div>
    );
};


export const ProspectDetailView: React.FC<ProspectDetailViewProps> = ({ prospect, initialCallLogs, onDataRefresh, onBack }) => {
    const [isCallActive, setIsCallActive] = useState(false);
    const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
    const [notifications, setNotifications] = useState<string[]>([]);
    const [callLogs, setCallLogs] = useState<CallLog[]>(initialCallLogs);
    const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);
    const [pendingLog, setPendingLog] = useState<{ summary: string; disposition: Prospect['status'] } | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    
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

    const closeSession = useCallback(() => {
        if (!isCallActive) return;
        sessionPromise.current?.then(s => s.close());
        sessionPromise.current = null;
        scriptProcessor.current?.disconnect();
        mediaStreamSource.current?.disconnect();
        mediaStream.current?.getTracks().forEach(t => t.stop());
        inputAudioContext.current?.close().catch(() => {});
        outputAudioContext.current?.close().catch(() => {});
        setIsCallActive(false);
        addNotification('Call ended.');
    }, [isCallActive, addNotification]);

    const handleConfirmLog = async (summary: string, disposition: Prospect['status']) => {
        addNotification(`Logging call with disposition: ${disposition}`);
        try {
             const newLog: Omit<CallLog, 'id' | 'prospectId' | 'timestamp'> = {
                summary,
                disposition,
                transcription: transcriptions
            };
            const savedLog = await apiService.addCallLog(prospect.id, newLog);
            setCallLogs(prev => [savedLog, ...prev]);
            await apiService.updateProspectStatus(prospect.id, disposition);
            onDataRefresh();
        } catch (error) {
            addNotification(`Error logging call: ${(error as Error).message}`);
        } finally {
            setIsConfirmationVisible(false);
            setPendingLog(null);
        }
    };

    const handleCancelLog = () => {
        setIsConfirmationVisible(false);
        setPendingLog(null);
        addNotification("Call log discarded.");
    };

    const handleToolCall = useCallback(async (functionCall: any) => {
        const { name, args } = functionCall;
        
        if (name === 'write_to_call_log') {
            addNotification(`AI finished call. Review log.`);
            closeSession();
            setPendingLog({ summary: args.summary, disposition: args.disposition });
            setIsConfirmationVisible(true);
            return;
        }

        let resultMessage = `Function ${name} executed successfully.`;
        try {
            switch(name) {
                case 'schedule_meeting':
                    addNotification(`Booking meeting for ${args.start_time}`);
                    await apiService.scheduleMeeting(prospect.id, { startTime: args.start_time, agenda: args.agenda });
                    onDataRefresh();
                    break;
                case 'send_sms':
                     addNotification(`Sending SMS to ${args.phone_number}`);
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
    }, [addNotification, prospect.id, onDataRefresh, closeSession]);

    useEffect(() => { return () => { closeSession(); }; }, [closeSession]);
    
    useEffect(() => {
        if (transcriptionContainerRef.current) {
            transcriptionContainerRef.current.scrollTop = transcriptionContainerRef.current.scrollHeight;
        }
    }, [transcriptions]);

    const handleEndCallClick = async () => {
        if (!isCallActive) return;
        const currentTranscriptions = [...transcriptions]; // Capture current state
        closeSession();

        if (currentTranscriptions.length > 0) {
            setIsSummarizing(true);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
                const transcriptText = currentTranscriptions.map(t => `${t.source === 'user' ? 'Prospect' : 'Agent'}: ${t.text}`).join('\n');
                const prompt = `Based on the call transcript, provide a summary and a disposition from: 'Pending', 'Contacted', 'Meeting Booked', 'Not Interested', 'Follow Up'. Respond ONLY with a valid JSON object: {"summary": "your summary", "disposition": "chosen disposition"}`;

                const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
                const jsonText = result.text.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(jsonText);
                setPendingLog({ summary: parsed.summary, disposition: parsed.disposition });
            } catch (e) {
                console.error("Failed to summarize call:", e);
                addNotification("Error summarizing. Please log manually.");
                setPendingLog({ summary: '', disposition: 'Contacted' });
            } finally {
                setIsSummarizing(false);
                setIsConfirmationVisible(true);
            }
        } else {
            setPendingLog({ summary: 'Short call, no transcript recorded.', disposition: 'Contacted' });
            setIsConfirmationVisible(true);
        }
    };

    const handleManualLogClick = (disposition: Prospect['status']) => {
        if (isCallActive) {
            addNotification("Please end the active call before logging manually.");
            return;
        }
        setPendingLog({ summary: '', disposition });
        setIsConfirmationVisible(true);
    };


    const startCall = async () => {
        if (!process.env.API_KEY) {
            addNotification("Gemini API Key is not configured.");
            return;
        }

        addNotification(`Calling ${prospect.contact}...`);
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
                    systemInstruction: SYSTEM_PROMPT + `\nThe current prospect is ${prospect.contact} from ${prospect.company}.`,
                    tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
                    inputAudioTranscription: {}, outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: () => {
                        addNotification('Connection established.');
                        setIsCallActive(true);
                        mediaStreamSource.current = inputAudioContext.current!.createMediaStreamSource(stream);
                        scriptProcessor.current = inputAudioContext.current!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.current.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                            const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.current?.then((s) => s.sendRealtimeInput({ media: pcmBlob }));
                        };
                        mediaStreamSource.current.connect(scriptProcessor.current);
                        scriptProcessor.current.connect(inputAudioContext.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) currentInputTranscription.current += message.serverContent.inputTranscription.text;
                        if (message.serverContent?.outputTranscription) currentOutputTranscription.current += message.serverContent.outputTranscription.text;
                        if (message.toolCall) message.toolCall.functionCalls.forEach(handleToolCall);
                        if (message.serverContent?.turnComplete) {
                            const fullInput = currentInputTranscription.current.trim();
                            const fullOutput = currentOutputTranscription.current.trim();
                            const newTurns: Transcription[] = [];
                            if(fullInput) newTurns.push({ text: fullInput, source: 'user' });
                            if(fullOutput) newTurns.push({ text: fullOutput, source: 'model' });

                            if(newTurns.length > 0) {
                                setTranscriptions(p => [...p, ...newTurns]);
                            }
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
                    onerror: (e: ErrorEvent) => { addNotification(`Error: ${e.message}`); closeSession(); },
                    onclose: () => { setIsCallActive(false); /* Main teardown handled by closeSession */ },
                },
            });
        } catch (error) { addNotification(`Failed to start call: ${(error as Error).message}`); closeSession(); }
    };

    const manualLogButtonClasses = "w-full text-center px-3 py-2 text-xs font-semibold rounded-lg bg-gray-700 hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed";

    return (
        <div>
            {pendingLog && <CallEndConfirmationDialog isOpen={isConfirmationVisible} logData={pendingLog} onConfirm={handleConfirmLog} onCancel={handleCancelLog} />}
            <button onClick={onBack} className="text-sm text-teal-400 hover:text-teal-300 mb-4">&larr; Back to Prospects</button>
            <div className="bg-gray-800/70 p-6 rounded-xl shadow-lg mb-6">
                <h1 className="text-2xl font-bold text-white">{prospect.contact}</h1>
                <p className="text-gray-400">{prospect.title} at {prospect.company}</p>
                <p className="text-sm text-gray-400 mt-2">{prospect.email} &middot; {prospect.phone}</p>
            </div>
            
            <LocalIntelligence prospect={prospect} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Calling Interface */}
                <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg flex flex-col">
                    <h2 className="text-lg font-semibold text-white mb-3">Live Call</h2>
                    <div ref={transcriptionContainerRef} className="flex-1 overflow-y-auto mb-4 space-y-3 p-2 bg-gray-900/50 rounded-lg min-h-[300px] max-h-[400px]">
                        {transcriptions.map((t, i) => (
                             <div key={i} className={`flex items-start gap-2 ${t.source === 'user' ? 'justify-end' : ''}`}>
                                {t.source === 'model' && <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0"><SparklesIcon className="w-4 h-4 text-white" /></div>}
                                <div className={`p-2.5 rounded-lg max-w-sm text-sm ${t.source === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>{t.text}</div>
                                {t.source === 'user' && <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0"><UserIcon className="w-4 h-4 text-white" /></div>}
                            </div>
                        ))}
                    </div>
                     <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                        {!isCallActive ? (
                            <button onClick={startCall} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition">
                                <PhoneArrowUpRightIcon /> Start Call
                            </button>
                        ) : (
                            <button onClick={handleEndCallClick} disabled={isSummarizing} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:bg-red-800/50 disabled:cursor-not-allowed">
                                <StopIcon /> {isSummarizing ? 'Summarizing...' : 'End Call'}
                            </button>
                        )}
                        <div className={`flex items-center gap-2 text-sm ${isCallActive ? 'text-green-400' : 'text-gray-400'}`}>
                            <span className={`w-3 h-3 rounded-full ${isCallActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                            {isCallActive ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                    <div className="mt-3 p-2 bg-gray-900/50 rounded-lg text-xs font-mono text-gray-400 space-y-1 h-[120px] overflow-y-auto">
                        <p className="font-bold text-gray-300 flex items-center gap-1"><Cog6ToothIcon className="w-4 h-4"/> System:</p>
                        {notifications.length > 0 ? notifications.map((n, i) => <p key={i} className="whitespace-pre-wrap">&gt; {n}</p>) : <p>&gt; Waiting...</p>}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-300 mb-2 text-center">Or, Log Call Manually</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {(['Meeting Booked', 'Not Interested', 'Follow Up', 'Contacted'] as Prospect['status'][]).map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleManualLogClick(status)}
                                    disabled={isCallActive}
                                    className={manualLogButtonClasses}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Call Logs */}
                <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg flex flex-col">
                     <h2 className="text-lg font-semibold text-white mb-3">Interaction History</h2>
                     <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px]">
                        {callLogs.length > 0 ? callLogs.map(log => (
                            <details key={log.id} className="bg-gray-900/50 rounded-lg p-3">
                                <summary className="cursor-pointer text-sm font-semibold text-white">
                                    Call on {new Date(log.timestamp).toLocaleDateString()} - <span className="font-bold">{log.disposition}</span>
                                </summary>
                                <div className="mt-3 pt-3 border-t border-gray-700">
                                    <p className="text-xs text-gray-400 italic mb-2">{log.summary}</p>
                                     {log.meetingDetails && <p className="text-xs text-green-400 mb-2">Meeting booked for {new Date(log.meetingDetails.startTime).toLocaleString()}</p>}
                                    <h4 className="text-xs font-bold text-gray-300 mb-1">Transcript:</h4>
                                    <div className="text-xs text-gray-400 space-y-1 max-h-40 overflow-y-auto">
                                        {log.transcription.map((t,i) => <p key={i}><strong>{t.source === 'model' ? 'Agent' : 'Prospect'}:</strong> {t.text}</p>)}
                                    </div>
                                oversight before it's saved to the log.
                                </div>
                            </details>
                        )) : <p className="text-sm text-gray-500 text-center mt-8">No call history for this prospect.</p>}
                     </div>
                </div>
            </div>
        </div>
    );
};