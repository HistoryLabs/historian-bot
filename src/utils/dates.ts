import { MonthDayString, MonthString, WeekDayString } from '../Types/Dates';

const monthsArray: MonthString[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const daysArray: MonthDayString[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th', '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th', '29th', '30th', '31st'];
const weekDaysArray: WeekDayString[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const getMonthString = (month: number): MonthString => {
	return monthsArray[month];
}

export const getDayString = (day: number): MonthDayString => {
	return daysArray[day - 1];
}

export const getWeekdayString = (weekday: number): WeekDayString => {
	return weekDaysArray[weekday];
}