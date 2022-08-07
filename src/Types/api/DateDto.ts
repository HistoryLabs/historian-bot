export default interface DateDto {
	totalResults: number;
	sourceUrl: string;
	events: DateEvent[];
}

interface DateEvent {
	year: string;
	yearInt: number;
	event: string;
}