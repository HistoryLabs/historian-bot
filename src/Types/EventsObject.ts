import { MonthDayString, MonthString } from './Dates';
import Event from './Event';

export default interface EventsObject {
    events: Event[];
    month: MonthString;
    day: MonthDayString;
    sourceURL: string;
    totalResults: number;
    getRandom: () => Event;
}