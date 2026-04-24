export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {}
export class NotFoundError extends AppError {}
export class AuctionNotActiveError extends AppError {
  constructor() {
    super("Auction is not currently active");
  }
}
