import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";
import "./index.scss";

export default function IndexPage() {
  const [statusBarHeight] = useState(() => {
    const sysInfo = Taro.getSystemInfoSync();
    return sysInfo.statusBarHeight || 20;
  });

  const goDiscover = () => {
    Taro.switchTab({ url: "/pages/discover/index" });
  };

  const goOnboarding = () => {
    Taro.navigateTo({ url: "/pages/onboarding/index" });
  };

  return (
    <View className="landing">
      <View style={{ height: `${statusBarHeight}px` }} />
      <View className="landing__hero">
        <View className="landing__logo-wrap">
          <View className="landing__logo">H&G</View>
        </View>
        <Text className="landing__title">Help&Grow</Text>
        <Text className="landing__subtitle">
          AI Startup Hub for Singapore & Southeast Asia
        </Text>
        <Text className="landing__desc">
          Where founders, experts, and investors learn from each other.
          Book 1-on-1 sessions and grow together.
        </Text>
      </View>

      <View className="landing__actions">
        <View
          className="landing__btn landing__btn--primary"
          hoverClass="landing__btn--hover"
          onClick={goDiscover}
        >
          Explore & Learn
        </View>
        <View
          className="landing__btn landing__btn--outline"
          hoverClass="landing__btn--hover"
          onClick={goOnboarding}
        >
          Join the Community
        </View>
      </View>

      <View className="landing__features">
        <View className="landing__feature" hoverClass="landing__feature--hover">
          <View className="landing__feature-icon-wrap landing__feature-icon-wrap--blue">
            <Text className="landing__feature-icon">🚀</Text>
          </View>
          <View className="landing__feature-text">
            <Text className="landing__feature-title">For Founders</Text>
            <Text className="landing__feature-desc">
              Get expert advice on localisation, BD, talent, and funding in SEA
            </Text>
          </View>
        </View>
        <View className="landing__feature" hoverClass="landing__feature--hover">
          <View className="landing__feature-icon-wrap landing__feature-icon-wrap--purple">
            <Text className="landing__feature-icon">💡</Text>
          </View>
          <View className="landing__feature-text">
            <Text className="landing__feature-title">For Experts</Text>
            <Text className="landing__feature-desc">
              Share knowledge, discover promising AI startups, and earn from sessions
            </Text>
          </View>
        </View>
        <View className="landing__feature" hoverClass="landing__feature--hover">
          <View className="landing__feature-icon-wrap landing__feature-icon-wrap--green">
            <Text className="landing__feature-icon">📊</Text>
          </View>
          <View className="landing__feature-text">
            <Text className="landing__feature-title">For Investors</Text>
            <Text className="landing__feature-desc">
              Learn from founders and experts to understand AI domains quickly
            </Text>
          </View>
        </View>
      </View>

      <View className="landing__safe-bottom" />
    </View>
  );
}
