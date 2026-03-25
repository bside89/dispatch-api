export class ProcessOrderJobData {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
    public readonly total: number,
  ) {}
}

export class ShipOrderJobData {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}

export class DeliverOrderJobData {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}

export class CancelOrderJobData {
  constructor(
    public readonly userId: string,
    public readonly orderId: string,
  ) {}
}
