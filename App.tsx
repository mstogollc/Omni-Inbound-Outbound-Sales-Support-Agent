
import React, { useState } from 'react';
import { LiveAgent } from './components/LiveAgent';
import { GroundedChat } from './components/GroundedChat';
import { ComplexQuery } from './components/ComplexQuery';
import { TtsPlayer } from './components/TtsPlayer';
import { BrainCircuitIcon, ChatBubbleLeftRightIcon, MicrophoneIcon, SpeakerWaveIcon } from './components/Icons';
import { Tab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.LiveAgent);

  const renderTabContent = () => {
    switch (activeTab) {
      case Tab.LiveAgent:
        return <LiveAgent />;
      case Tab.GroundedChat:
        return <GroundedChat />;
      case Tab.ComplexQuery:
        return <ComplexQuery />;
      case Tab.TtsPlayer:
        return <TtsPlayer />;
      default:
        return <LiveAgent />;
    }
  };

  const TabButton = ({ tab, label, icon }: { tab: Tab; label: string; icon: React.ReactElement }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium rounded-t-lg transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400
        ${activeTab === tab ? 'bg-gray-800 text-teal-400 border-b-2 border-teal-400' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col font-sans">
      <header className="bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-gray-700/50 shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
            OmniTech AI Sales & Support Agent
          </h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col container mx-auto px-4 py-4 sm:py-6 overflow-hidden">
        <div className="w-full max-w-5xl mx-auto flex flex-col flex-1">
          <div className="flex border-b border-gray-700">
            <TabButton tab={Tab.LiveAgent} label="Live Agent" icon={<MicrophoneIcon />} />
            <TabButton tab={Tab.GroundedChat} label="Grounded Chat" icon={<ChatBubbleLeftRightIcon />} />
            <TabButton tab={Tab.ComplexQuery} label="Complex Query" icon={<BrainCircuitIcon />} />
            <TabButton tab={Tab.TtsPlayer} label="TTS Player" icon={<SpeakerWaveIcon />} />
          </div>
          <div className="flex-1 bg-gray-800 rounded-b-lg shadow-2xl overflow-hidden">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
