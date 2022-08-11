import chalk from 'chalk';
import getEvents from '../utils/api/getEvents';
import getWeeklyEvents from '../utils/api/getWeeklyEvents';

export default async function apiTest() {
    const date = new Date();
    let errorCount: number = 0;

    const log = (msg: string) => console.log(`${chalk.yellow('[ApiTest]')} ${msg}`);

    log('Running tests...');

    await getEvents(date.getMonth(), date.getDate(), () => {
        log(`${chalk.red.bold('[ERR]')} getEvents() has failed!`);
        errorCount++;
    });

    await getWeeklyEvents(() => {
        log(`${chalk.red.bold('[ERR]')} getWeeklyEvents() has failed!`);
        errorCount++;
    });

    if (errorCount > 0) {
        log(`API Status: ${chalk.red(`${errorCount} tests failed`)}`);
    } else {
        log(`API Status: ${chalk.green('Healthy')}`);
    }
}