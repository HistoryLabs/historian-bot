import Event from '../../Types/Event';
import getEvents from './getEvents';

export default function getDailyEvent(onError?: () => any): Promise<Event> {
    return new Promise(async resolve => {
        const date = new Date();
        const events = await getEvents(date.getMonth(), date.getDate(), onError);
        resolve({
            ...events[Math.floor(Math.random() * events.length)],
            totalEvents: events.length,
        });
    });
}