import wiki from 'wikijs';
import dates from '../../dates.json';
import Event from '../../Types/Event';
import EventsObject from '../../Types/EventsObject';
import PageSection from '../../Types/PageSection';
import { MonthString, MonthDayString, WeekDayString } from '../../Types/Dates';

export default function getEvents(month: number, date: number, onError: () => any): Promise<EventsObject> {
    return new Promise(resolve => {
        const sourceURL = `https://en.wikipedia.org/wiki/${dates.monthsArray[month]}_${date}`;
        wiki().page(`${dates.monthsArray[month]}_${date}`).then(page => page.content()).then(result => {
            if (result) {
                const page = result as unknown as PageSection; // Temp measure until my PR gets approved in wikijs
                const eventsString = page[0].items ? `${page[0].items[0].content}\n${page[0].items[1].content}` : page[0].content;
                const eventsArray: string[] = eventsString.split('\n');
                const events: Event[] = eventsArray.map(event => {
                    const splitEvent: string[] = event.split(' – ');
                    const currentEventDate = new Date(`${month + 1}/${date}/${new Date().getFullYear()}`);
                    const eventDate = new Date(`${month + 1}/${date}/${splitEvent[0]}`);
                    return ({
                        month: dates.monthsArray[month] as MonthString,
                        day: dates.daysArray[date - 1] as MonthDayString,
                        currentWeekDay: dates.weekDaysArray[currentEventDate.getDay()] as WeekDayString,
                        eventWeekDay: dates.weekDaysArray[eventDate.getDay()] as WeekDayString,
                        year: parseInt(splitEvent[0]),
                        content: splitEvent[1],
                        sourceURL,
                    });
                });

                resolve({
                    events,
                    sourceURL,
                    month: dates.monthsArray[month] as MonthString,
                    day: dates.daysArray[date - 1] as MonthDayString,
                });
            } else {
                if (onError) onError();
            }
        }).catch(() => {
            if (onError) onError();
        });
    });
}