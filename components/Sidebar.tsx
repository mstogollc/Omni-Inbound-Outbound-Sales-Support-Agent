import React from 'react';
import { OmniTechLogo, ChartPieIcon, UserGroupIcon, ArrowLeftOnRectangleIcon, PhoneIcon, BeakerIcon, DocumentTextIcon, Cog6ToothIcon, NetworkIcon, CodeBracketIcon, EnvelopeIcon, QueueListIcon } from './Icons';
import { User } from '../types';
import { View } from './DashboardLayout';

interface SidebarProps {
  user: User;
  onLogout: () => void;
  setView: (view: View) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, onLogout, setView }) => {
    
    const mainNav = [
        { name: 'Dashboard', icon: <ChartPieIcon />, view: 'dashboard' as const },
        { name: 'Prospects', icon: <UserGroupIcon />, view: 'prospects' as const },
        { name: 'Schedule', icon: <QueueListIcon />, view: 'schedule' as const },
    ];

    const aiToolsNav = [
        { name: 'Live AI Agent', icon: <PhoneIcon />, view: 'live-agent' as const },
        { name: 'Research Assistant', icon: <BeakerIcon />, view: 'research-assistant' as const },
        { name: 'Complex Query', icon: <Cog6ToothIcon />, view: 'complex-query' as const },
        { name: 'TTS Player', icon: <DocumentTextIcon />, view: 'tts-player' as const },
    ];

    const itToolkitNav = [
        { name: 'Network Tools', icon: <NetworkIcon />, view: 'network-troubleshooter' as const },
        { name: 'Script Generator', icon: <CodeBracketIcon />, view: 'script-generator' as const },
        { name: 'Email Generator', icon: <EnvelopeIcon />, view: 'email-generator' as const },
    ];

    // FIX: Specified the props for React.ReactElement to include `className`.
    // This informs TypeScript that the cloned icon elements can accept a `className` prop, resolving the overload error.
    const NavSection: React.FC<{title?: string, items: {name: string, icon: React.ReactElement<{ className?: string }>, view: View}[]}> = ({ title, items }) => (
        <div>
            {title && <h3 className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>}
            {items.map((item) => (
                <button
                    key={item.name}
                    onClick={() => setView(item.view)}
                    className="w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md text-gray-300 hover:bg-teal-800 hover:text-white transition-colors"
                >
                    {React.cloneElement(item.icon, { className: 'w-6 h-6 mr-3' })}
                    {item.name}
                </button>
            ))}
        </div>
    );

  return (
    <aside className="w-64 bg-gray-800/50 flex flex-col border-r border-gray-700/50">
      <div className="flex items-center justify-center gap-2 p-4 border-b border-gray-700/50">
        <OmniTechLogo className="w-8 h-8" />
        <span className="text-xl font-bold text-white">OmniTech</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-4">
          <NavSection items={mainNav} />
          <NavSection title="AI Sales & Support" items={aiToolsNav} />
          <NavSection title="IT Toolkit" items={itToolkitNav} />
      </nav>
      <div className="p-4 border-t border-gray-700/50">
        <div className="p-3 rounded-lg bg-gray-700/50">
            <p className="text-sm font-semibold text-white">{user.name}</p>
            <p className="text-xs text-gray-400">{user.role}</p>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center mt-3 px-4 py-2 text-sm font-medium rounded-md text-gray-300 hover:bg-red-800/50 hover:text-white transition-colors"
        >
          <ArrowLeftOnRectangleIcon className="w-6 h-6 mr-3" />
          Logout
        </button>
      </div>
    </aside>
  );
};
