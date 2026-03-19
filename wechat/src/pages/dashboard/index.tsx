import { View, Text } from "@tarojs/components";
import Taro, { useLoad, usePullDownRefresh, useDidShow } from "@tarojs/taro";
import { useState, useCallback } from "react";
import { get, post } from "../../shared/api";
import type { Booking } from "../../shared/types";
import "./index.scss";

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<{ bookings: Booking[] }>("/api/bookings");
      if (res.statusCode === 200) {
        setBookings(res.data.bookings || []);
      }
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  }, []);

  useLoad(() => {
    fetchBookings();
  });

  useDidShow(() => {
    fetchBookings();
  });

  usePullDownRefresh(() => {
    fetchBookings();
  });

  const now = new Date();
  const upcomingBookings = bookings
    .filter(
      (b) =>
        new Date(b.startTime) >= now &&
        (b.status === "CONFIRMED" || b.status === "PENDING")
    )
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

  const pastBookings = bookings
    .filter(
      (b) =>
        new Date(b.startTime) < now ||
        b.status === "COMPLETED" ||
        b.status === "CANCELLED"
    )
    .sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

  const displayBookings = tab === "upcoming" ? upcomingBookings : pastBookings;

  const handleCancel = async (bookingId: string) => {
    const res = await Taro.showModal({
      title: "Cancel Booking",
      content: "Are you sure you want to cancel this booking?",
      confirmColor: "#dc2626",
    });
    if (!res.confirm) return;

    try {
      Taro.showLoading({ title: "Cancelling..." });
      const apiRes = await post(`/api/bookings/${bookingId}`, {
        action: "cancel",
        reason: "Cancelled by user",
      });
      Taro.hideLoading();
      if (apiRes.statusCode === 200) {
        Taro.showToast({ title: "Cancelled", icon: "success" });
        fetchBookings();
      } else {
        Taro.showToast({ title: "Cancel failed", icon: "none" });
      }
    } catch {
      Taro.hideLoading();
      Taro.showToast({ title: "Cancel failed", icon: "none" });
    }
  };

  const formatDateTime = (dateStr: string, timezone?: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-SG", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone || "Asia/Singapore",
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "Confirmed";
      case "PENDING": return "Pending";
      case "COMPLETED": return "Completed";
      case "CANCELLED": return "Cancelled";
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "CONFIRMED": return "dashboard__status--confirmed";
      case "PENDING": return "dashboard__status--pending";
      case "COMPLETED": return "dashboard__status--completed";
      case "CANCELLED": return "dashboard__status--cancelled";
      default: return "";
    }
  };

  return (
    <View className="dashboard">
      <View className="dashboard__tabs">
        <View
          className={`dashboard__tab ${tab === "upcoming" ? "dashboard__tab--active" : ""}`}
          hoverClass="dashboard__tab--hover"
          onClick={() => setTab("upcoming")}
        >
          Upcoming ({upcomingBookings.length})
        </View>
        <View
          className={`dashboard__tab ${tab === "past" ? "dashboard__tab--active" : ""}`}
          hoverClass="dashboard__tab--hover"
          onClick={() => setTab("past")}
        >
          Past ({pastBookings.length})
        </View>
      </View>

      {loading ? (
        <View className="dashboard__loading">
          {[1, 2, 3].map((i) => (
            <View key={i} className="dashboard__skeleton" />
          ))}
        </View>
      ) : displayBookings.length === 0 ? (
        <View className="dashboard__empty">
          <Text className="dashboard__empty-icon">
            {tab === "upcoming" ? "📅" : "📋"}
          </Text>
          <Text className="dashboard__empty-text">
            {tab === "upcoming"
              ? "No upcoming bookings"
              : "No past bookings"}
          </Text>
          <Text className="dashboard__empty-hint">
            {tab === "upcoming"
              ? "Book a session to get started"
              : "Your completed sessions will appear here"}
          </Text>
          {tab === "upcoming" && (
            <View
              className="dashboard__discover-btn"
              hoverClass="dashboard__discover-btn--hover"
              onClick={() => Taro.switchTab({ url: "/pages/discover/index" })}
            >
              Explore & Learn
            </View>
          )}
        </View>
      ) : (
        <View className="dashboard__list">
          {displayBookings.map((booking) => {
            const expertName =
              booking.expert.user.nickName ??
              booking.expert.user.name ??
              "Expert";
            return (
              <View
                key={booking.id}
                className="dashboard__card"
                hoverClass="dashboard__card--hover"
                onClick={() =>
                  Taro.navigateTo({
                    url: `/pages/expert/index?id=${booking.expertId}`,
                  })
                }
              >
                <View className="dashboard__card-header">
                  <View className="dashboard__card-avatar">
                    {expertName.charAt(0).toUpperCase()}
                  </View>
                  <View className="dashboard__card-info">
                    <Text className="dashboard__card-name">{expertName}</Text>
                    <Text className="dashboard__card-time">
                      {formatDateTime(booking.startTime, booking.timezone)}
                    </Text>
                  </View>
                  <View className={`dashboard__status ${getStatusClass(booking.status)}`}>
                    {getStatusLabel(booking.status)}
                  </View>
                </View>

                <View className="dashboard__card-details">
                  <Text className="dashboard__card-type">
                    {booking.sessionType === "OFFLINE" ? "📍 Offline" : "🖥 Online"}
                  </Text>
                  {booking.depositAmountCents && (
                    <Text className="dashboard__card-deposit">
                      {booking.currency} {(booking.depositAmountCents / 100).toFixed(2)} deposit
                    </Text>
                  )}
                </View>

                {booking.meetingLink && (
                  <View
                    className="dashboard__card-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      Taro.setClipboardData({
                        data: booking.meetingLink!,
                        success: () =>
                          Taro.showToast({ title: "Link copied", icon: "success" }),
                      });
                    }}
                  >
                    <Text className="dashboard__card-link-label">Meeting Link</Text>
                    <Text className="dashboard__card-link-action">Copy</Text>
                  </View>
                )}

                {booking.offlineAddress && (
                  <View className="dashboard__card-link">
                    <Text className="dashboard__card-link-label">📍 {booking.offlineAddress}</Text>
                  </View>
                )}

                {(booking.status === "CONFIRMED" || booking.status === "PENDING") && (() => {
                  const msUntil = new Date(booking.startTime).getTime() - Date.now();
                  const canRescheduleCancel = msUntil >= 2 * 60 * 60 * 1000;
                  if (!canRescheduleCancel) return (
                    <View className="dashboard__card-hint">
                      <Text>Cannot modify — starts within 2 hours</Text>
                    </View>
                  );
                  return (
                    <View className="dashboard__card-actions">
                      {booking.status === "CONFIRMED" && (
                        <View
                          className="dashboard__action-btn dashboard__action-btn--secondary"
                          hoverClass="dashboard__action-btn--hover"
                          onClick={(e) => {
                            e.stopPropagation();
                            Taro.navigateTo({
                              url: `/pages/book/index?id=${booking.expertId}&type=${booking.sessionType}&rescheduleId=${booking.id}`,
                            });
                          }}
                        >
                          Reschedule
                        </View>
                      )}
                      <View
                        className="dashboard__action-btn dashboard__action-btn--danger"
                        hoverClass="dashboard__action-btn--hover"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(booking.id);
                        }}
                      >
                        Cancel
                      </View>
                    </View>
                  );
                })()}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
