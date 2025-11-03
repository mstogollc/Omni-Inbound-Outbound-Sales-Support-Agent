import { User, Prospect, CallLog, ScheduledMeeting, CallQueueItem } from '../types';

// --- MOCK DATABASE ---
// In a real application, this data would live in a database.
// We are simulating it here for demonstration purposes.

const MOCK_USERS: (User & { passwordHash: string })[] = [
    { name: 'Sales Agent', role: 'Agent', email: 'agent@omnitech.com', passwordHash: 'password' }
];

let MOCK_PROSPECTS: Prospect[] = [
    { id: 1, company: 'Innovate LLC', contact: 'John Doe', title: 'CTO', phone: '555-1234', email: 'john.doe@innovate.com', status: 'Pending', assignedTo: 'AI Agent', lastContacted: null, nextFollowUp: null },
    { id: 2, company: 'Synergy Corp', contact: 'Jane Smith', title: 'Office Manager', phone: '555-5678', email: 'jane.smith@synergy.com', status: 'Follow Up', assignedTo: 'AI Agent', lastContacted: '2023-10-25T10:00:00Z', nextFollowUp: '2023-11-01T10:00:00Z' },
    { id: 3, company: 'Quantum Solutions', contact: 'Peter Jones', title: 'IT Director', phone: '555-8765', email: 'peter.jones@quantum.com', status: 'Meeting Booked', assignedTo: 'AI Agent', lastContacted: '2023-10-26T14:30:00Z', nextFollowUp: null },
    { id: 4, company: 'Apex Industries', contact: 'Mary Williams', title: 'CEO', phone: '555-4321', email: 'mary.williams@apex.com', status: 'Not Interested', assignedTo: 'AI Agent', lastContacted: '2023-10-24T11:00:00Z', nextFollowUp: null },
    { id: 5, company: 'Dynamic Tech', contact: 'David Brown', title: 'Operations Lead', phone: '555-9988', email: 'david.brown@dynamic.com', status: 'Pending', assignedTo: 'AI Agent', lastContacted: null, nextFollowUp: null },
    { id: 6, company: 'Global Exports', contact: 'Sarah Chen', title: 'Logistics Coordinator', phone: '555-3344', email: 'sarah.chen@global.com', status: 'Pending', assignedTo: 'AI Agent', lastContacted: null, nextFollowUp: null },
    { id: 7, company: 'Future Gadgets', contact: 'Mike Rodriguez', title: 'Lead Engineer', phone: '555-5566', email: 'mike.r@futuregadgets.com', status: 'Follow Up', assignedTo: 'AI Agent', lastContacted: '2023-10-23T09:00:00Z', nextFollowUp: '2023-10-30T09:00:00Z' },
];

let MOCK_CALL_LOGS: CallLog[] = [
     {
        id: 'log_1672531200000',
        prospectId: 3,
        timestamp: '2023-10-26T14:30:00Z',
        summary: 'AI agent successfully booked a meeting with Peter Jones to discuss OmniSupport IT packages. Prospect is interested in a flat-rate solution.',
        disposition: 'Meeting Booked',
        transcription: [
            { source: 'model', text: 'Hello, is this Peter?' },
            { source: 'user', text: 'Yes, this is him.' },
            { source: 'model', text: 'Great, I\'m calling from OmniTech... (conversation continues)' }
        ],
        meetingDetails: {
            startTime: '2023-11-02T10:00:00Z',
            agenda: 'Discuss OmniSupport Managed IT services for Quantum Solutions.'
        }
    }
];

let MOCK_CALL_QUEUE: CallQueueItem[] = MOCK_PROSPECTS
    .filter(p => p.status === 'Pending' || p.status === 'Follow Up')
    .slice(0, 5) // Take first 5 for the demo queue
    .map((p, index) => ({ ...p, queuePosition: index }));


// --- API SERVICE ---
// This simulates an API layer. Replace the `setTimeout` calls
// with `fetch` calls to your actual backend endpoints.

const simulateNetwork = (delay = 500) => new Promise(res => setTimeout(res, delay));

