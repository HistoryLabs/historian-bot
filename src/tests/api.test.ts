import chalk from 'chalk';
import getDailyEvent from '../utils/api/getDailyEvent';
import getEvents from '../utils/api/getEvents';
import getWeeklyEvents from '../utils/api/getWeeklyEvents';

export default async function apiTest() {
    const date = new Date();
    let errorCount: number = 0;

    await getEvents(date.getMonth(), date.getDate(), () => {
        console.log(`${chalk.yellow('[ApiTest]')} ${chalk.red.bold('[ERR]')} getEvents() has failed!`);
        errorCount++;
    });

    await getDailyEvent(() => {
        console.log(`${chalk.yellow('[ApiTest]')} ${chalk.red.bold('[ERR]')} getDailyEvent() has failed!`);
        errorCount++;
    });

    await getWeeklyEvents(() => {
        console.log(`${chalk.yellow('[ApiTest]')} ${chalk.red.bold('[ERR]')} getWeeklyEvents() has failed!`);
        errorCount++;
    });

    if (errorCount > 0) {
        console.log(`${chalk.yellow('[ApiTest]')} ${chalk.red.bold('[BAD]')} ${errorCount} API functions failed!`);
    } else {
        console.log(`${chalk.yellow('[ApiTest]')} API Status: ${chalk.green('Healthy')}`);
    }
}