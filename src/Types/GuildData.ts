export default interface GuildData {
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