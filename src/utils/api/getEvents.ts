import Event from '../../Types/Event';
import EventsObject from '../../Types/EventsObject';
import EventsApi from '../EventsApi';
import { getDayString, getMonthString, getWeekdayString } from '../dates';

export default function getEvents(month: number, date: number, onError?: () => any, minYear?: number, maxYear?: number): Promise<EventsObject> {
    return new Promise<EventsObject>(async resolve => {
        const dateData = await EventsApi.getDate(month, date, {
            min: minYear,
            max: maxYear,
        });

        if (dateData === null) {
            if (onError) onError();
            return null;
        }

        const events = dateData.events.map<Event>((event) => {
            const eventDate = new Date(`${month + 1}/${date}/${event.year}`);

            return {
                ...event,
                sourceUrl: dateData.sourceUrl,
                weekday: getWeekdayString(eventDate.getDay()),
            }
        });

        const getRandom = () => {
            return events[Math.floor(Math.random() * events.length)];
        }

        resolve({
            events,
            sourceURL: dateData.sourceUrl,
            month: getMonthString(month),
            day: getDayString(date),
            totalResults: dateData.totalResults,
            getRandom,
        });
    });
}