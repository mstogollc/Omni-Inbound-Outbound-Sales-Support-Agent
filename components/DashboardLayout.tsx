import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { ProspectsListView } from './ProspectsListView';
import { ProspectDetailView } from './ProspectDetailView';
import { User, Prospect, CallLog } from '../types';
import { apiService } from '../services/apiService';
import { LiveAgentView, GroundedChatView, ComplexQueryView, TtsPlayerView, NetworkTroubleshooterView, ScriptGeneratorView, EmailGeneratorView, OutboundAgentView } from './views';
import { ScheduleView } from './ScheduleView';


export type View = 
    'dashboard' | 
    'prospects' | 
    'prospect-detail' |
    'schedule' |
    'live-agent' |
    'outbound-agent' |
    'research-assistant' |
    'complex-query' |
    'tts-player' |
    'network-troubleshooter' |
    'script-generator' |
    'email-generator';

export const DashboardLayout: React.FC<{ user: User, onLogout: () => void }> = ({ user, onLogout }) => {
    const [prospects, setProspects] = useState<Prospect[]>([]);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const [selectedProspectId, setSelectedProspectId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [prospectsData, callLogsData] = await Promise.all([
                apiService.getProspects(),
                apiService.getAllCallLogs()
            ]);
            setProspects(prospectsData);
            setCallLogs(callLogsData);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSelectProspect = (prospectId: number) => {
        setSelectedProspectId(prospectId);
        setCurrentView('prospect-detail');
    };

    const navigateTo = (view: View) => {
        setCurrentView(view);
    };

    const renderView = () => {
        if (isLoading && currentView !== 'prospect-detail') {
            return <div className="text-center p-10">Loading data...</div>;
        }

        switch (currentView) {
            case 'prospects':
                return <ProspectsListView prospects={prospects} onSelectProspect={handleSelectProspect} onDataRefresh={fetchData} />;
            case 'prospect-detail':
                const prospect = prospects.find(p => p.id === selectedProspectId);
                if (prospect) {
                    return <ProspectDetailView
                                prospect={prospect}
                                initialCallLogs={callLogs.filter(log => log.prospectId === prospect.id)}
                                onDataRefresh={fetchData}
                                onBack={() => setCurrentView('prospects')}
                           />;
                }
                setCurrentView('prospects');
                return null;
            case 'schedule':
                return <ScheduleView />;
            case 'live-agent':
                return <LiveAgentView />;
            case 'outbound-agent':
                return <OutboundAgentView />;
            case 'research-assistant':
                return <GroundedChatView />;
            case 'complex-query':
                return <ComplexQueryView />;
            case 'tts-player':
                return <TtsPlayerView />;
            case 'network-troubleshooter':
                return <NetworkTroubleshooterView />;
            case 'script-generator':
                return <ScriptGeneratorView />;
            case 'email-generator':
                return <EmailGeneratorView />;
            case 'dashboard':
            default:
                return <DashboardView prospects={prospects} recentLogs={callLogs.slice(-5).reverse()} navigateTo={navigateTo} />;
        }
    };

    return (
        <div className="flex h-screen bg-gray-900">
            <Sidebar user={user} onLogout={onLogout} setView={setCurrentView} />
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 sm:p-6 md:p-8">
                    {renderView()}
                </div>
            </main>
        </div>
    );
};