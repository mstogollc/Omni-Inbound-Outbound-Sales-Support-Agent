import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { SparklesIcon, CodeBracketIcon } from './Icons';

type ScriptType = 'PowerShell' | 'Bash';

export const ScriptGenerator: React.FC = () => {
    const [prompt, setPrompt] = useState('');
    const [scriptType, setScriptType] = useState<ScriptType>('PowerShell');
    const [response, setResponse] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const SYSTEM_INSTRUCTION = `You are an expert script developer for IT automation. The user will specify a language (PowerShell or Bash) and a task.
    Your response must ONLY contain the script code itself, wrapped in a markdown code block for the appropriate language.
    Do NOT include any explanations, greetings, or other text outside of the code block.
    For example, if asked for a PowerShell script to list files, the response should be:
    \`\`\`powershell
    Get-ChildItem -Path C:\\Temp
    \`\`\``;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setError(null);
        setResponse(null);

        try {
            if (!process.env.API_KEY) throw new Error("API Key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const fullPrompt = `Generate a ${scriptType} script that does the following: ${prompt}`;

            const result: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: fullPrompt,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                },
            });
            
            setResponse(result.text);

        } catch (err) {
            setError((err as Error).message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg h-full flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <CodeBracketIcon /> AI Script Generator
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-300">Script Type:</label>
                    <div className="flex bg-gray-900/50 rounded-lg p-1">
                        {(['PowerShell', 'Bash'] as ScriptType[]).map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setScriptType(type)}
                                className={`px-3 py-1 text-sm font-semibold rounded-md transition ${scriptType === type ? 'bg-teal-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={`Describe the script's function, e.g., "Find all .log files larger than 5MB in the user's home directory and delete them."`}
                    className="w-full h-24 bg-gray-900/50 text-white placeholder-gray-500 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    className="w-full bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 transition disabled:bg-teal-800 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    disabled={isLoading || !prompt.trim()}
                >
                    <SparklesIcon className="w-5 h-5" />
                    {isLoading ? 'Generating...' : 'Generate Script'}
                </button>
            </form>

            {error && <div className="mt-4 p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">{error}</div>}

            {response && (
                <div className="mt-4 p-4 bg-gray-900/50 rounded-lg flex-1 overflow-y-auto">
                    <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{response}</ReactMarkdown>
                    </div>
                </div>
            )}
             {isLoading && (
                <div className="mt-4 p-4 text-center text-gray-400">
                    Writing {scriptType} script...
                </div>
            )}
        </div>
    );
};
