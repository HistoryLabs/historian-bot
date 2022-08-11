export default interface YearDto {
	totalResults: number;
	sourceUrl: string;
	events: YearEvent[];
}

interface YearEvent {
	date: string;
	content: string;
}