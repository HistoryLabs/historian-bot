import WeeklyEvents from '../../Types/WeeklyEvents';
import getEvents from './getEvents';
import Event from '../../Types/Event';

export default function getWeeklyEvents(onError?: () => any): Promise<WeeklyEvents> {
    return new Promise(resolve => {
        const weeklyEvents: Event[] = [];
        const totalEvents: number[] = [];
        const date = new Date();
        setInterval(async () => {
            const events = await getEvents(date.getMonth(), date.getDate(), () => {
                onError();
                clearInterval();
            });
            
            weeklyEvents.push(events[Math.floor(Math.random() * events.length)]);
            totalEvents.push(events.length);
            date.setDate(date.getDate() + 1);
            
            if (weeklyEvents.length === 7) {
                clearInterval();
                resolve({
                    events: weeklyEvents,
                    avgEvents: Math.floor(totalEvents.reduce((a, b) => a + b) / events.length),
                });
            }
        }, 5000);
    });
}