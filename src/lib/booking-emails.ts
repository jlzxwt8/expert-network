import { sendBookingEmails } from "@/lib/email";

interface BookingWithRelations {
  id: string;
  sessionType: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  meetingLink: string | null;
  offlineAddress: string | null;
  expert: {
    user: {
      name: string | null;
      nickName: string | null;
      email: string | null;
    };
  };
  founder: {
    name: string | null;
    nickName: string | null;
    email: string | null;
  };
}

/**
 * Fire-and-forget: send confirmation + schedule reminder emails for a booking.
 * Call this after a booking is created/confirmed with expert.user and founder included.
 */
export function triggerBookingEmails(booking: BookingWithRelations): void {
  sendBookingEmails({
    bookingId: booking.id,
    expertName: booking.expert.user.nickName || booking.expert.user.name || "Expert",
    founderName: booking.founder.nickName || booking.founder.name || "Client",
    expertEmail: booking.expert.user.email,
    founderEmail: booking.founder.email,
    sessionType: booking.sessionType as "ONLINE" | "OFFLINE",
    startTime: booking.startTime instanceof Date ? booking.startTime : new Date(booking.startTime),
    endTime: booking.endTime instanceof Date ? booking.endTime : new Date(booking.endTime),
    timezone: booking.timezone,
    meetingLink: booking.meetingLink,
    offlineAddress: booking.offlineAddress,
  }).catch((err) => console.error("[booking-emails]", err));
}
