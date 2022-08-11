import { MonthString, MonthDayString, WeekDayString } from './Dates';

export default interface Event {
    sourceUrl: string;
    year: string;
    yearInt: number;
    content: string;
    weekDay?: WeekDayString;
}