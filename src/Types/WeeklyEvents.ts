import { MonthDayString, MonthString, WeekDayString } from './Dates';
import Event from './Event';

export default interface WeeklyEvents {
    events: WeeklyEvent[],
    avgEvents: number,
}

export interface WeeklyEvent extends Event {
    month: MonthString,
    day: MonthDayString,
    currentWeekDay: WeekDayString;
}