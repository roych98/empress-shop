export interface EntryFeeConfig {
  essenceRequired: number;
  stoneRequired: number;
  essencePriceWS: number;
  stonePriceWS: number;
}

export interface ParticipantShareInput {
  playerId: string;
  shareModifier?: number;
}

export interface SplitAmount {
  playerId: string;
  amountWS: number;
}

export interface SplitResult {
  total: number;
  perParticipant: SplitAmount[];
}

/**
 * Compute the total entry fee for a run in white scrolls.
 */
export const computeTotalEntryFeeWS = ({
  essenceRequired,
  stoneRequired,
  essencePriceWS,
  stonePriceWS,
}: EntryFeeConfig): number => {
  const essenceTotal = essenceRequired * essencePriceWS;
  const stoneTotal = stoneRequired * stonePriceWS;
  const total = essenceTotal + stoneTotal;
  return roundToTwo(total);
};

/**
 * Evenly distribute an amount across participants, optionally weighted by shareModifier.
 * Rounds to 2 decimals and distributes any remainder starting from the first participants.
 * Supports negative amounts (when entry fees exceed sale proceeds).
 */
export const computeSplitByShares = (
  totalAmountWS: number,
  participants: ParticipantShareInput[]
): SplitResult => {
  if (participants.length === 0) {
    return { total: 0, perParticipant: [] };
  }

  // Handle zero case
  if (totalAmountWS === 0) {
    return {
      total: 0,
      perParticipant: participants.map((p) => ({
        playerId: p.playerId,
        amountWS: 0,
      })),
    };
  }

  const weights = participants.map((p) => p.shareModifier ?? 1);
  const weightSum = weights.reduce((acc, w) => acc + w, 0);

  if (weightSum <= 0) {
    // fallback to equal split
    const equal = totalAmountWS / participants.length;
    const roundedEqual = roundToTwo(equal);
    const baseTotal = roundedEqual * participants.length;
    let remainder = roundToTwo(totalAmountWS - baseTotal);

    const perParticipant: SplitAmount[] = participants.map((p) => ({
      playerId: p.playerId,
      amountWS: roundedEqual,
    }));

    // Distribute remainder (works for both positive and negative)
    let idx = 0;
    const cent = remainder > 0 ? 0.01 : -0.01;
    while (Math.abs(remainder) > 0.001 && idx < perParticipant.length) {
      perParticipant[idx].amountWS = roundToTwo(
        perParticipant[idx].amountWS + cent
      );
      remainder = roundToTwo(remainder - cent);
      idx += 1;
    }

    return {
      total: roundToTwo(
        perParticipant.reduce((acc, p) => acc + p.amountWS, 0)
      ),
      perParticipant,
    };
  }

  const rawShares = participants.map((p, index) => {
    const ratio = weights[index] / weightSum;
    return {
      playerId: p.playerId,
      rawAmount: totalAmountWS * ratio,
    };
  });

  const rounded = rawShares.map((s) => ({
    playerId: s.playerId,
    amountWS: roundToTwo(s.rawAmount),
  }));

  const roundedTotal = rounded.reduce((acc, p) => acc + p.amountWS, 0);
  let remainder = roundToTwo(totalAmountWS - roundedTotal);

  // Distribute remainder (works for both positive and negative)
  let idx = 0;
  const cent = remainder > 0 ? 0.01 : -0.01;
  while (Math.abs(remainder) > 0.001 && idx < rounded.length) {
    rounded[idx].amountWS = roundToTwo(rounded[idx].amountWS + cent);
    remainder = roundToTwo(remainder - cent);
    idx += 1;
  }

  return {
    total: roundToTwo(
      rounded.reduce((acc, p) => acc + p.amountWS, 0)
    ),
    perParticipant: rounded,
  };
};

/**
 * Compute net sale proceeds after deducting any remaining unpaid entry fees for the run.
 * Can be negative if entry fees exceed sale proceeds.
 */
export const computeNetAfterFeesWS = (
  totalPriceWS: number,
  remainingUnpaidEntryFeeWS: number
): number => {
  const net = totalPriceWS - Math.max(0, remainingUnpaidEntryFeeWS);
  return roundToTwo(net);
};

/**
 * Given a sale total and remaining unpaid entry fee plus participants,
 * compute the net and the per-participant split (based on shareModifier).
 */
export const computeSaleSplit = (
  totalPriceWS: number,
  remainingUnpaidEntryFeeWS: number,
  participants: ParticipantShareInput[]
): { netAfterFeesWS: number; split: SplitResult } => {
  const netAfterFeesWS = computeNetAfterFeesWS(
    totalPriceWS,
    remainingUnpaidEntryFeeWS
  );
  const split = computeSplitByShares(netAfterFeesWS, participants);
  return { netAfterFeesWS, split };
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