export const apiService = {
    // === Authentication ===
    async login(email: string, password: string): Promise<User> {
        await simulateNetwork();
        const user = MOCK_USERS.find(u => u.email === email && u.passwordHash === password);
        if (!user) {
            throw new Error("Invalid email or password.");
        }
        const sessionUser = { ...user, token: `fake-jwt-token-${Date.now()}` };
        sessionStorage.setItem('omni_user_session', JSON.stringify(sessionUser));
        return sessionUser;
    },

    async logout(): Promise<void> {
        await simulateNetwork(200);
        sessionStorage.removeItem('omni_user_session');
    },

    async checkSession(): Promise<User | null> {
        await simulateNetwork(100);
        const sessionData = sessionStorage.getItem('omni_user_session');
        return sessionData ? JSON.parse(sessionData) : null;
    },

    // === Prospects ===
    async getProspects(): Promise<Prospect[]> {
        await simulateNetwork();
        // Return a deep copy to prevent direct mutation
        return JSON.parse(JSON.stringify(MOCK_PROSPECTS));
    },

    async addProspect(prospectData: Omit<Prospect, 'id' | 'status' | 'assignedTo' | 'lastContacted' | 'nextFollowUp'>): Promise<Prospect> {
        await simulateNetwork(400);
        const newId = MOCK_PROSPECTS.length > 0 ? Math.max(...MOCK_PROSPECTS.map(p => p.id)) + 1 : 1;
        const newProspect: Prospect = {
            ...prospectData,
            id: newId,
            status: 'Pending',
            assignedTo: 'Sales Agent', // Default assignment
            lastContacted: null,
            nextFollowUp: null,
        };
        MOCK_PROSPECTS.unshift(newProspect); // Add to the top of the list
        return { ...newProspect };
    },
    
    async updateProspectStatus(prospectId: number, status: Prospect['status']): Promise<Prospect> {
        await simulateNetwork(300);
        const prospectIndex = MOCK_PROSPECTS.findIndex(p => p.id === prospectId);
        if (prospectIndex === -1) throw new Error("Prospect not found");
        
        MOCK_PROSPECTS[prospectIndex].status = status;
        MOCK_PROSPECTS[prospectIndex].lastContacted = new Date().toISOString();
        
        return { ...MOCK_PROSPECTS[prospectIndex] };
    },

    // === Call Logs ===
    async getAllCallLogs(): Promise<CallLog[]> {
        await simulateNetwork();
        return JSON.parse(JSON.stringify(MOCK_CALL_LOGS));
    },

    async addCallLog(prospectId: number, logData: Omit<CallLog, 'id' | 'prospectId' | 'timestamp'>): Promise<CallLog> {
        await simulateNetwork(400);
        const newLog: CallLog = {
            ...logData,
            id: `log_${Date.now()}`,
            prospectId,
            timestamp: new Date().toISOString(),
        };
        MOCK_CALL_LOGS.push(newLog);
        return { ...newLog };
    },
    
    // === Tool Integrations ===
    async scheduleMeeting(prospectId: number, meetingDetails: { startTime: string; agenda: string }): Promise<void> {
        await simulateNetwork();
        console.log(`[API] Scheduling meeting for prospect ${prospectId}:`, meetingDetails);
        
        // Add meeting details to the relevant call log
        const relatedLog = MOCK_CALL_LOGS
            .filter(l => l.prospectId === prospectId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if (relatedLog) {
            relatedLog.meetingDetails = meetingDetails;
        } else {
             // If no log, create one
            const prospect = MOCK_PROSPECTS.find(p => p.id === prospectId);
            const summary = `Meeting booked with ${prospect?.contact} from ${prospect?.company}.`;
            const newLog: CallLog = {
                id: `log_${Date.now()}`,
                prospectId,
                timestamp: new Date().toISOString(),
                summary: summary,
                disposition: 'Meeting Booked',
                transcription: [],
                meetingDetails: meetingDetails
            };
            MOCK_CALL_LOGS.push(newLog);
        }

        // Here you would make an API call to your backend,
        // which would then use the Google Calendar API.
    },
    
    async sendSms(phoneNumber: string, message: string): Promise<void> {
        await simulateNetwork();
        console.log(`[API] Sending SMS to ${phoneNumber}: "${message}"`);
        // Here you would make an API call to your backend,
        // which would then use the Twilio API.
    },

    // === New Schedule and Queue APIs ===
    async getScheduledMeetings(): Promise<ScheduledMeeting[]> {
        await simulateNetwork();
        const meetings: ScheduledMeeting[] = [];
        MOCK_CALL_LOGS.forEach(log => {
            if (log.meetingDetails) {
                const prospect = MOCK_PROSPECTS.find(p => p.id === log.prospectId);
                if (prospect) {
                    meetings.push({
                        id: log.id,
                        prospectId: log.prospectId,
                        prospectName: prospect.contact,
                        companyName: prospect.company,
                        startTime: log.meetingDetails.startTime,
                        agenda: log.meetingDetails.agenda,
                    });
                }
            }
        });
        return meetings.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    },

    async getOutboundCallQueue(): Promise<CallQueueItem[]> {
        await simulateNetwork(300);
        return JSON.parse(JSON.stringify(MOCK_CALL_QUEUE));
    },

    async updateOutboundCallQueue(newQueue: CallQueueItem[]): Promise<CallQueueItem[]> {
        await simulateNetwork(200);
        MOCK_CALL_QUEUE = newQueue.map((item, index) => ({ ...item, queuePosition: index }));
        return JSON.parse(JSON.stringify(MOCK_CALL_QUEUE));
    }
};