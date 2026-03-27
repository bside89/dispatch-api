export class PaginatedResultDto<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: T[];

  constructor(total: number, page: number, limit: number, data: T[]) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
    this.data = data;
  }
}
