import axios, { AxiosInstance } from 'axios';
import DateDto from '../Types/api/DateDto';
import YearDto from '../Types/api/YearDto';

interface FilterOptions {
	min?: number;
	max?: number;
}

class EventsApi {
	private readonly axios: AxiosInstance;

	constructor() {
		this.axios = axios.create({
			baseURL: process.env.EVENTS_API_URL,
		});
	}

	public async getDate(month: number, day: number, yearFilters?: FilterOptions): Promise<DateDto|null> {
		const response = await this.axios.get<DateDto>('/date', {
			params: {
				month,
				day,
				minYear: yearFilters?.min,
				maxYear: yearFilters?.max,
			},
		});

		if (response.status === 200) {
			return response.data;
		} else {
			return null;
		}
	}

	public async getYear(year: number, onlyDated?: boolean): Promise<YearDto|null> {
		const response = await this.axios.get('/year', {
			params: {
				year,
				onlyDated,
			}
		});

		if (response.status === 200) {
			return response.data;
		} else {
			return null;
		}
	}
}

export default new EventsApi();