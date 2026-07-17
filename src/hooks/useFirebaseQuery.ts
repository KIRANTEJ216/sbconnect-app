import { useQuery } from '@tanstack/react-query';
import {
  getAllProfiles, getMeetings, getLeaderboard,
  getAllRequests, getTotalBusinessValue,
  getAttendanceCompliance, getUserRSVPs, getBusinessProfile,
  getMeetingRSVPs, getUnverifiedProfiles, getRevenueConfig,
  getOnlineUsersCount,
} from '../lib/firestore';
import type { MeetingRSVP } from '../types';

export function useProfiles(max = 200) {
  return useQuery({
    queryKey: ['profiles', max, 'verified'],
    queryFn: () => getAllProfiles(max, true),
    staleTime: 1000 * 60 * 5,
  });
}

export function useMeetings(max = 50) {
  return useQuery({
    queryKey: ['meetings', max],
    queryFn: () => getMeetings(max),
    staleTime: 1000 * 60 * 2,
  });
}

export function useLeaderboardQuery() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
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

export function useTotalBusinessValue() {
  return useQuery({
    queryKey: ['totalBusinessValue'],
    queryFn: getTotalBusinessValue,
    staleTime: 1000 * 60,
    refetchInterval: 60000,
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
    staleTime: 1000 * 60 * 2,
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

export function useMeetingRSVPs(meetingId: string | null) {
  return useQuery({
    queryKey: ['meetingRSVPs', meetingId],
    queryFn: () => getMeetingRSVPs(meetingId!),
    enabled: !!meetingId,
    staleTime: 1000 * 60 * 2,
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
    refetchInterval: 30_000,
  });
}

export function useUnverifiedProfiles() {
  return useQuery({
    queryKey: ['unverifiedProfiles'],
    queryFn: getUnverifiedProfiles,
    staleTime: 1000 * 60 * 2,
  });
}

export function useRevenueConfig() {
  return useQuery({
    queryKey: ['revenueConfig'],
    queryFn: getRevenueConfig,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 60_000,
  });
}

export function useOnlineUsersCount() {
  return useQuery({
    queryKey: ['onlineUsersCount'],
    queryFn: getOnlineUsersCount,
    staleTime: 1000 * 30,
    refetchInterval: 30_000,
  });
}
