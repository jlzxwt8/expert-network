import { View, Text } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";
import { useState, useEffect } from "react";
import { get, post } from "../../shared/api";
import type { ExpertDetail, AvailableSlot } from "../../shared/types";
import "./index.scss";

interface SlotsResponse {
  slots: AvailableSlot[];
  bookedSlots: { startTime: string; endTime: string }[];
}

export default function BookPage() {
  const router = useRouter();
  const expertId = router.params.id || "";
  const sessionType = router.params.type || "ONLINE";
  const [expert, setExpert] = useState<ExpertDetail | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!expertId) return;
    Promise.all([
      get<ExpertDetail>(`/api/experts/${expertId}`),
      get<SlotsResponse>(`/api/experts/${expertId}/slots`),
    ])
      .then(([expertRes, slotsRes]) => {
        if (expertRes.statusCode === 200) setExpert(expertRes.data);
        if (slotsRes.statusCode === 200) setSlots(slotsRes.data.slots || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [expertId]);

  const handleBook = async () => {
    if (!selectedSlot || booking) return;
    setBooking(true);

    const slot = slots.find((s) => s.id === selectedSlot);
    if (!slot) {
      setBooking(false);
      return;
    }

    try {
      const res = await post<{
        bookingId: string;
        paymentParams?: {
          timeStamp: string;
          nonceStr: string;
          package: string;
          signType: string;
          paySign: string;
        };
        depositSGD: string;
        depositCNY?: string;
        totalSGD: string;
      }>("/api/bookings/wechat-pay", {
        expertId,
        slotId: selectedSlot,
        sessionType,
        startTime: slot.startTime,
        endTime: slot.endTime,
      });

      if (res.statusCode !== 200 || !res.data?.bookingId) {
        throw new Error(
          (res.data as unknown as Record<string, string>)?.error || "Booking failed"
        );
      }

      if (res.data.paymentParams) {
        await Taro.requestPayment({
          timeStamp: res.data.paymentParams.timeStamp,
          nonceStr: res.data.paymentParams.nonceStr,
          package: res.data.paymentParams.package,
          signType: res.data.paymentParams.signType as "MD5" | "HMAC-SHA256" | "RSA",
          paySign: res.data.paymentParams.paySign,
        });
        Taro.showToast({ title: "Payment successful!", icon: "success" });
      } else {
        Taro.showToast({ title: "Booking created!", icon: "success" });
      }

      setTimeout(() => {
        Taro.switchTab({ url: "/pages/dashboard/index" });
      }, 1500);
    } catch (err: unknown) {
      const errObj = err as Record<string, unknown>;
      if (errObj?.errMsg === "requestPayment:fail cancel") {
        Taro.showToast({ title: "Payment cancelled", icon: "none" });
      } else {
        Taro.showToast({
          title:
            (errObj?.message as string) ||
            "Booking failed. Please try again.",
          icon: "none",
        });
      }
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View className="book-page">
        <View className="book-page__loading">Loading...</View>
      </View>
    );
  }

  if (!expert) {
    return (
      <View className="book-page">
        <View className="book-page__error">
          <Text>Expert not found</Text>
        </View>
      </View>
    );
  }

  const name = expert.user.nickName ?? expert.user.name ?? "Expert";
  const priceCents =
    sessionType === "OFFLINE"
      ? expert.priceOfflineCents
      : expert.priceOnlineCents;
  const priceLabel = priceCents
    ? `${expert.currency} ${Math.round(priceCents / 100)}/hr`
    : "";
  const depositLabel = priceCents
    ? `${expert.currency} ${(priceCents / 200).toFixed(2)} deposit`
    : "";

  const availableSlots = slots.filter((s) => !s.isBooked);
  const groupedSlots: Record<string, AvailableSlot[]> = {};
  availableSlots.forEach((slot) => {
    const date = new Date(slot.startTime).toLocaleDateString("en-SG", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (!groupedSlots[date]) groupedSlots[date] = [];
    groupedSlots[date].push(slot);
  });

  return (
    <View className="book-page">
      <View className="book-page__header">
        <Text className="book-page__expert-name">Book with {name}</Text>
        <Text className="book-page__session-type">
          {sessionType === "OFFLINE" ? "📍 Offline" : "🖥 Online"} Session
        </Text>
        {priceLabel && (
          <Text className="book-page__price">{priceLabel}</Text>
        )}
      </View>

      <View className="book-page__section">
        <Text className="book-page__section-title">Choose a Time Slot</Text>
        {availableSlots.length === 0 ? (
          <Text className="book-page__no-slots">
            No available slots. Please check back later.
          </Text>
        ) : (
          Object.entries(groupedSlots).map(([date, dateSlots]) => (
            <View key={date} className="book-page__date-group">
              <Text className="book-page__date-label">{date}</Text>
              <View className="book-page__slots">
                {dateSlots.map((slot) => (
                  <View
                    key={slot.id}
                    className={`book-page__slot ${
                      selectedSlot === slot.id
                        ? "book-page__slot--selected"
                        : ""
                    }`}
                    onClick={() => setSelectedSlot(slot.id)}
                  >
                    {new Date(slot.startTime).toLocaleTimeString("en-SG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" - "}
                    {new Date(slot.endTime).toLocaleTimeString("en-SG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </View>

      <View className="book-page__bottom-bar">
        {depositLabel && (
          <Text className="book-page__deposit">{depositLabel}</Text>
        )}
        <View
          className={`book-page__confirm-btn ${
            !selectedSlot || booking ? "book-page__confirm-btn--disabled" : ""
          }`}
          onClick={handleBook}
        >
          {booking ? "Processing..." : "Confirm & Pay"}
        </View>
      </View>
    </View>
  );
}
