import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToConversations } from '../lib/firestore';
import { formatDate } from '../lib/format';
import type { Conversation } from '../types';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedPage } from '../components/motion/AnimatedPage';
import { TiltCard } from '../components/motion/TiltCard';
import { StaggerList, StaggerItem } from '../components/motion/StaggerList';

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(user.uid, (convs) => {
      setConversations(convs);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const getOtherName = (conv: Conversation) => {
    if (!user) return 'Unknown';
    const otherId = conv.participants.find((p) => p !== user.uid);
    return otherId ? conv.participantNames[otherId] || 'User' : 'Unknown';
  };

  const unreadTotal = conversations.reduce(
    (sum, c) => sum + ((user && c.unreadCount[user.uid]) || 0),
    0,
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-[2.5rem]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-fluid-h1 font-bold text-charcoal tracking-tight">Messages</h1>
          <p className="text-steel mt-1.5 gradient-text">
            {unreadTotal > 0
              ? `${unreadTotal} unread message${unreadTotal > 1 ? 's' : ''}`
              : 'No unread messages'}
          </p>
        </div>
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="p-14 text-center">
            <p className="text-muted">No conversations yet.</p>
            <p className="text-sm text-muted mt-2">
              Visit a business profile and send a message to start chatting.
            </p>
            <Link
              to="/profiles"
              className="text-primary hover:text-primary-hover text-sm mt-4 inline-block transition-colors"
            >
              Browse Profiles
            </Link>
          </CardContent>
        </Card>
      ) : (
        <StaggerList className="space-y-2">
          {conversations.map((conv) => {
            const unread = (user && conv.unreadCount[user.uid]) || 0;

            return (
              <StaggerItem key={conv.id}>
              <Link to={`/chat/${conv.id}`}>
                <TiltCard>
                <Card
                  className={`hover:shadow-card-hover transition-all duration-300 cursor-pointer hover:-translate-y-0.5 ${
                    unread > 0 ? 'border-primary/30 bg-primary-light/30' : ''
                  }`}
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-light rounded-2xl flex items-center justify-center text-primary font-semibold flex-shrink-0">
                      {getOtherName(conv).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-sm tracking-tight ${unread > 0 ? 'font-bold text-charcoal' : 'font-medium text-charcoal'}`}>
                          {getOtherName(conv)}
                        </h3>
                        <span className="text-xs text-muted font-mono">
                          {conv.lastMessageAt
                            ? formatDate(conv.lastMessageAt)
                            : ''}
                        </span>
                      </div>
                      <p className={`text-sm truncate mt-0.5 ${unread > 0 ? 'font-medium text-charcoal' : 'text-muted'}`}>
                        {conv.lastMessage || 'Start a conversation'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-white font-bold">{unread}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                </TiltCard>
              </Link>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </div>
    </AnimatedPage>
  );
}
