import { SlashCommandBuilder } from '@discordjs/builders';

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Get a list of commands'),
    new SlashCommandBuilder().setName('info').setDescription('Learn more about the bot'),
    new SlashCommandBuilder().setName('setchannel').setDescription('Sets events to be sent to this channel').addStringOption(option => 
        option.setName('interval')
            .setDescription('The interval at which events are sent')
            .setRequired(true)
            .addChoices(
                {
                    name: 'Daily',
                    value: 'daily',
                },
                {
                    name: 'Weekly',
                    value: 'weekly',
                }
            )
    ).addStringOption(option => 
        option.setName('time')
            .setDescription('The time you want events sent (in CST - default is 12 PM)')
            .addChoices(
                {
                    name: '12 AM',
                    value: '0',
                },
                {
                    name: '1 AM',
                    value: '1',
                },
                {
                    name: '2 AM',
                    value: '2',
                },
                {
                    name: '3 AM',
                    value: '3',
                },
                {
                    name: '4 AM',
                    value: '4',
                },
                {
                    name: '5 AM',
                    value: '5',
                },
                {
                    name: '6 AM',
                    value: '6',
                },
                {
                    name: '7 AM',
                    value: '7',
                },
                {
                    name: '8 AM',
                    value: '8',
                },
                {
                    name: '9 AM',
                    value: '9',
                },
                {
                    name: '10 AM',
                    value: '10',
                },
                {
                    name: '11 AM',
                    value: '11',
                },
                {
                    name: '12 PM',
                    value: '12',
                },
                {
                    name: '1 PM',
                    value: '13',
                },
                {
                    name: '2 PM',
                    value: '14',
                },
                {
                    name: '3 PM',
                    value: '15',
                },
                {
                    name: '4 PM',
                    value: '16',
                },
                {
                    name: '5 PM',
                    value: '17',
                },
                {
                    name: '6 PM',
                    value: '18',
                },
                {
                    name: '7 PM',
                    value: '19',
                },
                {
                    name: '8 PM',
                    value: '20',
                },
                {
                    name: '9 PM',
                    value: '21',
                },
				{
					name: '10 PM',
					value: '22',
				},
				{
					name: '11 PM',
					value: '23',
				},
            )
    ).addRoleOption(option => 
        option.setName('role').setDescription('A role to ping when events are sent')
    ),
    new SlashCommandBuilder().setName('removechannel').setDescription('Stops events from being sent to this channel').addStringOption(option => 
        option.setName('interval')
            .setDescription('The interval at which events are sent')
            .setRequired(true)
            .addChoices(
                {
                    name: 'Daily',
                    value: 'daily',
                },
                {
                    name: 'Weekly',
                    value: 'weekly',
                }
            )
    ),
    new SlashCommandBuilder().setName('event').setDescription('Gives a historical event for the day').addIntegerOption(option =>
        option.setName('min')
            .setDescription('The minimum year for the event (use negative for BC/BCE)')
			.setMinValue(-500)
			.setMaxValue(2022)
            .setRequired(false)
    ).addIntegerOption(option =>
        option.setName('max')
            .setDescription('The maximum year for the event (use negative for BC/BCE)')
			.setMinValue(-500)
			.setMaxValue(2022)
            .setRequired(false)
    ),
    new SlashCommandBuilder().setName('events').setDescription('Finds events for a specific date').addIntegerOption(option => 
        option.setName('month')
            .setDescription('The month of the event')
			.setMinValue(1)
			.setMaxValue(12)
            .setRequired(true)
    ).addIntegerOption(option => 
        option.setName('day')
            .setDescription('The day of the event')
			.setMinValue(1)
			.setMaxValue(31)
            .setRequired(true)
    ),
];

export default commands;