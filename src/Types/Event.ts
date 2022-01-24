import { MonthString, MonthDayString, WeekDayString } from './Dates';

export default interface Event {
    month: MonthString,
    day: MonthDayString,
    currentWeekDay: WeekDayString,
    eventWeekDay: WeekDayString,
    year: number,
    content: string,
    sourceURL: string,
    totalEvents?: number,
}