import type { Deal } from '../types';

export interface LeaderboardDeal {
  id: string;
  receiverUid: string;
  receiverCompanyName: string;
  giverCompanyName: string;
  amount: string;
  amountValue?: number;
  createdAt: number;
}

export interface LeaderboardRow {
  key: string;
  /** Uid of the most recent deal's receiver — the company may span accounts. */
  receiverUid: string;
  receiverCompany: string;
  /** Distinct account uids behind this company; more than one means duplicate signups. */
  receiverUids: string[];
  /** Sum of every verified deal this company received. */
  totalValue: number;
  /** Deals Won — how many deals this company received. */
  dealCount: number;
  /**
   * Distinct giver companies, most recent deal first. The first entry is the
   * latest client; the rest are secondary context.
   */
  givers: string[];
  lastActivityAt: number;
}

function dealValue(d: LeaderboardDeal): number {
  if (typeof d.amountValue === 'number' && Number.isFinite(d.amountValue)) return d.amountValue;
  return parseFloat(String(d.amount || '0').replace(/[^0-9.]/g, '')) || 0;
}

/**
 * Rows are keyed on the receiving *company*, not the account uid. The same
 * company is often signed up more than once — FloLogix Automations alone had two
 * profiles — and keying by uid split its deals across duplicate rows, which is
 * the opposite of what a reader expects to see.
 */
function rowKey(d: LeaderboardDeal): string {
  const name = (d.receiverCompanyName || '').trim();
  return name ? `co:${name.toLowerCase()}` : `uid:${d.receiverUid}`;
}

/**
 * Business Leaderboard rows, one per receiving company.
 *
 * Previously this was grouped by *giver*, so a company that won three deals
 * appeared three times, each row showing that single deal's giver and value.
 * The leaderboard now answers "who is winning business?" instead, so rows are
 * keyed on the receiver: their deal count and value are summed, and their
 * clients are collapsed into one cell led by the most recent one.
 *
 * Only verified plain deals should be passed in — see `countsTowardDealsTotal`.
 */
export function buildBusinessLeaderboard(deals: LeaderboardDeal[]): LeaderboardRow[] {
  const rows = new Map<string, LeaderboardRow>();
  /** rowKey -> giver -> newest deal timestamp for that giver. */
  const latestByRowGiver = new Map<string, Map<string, number>>();

  for (const deal of deals) {
    const key = rowKey(deal);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        receiverUid: deal.receiverUid,
        receiverCompany: deal.receiverCompanyName,
        receiverUids: [],
        totalValue: 0,
        dealCount: 0,
        givers: [],
        lastActivityAt: 0,
      };
      rows.set(key, row);
    }
    row.totalValue += dealValue(deal);
    row.dealCount += 1;
    if ((deal.createdAt || 0) >= row.lastActivityAt) {
      row.lastActivityAt = deal.createdAt || 0;
      row.receiverUid = deal.receiverUid;
    }
    if (deal.receiverUid && !row.receiverUids.includes(deal.receiverUid)) {
      row.receiverUids.push(deal.receiverUid);
    }

    const giver = (deal.giverCompanyName || '').trim();
    if (giver) {
      if (!row.givers.includes(giver)) row.givers.push(giver);
      let latestFor = latestByRowGiver.get(key);
      if (!latestFor) {
        latestFor = new Map<string, number>();
        latestByRowGiver.set(key, latestFor);
      }
      latestFor.set(giver, Math.max(latestFor.get(giver) || 0, deal.createdAt || 0));
    }
  }

  // Latest client first, so the primary giver shown is the most recent one.
  // `latestByRowGiver` is filled during the single pass above, so ordering is a
  // sort over each row's own givers rather than a rescan of every deal per row.
  for (const row of rows.values()) {
    const latestFor = latestByRowGiver.get(row.key);
    row.givers = [...row.givers].sort(
      (a, b) => (latestFor?.get(b) ?? 0) - (latestFor?.get(a) ?? 0),
    );
  }

  return Array.from(rows.values()).sort(
    (a, b) => b.totalValue - a.totalValue || b.lastActivityAt - a.lastActivityAt,
  );
}

/** Narrow a Firestore deal to what the leaderboard needs. */
export function toLeaderboardDeal(d: Deal): LeaderboardDeal {
  return {
    id: d.id,
    receiverUid: d.receiverUid,
    receiverCompanyName: d.receiverCompanyName,
    giverCompanyName: d.giverCompanyName,
    amount: d.amount,
    amountValue: d.amountValue,
    createdAt: d.createdAt,
  };
}