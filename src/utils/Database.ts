import { MongoClient, Collection, WithId } from 'mongodb';
import chalk from 'chalk';
import GuildData from '../Types/GuildData';

interface GuildResult {
    data: WithId<GuildData>,
    update: (data: GuildData) => void;
}

export default class Database {
    private guilds: Collection<GuildData>

    constructor () {
        MongoClient.connect('mongodb://localhost:27017/', (err, mongoClient) => {
            if (err || !mongoClient) throw `Mongo Connection Error: ${err ? err : 'CLIENT UNDEFINED'}`;
            console.log(`${chalk.yellow('[MongoDB]')} Connected to database.`)
            let database = mongoClient.db(process.env.DB_NAME);
            this.guilds = database.collection<GuildData>('guilds');
        });
    }

    public getAllGuilds() {
        return this.guilds.find();
    }

    public async findGuild(id: string): Promise<GuildResult|null> {
        const guild = await this.guilds.findOne({
            _id: id,
        });

        if (guild) {
            return ({
                data: guild,
                update: (data: GuildData) => this.updateGuild(guild._id as unknown as string, data),
            });
        } else {
            return null;
        }
    }

    public addGuild(id: string, data: GuildData) {
        this.guilds.insertOne({
            ...data,
            _id: id,
        });
    }

    public updateGuild(id: string, data: GuildData) {
        this.guilds.replaceOne({
            _id: id,
        }, data);
    }

    public removeGuild(id: string) {
        this.guilds.deleteOne({
            _id: id,
        });
    }
}