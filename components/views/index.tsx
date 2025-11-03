import React from 'react';
import { LiveAgent } from '../LiveAgent';
import { OutboundAgent } from '../OutboundAgent';
import { GroundedChat } from '../GroundedChat';
import { ComplexQuery } from '../ComplexQuery';
import { TtsPlayer } from '../TtsPlayer';
import { NetworkTroubleshooter } from '../NetworkTroubleshooter';
import { ScriptGenerator } from '../ScriptGenerator';
import { EmailGenerator } from '../EmailGenerator';

const ViewWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h1 className="text-3xl font-bold text-white mb-6">{title}</h1>
        <div className="h-[calc(100vh-10rem)]">
            {children}
        </div>
    </div>
);

export const LiveAgentView: React.FC = () => <ViewWrapper title="Inbound AI Agent"><LiveAgent /></ViewWrapper>;
export const OutboundAgentView: React.FC = () => <ViewWrapper title="Outbound AI Campaign"><OutboundAgent /></ViewWrapper>;
export const GroundedChatView: React.FC = () => <ViewWrapper title="AI Research Assistant"><GroundedChat /></ViewWrapper>;
export const ComplexQueryView: React.FC = () => <ViewWrapper title="Complex Query Solver"><ComplexQuery /></ViewWrapper>;
export const TtsPlayerView: React.FC = () => <ViewWrapper title="Text-to-Speech Player"><TtsPlayer /></ViewWrapper>;
export const NetworkTroubleshooterView: React.FC = () => <ViewWrapper title="Network Troubleshooter"><NetworkTroubleshooter /></ViewWrapper>;
export const ScriptGeneratorView: React.FC = () => <ViewWrapper title="Script Generator"><ScriptGenerator /></ViewWrapper>;
export const EmailGeneratorView: React.FC = () => <ViewWrapper title="Email Generator"><EmailGenerator /></ViewWrapper>;
