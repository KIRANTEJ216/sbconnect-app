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
  surname: string;
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
  countryCode: string;
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
  paidDate: number;
  dripSentDays: number[];
  editCount: number;
  locked: boolean;
  lastRequestsViewedAt: number;
  referredByPhone: string;
  referredByName: string;
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
  guestCount: number;
  respondedAt: number;
}

export interface AppNotification {
  id: string;
  text: string;
  active: boolean;
  createdAt: number;
}

export interface UserNotification {
  id: string;
  uid: string;
  type: 'issue_resolved' | 'admin_message' | 'issue_reply' | 'deal_won' | 'deal_thanks';
  title: string;
  message: string;
  relatedId: string;
  read: boolean;
  createdAt: number;
}

export interface IssueReply {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  authorRole: 'user' | 'admin' | 'super_admin';
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
  replies: IssueReply[];
  createdAt: number;
}

export const LOCATIONS = [
  'Mumbai, Maharashtra',
  'Delhi, Delhi',
  'Bangalore, Karnataka',
  'Hyderabad, Telangana',
  'Chennai, Tamil Nadu',
  'Kolkata, West Bengal',
  'Pune, Maharashtra',
  'Ahmedabad, Gujarat',
  'Jaipur, Rajasthan',
  'Surat, Gujarat',
  'Lucknow, Uttar Pradesh',
  'Kanpur, Uttar Pradesh',
  'Nagpur, Maharashtra',
  'Indore, Madhya Pradesh',
  'Thane, Maharashtra',
  'Bhopal, Madhya Pradesh',
  'Visakhapatnam, Andhra Pradesh',
  'Vadodara, Gujarat',
  'Patna, Bihar',
  'Ludhiana, Punjab',
  'Agra, Uttar Pradesh',
  'Nashik, Maharashtra',
  'Faridabad, Haryana',
  'Meerut, Uttar Pradesh',
  'Rajkot, Gujarat',
  'Varanasi, Uttar Pradesh',
  'Srinagar, Jammu & Kashmir',
  'Aurangabad, Maharashtra',
  'Dhanbad, Jharkhand',
  'Amritsar, Punjab',
  'Navi Mumbai, Maharashtra',
  'Allahabad, Uttar Pradesh',
  'Ranchi, Jharkhand',
  'Howrah, West Bengal',
  'Coimbatore, Tamil Nadu',
  'Jabalpur, Madhya Pradesh',
  'Gwalior, Madhya Pradesh',
  'Vijayawada, Andhra Pradesh',
  'Jodhpur, Rajasthan',
  'Madurai, Tamil Nadu',
  'Raipur, Chhattisgarh',
  'Kota, Rajasthan',
  'Chandigarh, Chandigarh',
  'Guwahati, Assam',
  'Solapur, Maharashtra',
  'Hubli, Karnataka',
  'Mysore, Karnataka',
  'Tiruchirappalli, Tamil Nadu',
  'Bareilly, Uttar Pradesh',
  'Aligarh, Uttar Pradesh',
  'Tiruppur, Tamil Nadu',
  'Gurugram, Haryana',
  'Moradabad, Uttar Pradesh',
  'Jalandhar, Punjab',
  'Bhubaneswar, Odisha',
  'Salem, Tamil Nadu',
  'Warangal, Telangana',
  'Kochi, Kerala',
  'Bikaner, Rajasthan',
  'Udaipur, Rajasthan',
  'Kolhapur, Maharashtra',
  'Ajmer, Rajasthan',
  'Jamnagar, Gujarat',
  'Belgaum, Karnataka',
  'Jhansi, Uttar Pradesh',
  'Guntur, Andhra Pradesh',
  'Thiruvananthapuram, Kerala',
  'Ujjain, Madhya Pradesh',
  'Kozhikode, Kerala',
  'Dehradun, Uttarakhand',
  'Durgapur, West Bengal',
  'Asansol, West Bengal',
  'Kollam, Kerala',
  'Nellore, Andhra Pradesh',
  'Mangalore, Karnataka',
  'Panaji, Goa',
  'Shimla, Himachal Pradesh',
  'Haridwar, Uttarakhand',
  'Rishikesh, Uttarakhand',
  'Siliguri, West Bengal',
  'Pondicherry, Puducherry',
  'Imphal, Manipur',
  'Shillong, Meghalaya',
  'Agartala, Tripura',
  'Aizawl, Mizoram',
  'Kohima, Nagaland',
  'Gangtok, Sikkim',
  'Itanagar, Arunachal Pradesh',
  'Noida, Uttar Pradesh',
  'Ghaziabad, Uttar Pradesh',
  'Vellore, Tamil Nadu',
  'Tirunelveli, Tamil Nadu',
  'Cuttack, Odisha',
  'Bhavnagar, Gujarat',
  'Rohtak, Haryana',
  'Mathura, Uttar Pradesh',
  'Patiala, Punjab',
  'Saharanpur, Uttar Pradesh',
  'Muzaffarpur, Bihar',
  'New Delhi, Delhi',
] as const;

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

export interface RevenueConfig {
  target: number;
  financialYear: string;
  updatedBy: string;
  updatedAt: number;
}
