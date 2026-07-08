import { useQuery } from '@tanstack/react-query';
import {
  collectionGroup, getDocs, query as fbQuery, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getAllProfiles, getMeetings, getLeaderboard,
  getAllRequests, getTotalBusinessValue,
  getAttendanceCompliance, getUserRSVPs, getBusinessProfile,
  getMeetingRSVPs, getUnverifiedProfiles,
} from '../lib/firestore';
import type { MeetingRSVP } from '../types';

export function useProfiles(max = 999) {
  return useQuery({
    queryKey: ['profiles', max],
    queryFn: () => getAllProfiles(max),
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
    staleTime: 1000 * 30,
    refetchInterval: 30000,
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
      const snap = await getDocs(fbQuery(collectionGroup(db, 'rsvps'), orderBy('respondedAt', 'desc')));
      const map: Record<string, MeetingRSVP[]> = {};
      for (const d of snap.docs) {
        const meetingId = d.ref.parent.parent?.id || '';
        if (!map[meetingId]) map[meetingId] = [];
        map[meetingId].push({ id: d.id, ...d.data(), meetingId } as MeetingRSVP);
      }
      return map;
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useUnverifiedProfiles() {
  return useQuery({
    queryKey: ['unverifiedProfiles'],
    queryFn: getUnverifiedProfiles,
    staleTime: 1000 * 60 * 2,
  });
}
