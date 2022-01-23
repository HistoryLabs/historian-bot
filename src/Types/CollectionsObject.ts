import { Collection } from 'discord.js';

export default interface CollectionsObject {
    commands: Collection<string, any>,
    events: Collection<string, any>,
}