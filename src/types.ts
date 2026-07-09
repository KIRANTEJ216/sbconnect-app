export interface AppUser {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
  photoURL: string;
  onlineStatus: 'online' | 'offline' | 'away';
  role: 'user' | 'admin' | 'super_admin';
  lastSeen: number;
  createdAt: number;
}

export const ROLES = ['user', 'admin', 'super_admin'] as const;

export interface BusinessProfile {
  uid: string;
  ownerName: string;
  ownerSurname: string;
  phone: string;
  companyName: string;
  categories: string[];
  companySize: string;
  location: string;
  contactEmail: string;
  website: string;
  description: string;
  photoURL: string;
  keywords: string[];
  catalogURLs: string[];
  qrCodeURL: string;
  verified: boolean;
  membershipStatus: 'active' | 'inactive' | 'expired';
  membershipExpiry: number;
  membershipDate: number;
  editCount: number;
  locked: boolean;
  lastRequestsViewedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface Request {
  id: string;
  uid: string;
  companyName: string;
  title: string;
  description: string;
  category: string;
  customCategory: string;
  budget: string;
  deadline: string;
  status: 'open' | 'closed';
  awardedTo: string | null;
  interestCount: number;
  interestedUids: string[];
  requesterPhone: string;
  createdAt: number;
}

export interface Interest {
  id: string;
  requestId: string;
  uid: string;
  companyName: string;
  phone: string;
  message: string;
  createdAt: number;
}

export interface Deal {
  id: string;
  requestId: string;
  requestTitle: string;
  giverUid: string;
  giverCompanyName: string;
  receiverUid: string;
  receiverCompanyName: string;
  amount: string;
  createdAt: number;
}

export interface LeaderboardEntry {
  companyName: string;
  ownerName: string;
  uid: string;
  totalRevenue: number;
  dealCount: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantPhotos: Record<string, string>;
  lastMessage: string;
  lastMessageAt: number;
  lastSenderId: string;
  unreadCount: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  read: boolean;
}

export const REQUEST_CATEGORIES = [
  'Technology',
  'Construction',
  'Marketing',
  'Finance',
  'Logistics',
  'Consulting',
  'Electrical',
  'Other',
] as const;

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;

export interface Meeting {
  id: string;
  date: string;
  label: string;
  location: string;
  qrCodeURL: string;
  active: boolean;
  createdAt: number;
  rsvpEnabled: boolean;
}

export interface Attendance {
  id: string;
  meetingId: string;
  uid: string;
  displayName: string;
  companyName: string;
  scannedAt: number;
}

export interface MeetingRSVP {
  id: string;
  meetingId: string;
  uid: string;
  displayName: string;
  companyName: string;
  response: 'yes' | 'no' | 'maybe';
  respondedAt: number;
}

export interface AppNotification {
  id: string;
  text: string;
  active: boolean;
  createdAt: number;
}

export interface IssueReport {
  id: string;
  uid: string;
  userEmail: string;
  userDisplayName: string;
  companyName: string;
  page: string;
  subject: string;
  description: string;
  status: 'open' | 'resolved';
  adminNote: string;
  createdAt: number;
}

export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail',
  'Hospitality',
  'Construction',
  'Real Estate',
  'Legal',
  'Consulting',
  'Marketing',
  'Logistics',
  'Agriculture',
  'Energy',
  'Media',
  'Telecommunications',
  'Transportation',
  'Other',
] as const;
