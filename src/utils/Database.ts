import { MongoClient, Collection, WithId } from 'mongodb';
import chalk from 'chalk';
import GuildData from '../Types/GuildData';

interface GuildResult {
    data: WithId<GuildData>,
    update: (data: GuildData) => void;
}

export default class Database {
    public guilds: Collection<GuildData>

    public async connect() {
        return new Promise<null>(resolve => {
            MongoClient.connect(`mongodb://${process.env.NODE_ENV !== 'DEV' ? `${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@` : ''}localhost:27017/`, (err, mongoClient) => {
                if (err || !mongoClient) throw `Mongo Connection Error: ${err ? err : 'CLIENT UNDEFINED'}`;
                console.log(`${chalk.yellow('[MongoDB]')} Connected to database.`);
                let database = mongoClient.db(process.env.DB_NAME);
                this.guilds = database.collection<GuildData>('guilds');
                resolve(null);
            });
        });
    }

    public async findGuild(id: string): Promise<GuildResult|null> {
        const guild = await this.guilds.findOne({
            _id: id,
        });

        if (guild) {
            return ({
                data: guild,
                update: (data: GuildData) => this.updateGuild(guild._id, data),
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