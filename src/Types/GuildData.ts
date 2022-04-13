export default interface GuildData {
    _id?: string,
    weekly: {
        channelId: string,
        time: number,
        pingRole?: string,
    },
    daily: {
        channelId: string,
        time: number,
        pingRole?: string,
    }
}