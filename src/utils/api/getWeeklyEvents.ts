import WeeklyEvents, { WeeklyEvent } from '../../Types/WeeklyEvents';
import { getWeekdayString } from '../dates';
import getEvents from './getEvents';

export default function getWeeklyEvents(onError?: () => any): Promise<WeeklyEvents> {
    return new Promise(resolve => {
        const weeklyEvents: WeeklyEvent[] = [];
        const totalEvents: number[] = [];
        const date = new Date();
        const interval = setInterval(async () => {
            const events = await getEvents(date.getMonth(), date.getDate(), () => {
                if (onError) onError();
                clearInterval(interval);
            });
            
            const selectedEvent = events.getRandom();

            weeklyEvents.push({
                ...selectedEvent,
                month: events.month,
                day: events.day,
                currentWeekDay: getWeekdayString(weeklyEvents.length),
            });

            totalEvents.push(events.totalResults);
            date.setDate(date.getDate() + 1);
            
            if (weeklyEvents.length === 7) {
                clearInterval(interval);
                resolve({
                    events: weeklyEvents,
                    avgEvents: Math.floor(totalEvents.reduce((a, b) => a + b) / events.totalResults),
                });
            }
        }, 5000);
    });
}