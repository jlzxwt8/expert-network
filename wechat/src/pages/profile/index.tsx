import { View, Text, Image } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { useState, useCallback } from "react";
import { get } from "../../shared/api";
import { getApiBase, clearAuth, getUser } from "../../shared/auth";
import type { ExpertDetail, AuthUser } from "../../shared/types";
import "./index.scss";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(getUser());
  const [expert, setExpert] = useState<ExpertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpert, setIsExpert] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get<{ expert: ExpertDetail | null; user: AuthUser }>(
        "/api/profile"
      );
      if (res.statusCode === 200) {
        setUser(res.data.user);
        if (res.data.expert) {
          setExpert(res.data.expert);
          setIsExpert(true);
        }
      }
    } catch {
      // Profile fetch failed
    } finally {
      setLoading(false);
    }
  }, []);

  useLoad(() => {
    fetchProfile();
  });

  useDidShow(() => {
    fetchProfile();
  });

  const handleLogout = () => {
    Taro.showModal({
      title: "Logout",
      content: "Are you sure you want to logout?",
      success: (res) => {
        if (res.confirm) {
          clearAuth();
          Taro.reLaunch({ url: "/pages/index/index" });
        }
      },
    });
  };

  const API_BASE = getApiBase();

  if (loading) {
    return (
      <View className="profile">
        <View className="profile__skeleton">
          <View className="profile__skeleton-avatar" />
          <View className="profile__skeleton-line" />
          <View className="profile__skeleton-line profile__skeleton-line--short" />
        </View>
      </View>
    );
  }

  return (
    <View className="profile">
      {/* User header */}
      <View className="profile__header">
        {expert?.hasAvatar ? (
          <Image
            className="profile__avatar"
            src={`${API_BASE}/api/experts/${expert.id}/avatar`}
            mode="aspectFill"
          />
        ) : (
          <View className="profile__avatar-placeholder">
            {(user?.nickName ?? user?.name ?? "U").charAt(0).toUpperCase()}
          </View>
        )}
        <Text className="profile__name">
          {user?.nickName ?? user?.name ?? "User"}
        </Text>
        {user?.email && (
          <Text className="profile__email">{user.email}</Text>
        )}
        {isExpert && (
          <View className="profile__role-badge">Expert</View>
        )}
      </View>

      {/* Menu items */}
      <View className="profile__menu">
        {isExpert && (
          <>
            <View
              className="profile__menu-item"
              onClick={() =>
                Taro.navigateTo({
                  url: `/pages/expert/index?id=${expert?.id}`,
                })
              }
            >
              <Text className="profile__menu-icon">👤</Text>
              <Text className="profile__menu-label">View My Public Profile</Text>
              <Text className="profile__menu-arrow">→</Text>
            </View>
            <View
              className="profile__menu-item"
              onClick={() => {
                Taro.showToast({ title: "Coming soon", icon: "none" });
              }}
            >
              <Text className="profile__menu-icon">✏️</Text>
              <Text className="profile__menu-label">Edit Profile</Text>
              <Text className="profile__menu-arrow">→</Text>
            </View>
            <View
              className="profile__menu-item"
              onClick={() => {
                Taro.showToast({ title: "Coming soon", icon: "none" });
              }}
            >
              <Text className="profile__menu-icon">📅</Text>
              <Text className="profile__menu-label">Manage Availability</Text>
              <Text className="profile__menu-arrow">→</Text>
            </View>
          </>
        )}

        {!isExpert && (
          <View
            className="profile__menu-item"
            onClick={() =>
              Taro.navigateTo({ url: "/pages/onboarding/index" })
            }
          >
            <Text className="profile__menu-icon">🌟</Text>
            <Text className="profile__menu-label">Become an Expert</Text>
            <Text className="profile__menu-arrow">→</Text>
          </View>
        )}

        <View
          className="profile__menu-item"
          onClick={() =>
            Taro.switchTab({ url: "/pages/dashboard/index" })
          }
        >
          <Text className="profile__menu-icon">📋</Text>
          <Text className="profile__menu-label">My Bookings</Text>
          <Text className="profile__menu-arrow">→</Text>
        </View>

        <View className="profile__menu-item" onClick={handleLogout}>
          <Text className="profile__menu-icon">🚪</Text>
          <Text className="profile__menu-label profile__menu-label--danger">
            Logout
          </Text>
        </View>
      </View>

      {/* Expert stats */}
      {isExpert && expert && (
        <View className="profile__stats">
          <View className="profile__stat">
            <Text className="profile__stat-value">{expert.avgRating.toFixed(1)}</Text>
            <Text className="profile__stat-label">Rating</Text>
          </View>
          <View className="profile__stat">
            <Text className="profile__stat-value">{expert.reviewCount}</Text>
            <Text className="profile__stat-label">Reviews</Text>
          </View>
          <View className="profile__stat">
            <Text className="profile__stat-value">{expert.domains.length}</Text>
            <Text className="profile__stat-label">Domains</Text>
          </View>
        </View>
      )}
    </View>
  );
}
