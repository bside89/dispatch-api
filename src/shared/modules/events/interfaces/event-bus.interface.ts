export interface EventBus {
  publish(name: string, event: any): Promise<void>;

  publishBulk(event: any[]): Promise<void>;
}
