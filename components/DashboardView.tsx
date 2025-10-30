import React from 'react';
import { Prospect, CallLog } from '../types';
import { View } from './DashboardLayout';
import { PhoneIcon, BeakerIcon, Cog6ToothIcon, DocumentTextIcon, NetworkIcon, CodeBracketIcon, EnvelopeIcon, SparklesIcon } from './Icons';

interface DashboardViewProps {
    prospects: Prospect[];
    recentLogs: CallLog[];
    navigateTo: (view: View) => void;
}

const StatCard: React.FC<{ title: string; value: number | string; }> = ({ title, value }) => (
    <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg">
        <h3 className="text-sm font-medium text-gray-400 truncate">{title}</h3>
        <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
);

const ToolCard: React.FC<{ title: string; description: string; icon: React.ReactNode; onClick: () => void }> = ({ title, description, icon, onClick }) => (
    <button onClick={onClick} className="bg-gray-800/70 p-6 rounded-xl shadow-lg text-left hover:bg-gray-700/80 hover:ring-2 hover:ring-teal-500 transition-all duration-200 h-full flex flex-col">
        <div className="flex-shrink-0 text-teal-400">{icon}</div>
        <div className="mt-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
    </button>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ prospects, recentLogs, navigateTo }) => {
    const meetingsBooked = prospects.filter(p => p.status === 'Meeting Booked').length;
    const followUps = prospects.filter(p => p.status === 'Follow Up').length;

    const tools = [
        { view: 'live-agent' as View, title: 'Live AI Agent', description: 'Handle inbound/outbound calls with a real-time voice agent.', icon: <PhoneIcon /> },
        { view: 'research-assistant' as View, title: 'AI Research Assistant', description: 'Get answers with verifiable sources using Google Search.', icon: <BeakerIcon /> },
        { view: 'complex-query' as View, title: 'Complex Query Solver', description: 'Leverage Gemini Pro for coding, analysis, and creative tasks.', icon: <Cog6ToothIcon /> },
        { view: 'network-troubleshooter' as View, title: 'Network Troubleshooter', description: 'Diagnose connectivity and network issues with AI guidance.', icon: <NetworkIcon /> },
        { view: 'script-generator' as View, title: 'Script Generator', description: 'Create PowerShell and Bash scripts for automation.', icon: <CodeBracketIcon /> },
        { view: 'email-generator' as View, title: 'Email Generator', description: 'Draft professional onboarding and support emails.', icon: <EnvelopeIcon /> },
        { view: 'tts-player' as View, title: 'TTS Player', description: 'Convert any text into high-quality spoken audio.', icon: <DocumentTextIcon /> },
    ];
    
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold text-white">OmniTech Powerhouse</h1>
                 <div className="flex items-center gap-1 text-teal-400">
                    <SparklesIcon />
                    <span className="font-semibold">AI Enabled</span>
                 </div>
            </div>
            
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Prospects" value={prospects.length} />
                <StatCard title="Meetings Booked" value={meetingsBooked} />
                <StatCard title="Follow-Ups Queued" value={followUps} />
                <StatCard title="Recent Calls" value={recentLogs.length} />
            </div>

            {/* AI Tools Hub */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-4">Toolbox</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {tools.map(tool => (
                        <ToolCard 
                            key={tool.view}
                            title={tool.title}
                            description={tool.description}
                            icon={tool.icon}
                            onClick={() => navigateTo(tool.view)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};