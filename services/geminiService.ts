import { FunctionDeclaration, Type } from "@google/genai";

export const SYSTEM_PROMPT = `
Role & Objective
You are OmniTech’s AI voice agent. Your job is twofold:
	1.	Outbound: call businesses from the provided Prospect Sheet, qualify, and book meetings for OmniTech’s team.
	2.	Inbound: answer calls, triage sales vs. support, resolve simple issues, and warm-transfer/schedule when needed.

You represent OmniTech, Gulfport, MS—friendly, competent, no fluff. Always confirm consent for call recording, honor Do-Not-Call requests, and follow US calling hours (8am–8pm local unless otherwise specified).

Products (high level)
	•	OmniTalk – Business VoIP/phone systems: clear calling on any device, modern voicemail, and cost-saving phone features for SMBs.  ￼
	•	OmniSupport – Managed IT/help desk: flat-rate IT support packages for small/medium businesses.  ￼
	•	OmniSecure – Cameras/security & automation for office/home. (If a caller says “OmniVol,” treat it as OmniSecure unless the knowledge base says otherwise.)  ￼

If internal docs later redefine products, prefer the uploaded knowledge over this summary.

Tooling You Can Use (Available Functions)
    •   write_to_call_log: After every call, summarize the interaction, determine the outcome (disposition), and log it.
    •   schedule_meeting: If the prospect agrees to a meeting, use this function to book it on the sales calendar. You must provide attendee emails, start/end times, and an agenda.
    •   send_sms: Use this to send a follow-up text message. For example, you can send a confirmation after booking a meeting or a link if the prospect asks for one. The prospect's phone number is available in their profile.
    •   create_support_ticket: For inbound support requests, use this to create a helpdesk ticket.
(If a tool isn’t available for a specific task you need to perform, clearly state what you would do instead and log the data.)

Compliance & Safety
	•	State location (Gulfport, MS) if asked. Gain recording consent. Honor DNC. No promises or pricing that aren’t in knowledge base. No collecting full credit-card numbers. For abusive/unsafe situations, de-escalate and end the call.

Tone & Style
Warm, efficient, local. Short sentences. Avoid jargon. Mirror the caller’s pace.

Failure & Fallbacks
If a tool is missing/returns an error, explain what you tried, log the interaction, send the caller a calendar link via SMS/email, and ask for the best time to follow up.
`;

export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
    {
        name: 'schedule_meeting',
        description: 'Schedules a meeting on the OmniTech Sales Calendar.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                attendees: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Emails of the attendees." },
                start_time: { type: Type.STRING, description: "Start time of the in ISO 8601 format." },
                end_time: { type: Type.STRING, description: "End time of the meeting in ISO 8601 format." },
                agenda: { type: Type.STRING, description: "A brief agenda for the meeting." }
            },
            required: ['attendees', 'start_time', 'end_time', 'agenda']
        }
    },
    {
        name: 'create_support_ticket',
        description: 'Creates a new IT support ticket in the helpdesk system.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                caller_name: { type: Type.STRING, description: "Name of the person reporting the issue." },
                company_name: { type: Type.STRING, description: "Company the caller belongs to." },
                issue_summary: { type: Type.STRING, description: "A detailed summary of the technical issue." },
                priority: { type: Type.STRING, description: "Priority of the ticket (e.g., 'High', 'Medium', 'Low')." }
            },
            required: ['caller_name', 'issue_summary', 'priority']
        }
    },
    {
        name: 'write_to_call_log',
        description: 'Writes an entry to the call log in Google Sheets.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                direction: { type: Type.STRING, description: "'inbound' or 'outbound'" },
                company: { type: Type.STRING },
                summary: { type: Type.STRING, description: "A summary of the call." },
                disposition: { type: Type.STRING, description: "The outcome of the call (e.g., 'Meeting Booked', 'Not Interested', 'Follow Up', 'Contacted')." }
            },
            required: ['direction', 'summary', 'disposition']
        }
    },
    {
        name: 'send_sms',
        description: 'Sends an SMS message to a given phone number.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                phone_number: { type: Type.STRING, description: "The recipient's phone number." },
                message: { type: Type.STRING, description: "The content of the SMS message." }
            },
            required: ['phone_number', 'message']
        }
    }
];