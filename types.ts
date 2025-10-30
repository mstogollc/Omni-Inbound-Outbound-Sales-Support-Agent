// FIX: Import MutableRefObject from React to resolve the 'Cannot find namespace React' error.
import type { MutableRefObject } from 'react';
// FIX: The type `LiveSession` is not exported from "@google/genai".
// We will define a local interface for it and import `Blob` which is used by the interface.
import type { Blob } from "@google/genai";

export interface User {
  name: string;
  role: string;
  email: string;
  token?: string; // In a real app, this would be a JWT or session token
}

export interface Transcription {
  text: string;
  source: 'user' | 'model';
}

export interface Prospect {
  id: number;
  company: string;
  contact: string;
  title: string;
  phone: string;
  email: string;
  status: 'Pending' | 'Contacted' | 'Meeting Booked' | 'Not Interested' | 'Follow Up';
  assignedTo: string;
  lastContacted: string | null;
  nextFollowUp: string | null;
}

export interface CallLog {
  id: string;
  prospectId: number;
  timestamp: string;
  summary: string;
  disposition: Prospect['status'];
  transcription: Transcription[];
  meetingDetails?: {
    startTime: string;
    agenda: string;
  } | null;
}

export interface ScheduledMeeting {
    id: string;
    prospectId: number;
    prospectName: string;
    companyName: string;
    startTime: string;
    agenda: string;
}

export interface CallQueueItem extends Prospect {
    queuePosition: number;
}


// FIX: Define the LiveSession interface locally as it is not exported from the library.
// This interface is based on the usage within ProspectDetailView.tsx.
export interface LiveSession {
    close: () => void;
    sendToolResponse: (response: { functionResponses: { id: string; name: string; response: { result: string; }; }; }) => void;
    sendRealtimeInput: (input: { media: Blob; }) => void;
}

// Custom type for the session promise ref to satisfy TypeScript
export type SessionPromiseRef = MutableRefObject<Promise<LiveSession> | null>;