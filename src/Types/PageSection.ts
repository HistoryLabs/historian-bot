export default interface PageSection { 
    title: string,
    content: string,
    items?: PageSection[],
}