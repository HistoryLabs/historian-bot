export default interface GuildData {
    weekly: {
        channelId: string,
        pingRole?: string,
    },
    daily: {
        channelId: string,
        pingRole?: string,
    }
}