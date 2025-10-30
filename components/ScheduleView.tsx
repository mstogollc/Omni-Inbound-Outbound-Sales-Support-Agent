import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { ScheduledMeeting, CallQueueItem } from '../types';
import { CalendarDaysIcon, QueueListIcon } from './Icons';

export const ScheduleView: React.FC = () => {
    const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
    const [callQueue, setCallQueue] = useState<CallQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [meetingsData, queueData] = await Promise.all([
                apiService.getScheduledMeetings(),
                apiService.getOutboundCallQueue(),
            ]);
            setMeetings(meetingsData);
            setCallQueue(queueData);
        } catch (err) {
            setError('Failed to load schedule data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        e.dataTransfer.setData('draggedIndex', index.toString());
    };

    const handleDrop = async (e: React.DragEvent<HTMLLIElement>, dropIndex: number) => {
        const draggedIndex = parseInt(e.dataTransfer.getData('draggedIndex'), 10);
        const newQueue = [...callQueue];
        const [draggedItem] = newQueue.splice(draggedIndex, 1);
        newQueue.splice(dropIndex, 0, draggedItem);
        
        // Update state immediately for responsiveness
        setCallQueue(newQueue);

        // Persist the change
        try {
            await apiService.updateOutboundCallQueue(newQueue);
        } catch (err) {
            setError("Failed to save queue order. Please refresh.");
            // Optionally revert UI change
            fetchData();
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
        e.preventDefault();
    };


    if (isLoading) {
        return <div className="text-center p-10">Loading Schedule...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-400">{error}</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Schedule & Call Queue</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Booked Meetings */}
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2"><CalendarDaysIcon /> Booked Meetings</h2>
                    <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg space-y-3 max-h-[60vh] overflow-y-auto">
                        {meetings.length > 0 ? meetings.map(meeting => (
                            <div key={meeting.id} className="bg-gray-900/50 p-3 rounded-lg">
                                <p className="font-semibold text-teal-400">{new Date(meeting.startTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                <p className="text-white">{meeting.prospectName} <span className="text-gray-400">at</span> {meeting.companyName}</p>
                                <p className="text-sm text-gray-300 mt-1">Agenda: {meeting.agenda}</p>
                            </div>
                        )) : <p className="text-gray-400 text-center py-4">No meetings booked yet.</p>}
                    </div>
                </div>

                {/* Outbound Call Queue */}
                <div>
                    <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2"><QueueListIcon /> Tomorrow's Outbound Call Queue</h2>
                     <div className="bg-gray-800/70 p-4 rounded-xl shadow-lg max-h-[60vh] overflow-y-auto">
                        <p className="text-sm text-gray-400 mb-4">Drag and drop to reorder the AI's call priority.</p>
                        <ul className="space-y-2">
                            {callQueue.map((item, index) => (
                                <li 
                                    key={item.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragOver={handleDragOver}
                                    className="bg-gray-900/50 p-3 rounded-lg flex items-center gap-4 cursor-grab active:cursor-grabbing"
                                >
                                    <span className="text-lg font-bold text-gray-500">{index + 1}</span>
                                    <div>
                                        <p className="font-semibold text-white">{item.contact}</p>
                                        <p className="text-sm text-gray-400">{item.company}</p>
                                    </div>
                                    <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-500 text-gray-900">{item.status}</span>
                                </li>
                            ))}
                        </ul>
                     </div>
                </div>
            </div>
        </div>
    );
};