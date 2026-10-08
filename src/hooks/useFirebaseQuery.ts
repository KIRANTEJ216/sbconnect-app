import { useQuery } from '@tanstack/react-query';
import {
  getAllProfiles, getMeetings,
  getAllRequests,
  getAttendanceCompliance, getUserRSVPs, getBusinessProfile,
  getMeetingRSVPs, getRevenueConfig,
  getOnlineUsersCount, getDeals,
  getReferralLeaderboard,
  getReferralRevenueEntries, getPendingRevenueEntries, getUserRevenueEntries,
  getRevenueSummary,
} from '../lib/firestore';
import type { MeetingRSVP } from '../types';

export function useProfiles(max = 200) {
  return useQuery({
    queryKey: ['profiles', max, 'verified'],
    queryFn: () => getAllProfiles(max, true),
    staleTime: 1000 * 60 * 10,
  });
}

export function useMeetings(max = 50) {
  return useQuery({
    queryKey: ['meetings', max],
    queryFn: () => getMeetings(max),
    staleTime: 1000 * 60 * 2,
  });
}

export function useRequestsQuery(max = 999) {
  return useQuery({
    queryKey: ['requests', max],
    queryFn: () => getAllRequests(max),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * One read of the deal ledger feeds every revenue figure. The three aggregate
 * hooks below share this query key, so TanStack dedupes them into a single fetch
 * per interval instead of three separate full-collection scans.
 */
export function useTotalBusinessValue() {
  return useQuery({
    queryKey: ['revenueSummary'],
    queryFn: getRevenueSummary,
    select: (s) => s.verifiedDeals,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 300000,
  });
}

export function useTotalReferralRevenue() {
  return useQuery({
    queryKey: ['revenueSummary'],
    queryFn: getRevenueSummary,
    select: (s) => ({ totalValue: s.verifiedReferrals, pendingValue: s.pendingReferrals }),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 300000,
  });
}

export function useReferralLeaderboardQuery() {
  return useQuery({
    queryKey: ['referralLeaderboard'],
    queryFn: getReferralLeaderboard,
    staleTime: 1000 * 60 * 10,
    refetchInterval: 600000,
  });
}

export function useReferralRevenueEntriesQuery() {
  return useQuery({
    queryKey: ['referralRevenueEntries'],
    queryFn: getReferralRevenueEntries,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 300000,
  });
}

export function usePendingRevenueQuery() {
  return useQuery({
    queryKey: ['pendingRevenue'],
    queryFn: getPendingRevenueEntries,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 300000,
  });
}

/** Value + count of member-submitted revenue still awaiting verification. */
export function usePendingRevenueTotalsQuery() {
  return useQuery({
    queryKey: ['revenueSummary'],
    queryFn: getRevenueSummary,
    select: (s) => ({
      pendingDeals: s.pendingDeals,
      pendingDealsCount: s.pendingDealsCount,
      pendingReferrals: s.pendingReferrals,
      pendingReferralsCount: s.pendingReferralsCount,
      total: s.pendingDeals + s.pendingReferrals,
      totalCount: s.pendingDealsCount + s.pendingReferralsCount,
    }),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 300000,
  });
}

export function useMyRevenueEntries(uid: string | undefined) {
  return useQuery({
    queryKey: ['myRevenueEntries', uid],
    queryFn: () => getUserRevenueEntries(uid!),
    enabled: !!uid,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 300000,
  });
}

export function useAttendanceCompliance(uid: string | undefined) {
  return useQuery({
    queryKey: ['attendanceCompliance', uid],
    queryFn: () => getAttendanceCompliance(uid!),
    enabled: !!uid,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUserRSVPs(uid: string | undefined) {
  return useQuery({
    queryKey: ['userRSVPs', uid],
    queryFn: () => getUserRSVPs(uid!),
    enabled: !!uid,
    staleTime: 1000 * 60 * 5,
  });
}

export function useBusinessProfile(uid: string | undefined) {
  return useQuery({
    queryKey: ['businessProfile', uid],
    queryFn: () => getBusinessProfile(uid!),
    enabled: !!uid,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllRsvpsByMeeting() {
  return useQuery({
    queryKey: ['allRsvpsByMeeting'],
    queryFn: async () => {
      const allMeetings = await getMeetings();
      const entries = await Promise.all(
        allMeetings.map((m) => getMeetingRSVPs(m.id).then((rsvps) => [m.id, rsvps] as const))
      );
      return Object.fromEntries(entries) as Record<string, MeetingRSVP[]>;
    },
    staleTime: 0,
    refetchInterval: 300_000,
  });
}

export function useRevenueConfig() {
  return useQuery({
    queryKey: ['revenueConfig'],
    queryFn: getRevenueConfig,
    staleTime: 1000 * 60 * 5,
    refetchInterval: 60_000,
  });
}

export function useOnlineUsersCount() {
  return useQuery({
    queryKey: ['onlineUsersCount'],
    queryFn: getOnlineUsersCount,
    staleTime: 1000 * 30,
    refetchInterval: 120_000,
  });
}

export function useAllDealsQuery() {
  return useQuery({
    queryKey: ['allDeals'],
    queryFn: getDeals,
    staleTime: 1000 * 60 * 2,
  });
}
