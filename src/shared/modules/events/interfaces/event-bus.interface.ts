export interface EventBus {
  publish(name: string, event: any): Promise<void>;
}
