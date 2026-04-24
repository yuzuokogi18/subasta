import { AuctionState, AUCTION_CONFIG, createInitialAuctionState } from "../entities/AuctionState";

export interface BidValidationResult {
  valid:          boolean;
  expectedAmount: number;
  reason?:        string;
}

export class AuctionDomainService {
  private state: AuctionState = createInitialAuctionState();

  getState(): Readonly<AuctionState> {
    return { ...this.state };
  }

  start(
    auctionId:       string,
    productName:     string,
    lotNumber:       string,
    productImageUrl: string | null,
    startingPrice:   number,
    durationSeconds: number
  ): void {
    this.state = {
      ...this.state,
      auctionId,
      productName,
      lotNumber,
      productImageUrl,
      currentPrice:  startingPrice,
      isActive:      true,
      startedAt:     new Date().toISOString(),
      timeRemaining: durationSeconds,
    };
  }

close(): void {
  this.state = { ...this.state, isActive: false };
}

  decrementTimer(): void {
    if (this.state.timeRemaining > 0) {
      this.state = { ...this.state, timeRemaining: this.state.timeRemaining - 1 };
    }
  }

  extendTimerIfNeeded(): boolean {
    if (this.state.timeRemaining < AUCTION_CONFIG.EXTEND_THRESHOLD_SECONDS) {
      this.state = { ...this.state, timeRemaining: AUCTION_CONFIG.EXTEND_THRESHOLD_SECONDS };
      return true;
    }
    return false;
  }

validateBid(amount: number) {
  const state = this.getState();

  const minIncrement = 0.01; // o lo que uses
  const minAllowed = Number(state.currentPrice) + minIncrement;

  if (amount < minAllowed) {
    return {
      valid: false,
      reason: `Minimum allowed is $${minAllowed}, got $${amount}`
    };
  }

  return { valid: true };
}

  applyBid(userId: string, nickname: string, amount: number): void {
    this.state = {
      ...this.state,
      currentPrice:   amount,
      leaderId:       userId,
      leaderNickname: nickname,
    };
  }

  isTimeUp(): boolean {
    return this.state.timeRemaining <= 0;
  }

  shouldBroadcastTick(): boolean {
    const t = this.state.timeRemaining;
    return t % 5 === 0 || t <= 10;
  }
}