import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

export default function IndexPage() {
  const goDiscover = () => {
    Taro.switchTab({ url: "/pages/discover/index" });
  };

  const goOnboarding = () => {
    Taro.navigateTo({ url: "/pages/onboarding/index" });
  };

  return (
    <View className="landing">
      <View className="landing__hero">
        <View className="landing__logo">H&G</View>
        <Text className="landing__title">Help & Grow</Text>
        <Text className="landing__subtitle">
          Expert Network for Founders & Entrepreneurs
        </Text>
        <Text className="landing__desc">
          Connect with verified experts in Marketing, Law, Funding, and more.
          Book 1-on-1 sessions to accelerate your business growth.
        </Text>
      </View>

      <View className="landing__actions">
        <View className="landing__btn landing__btn--primary" onClick={goDiscover}>
          Discover Experts
        </View>
        <View className="landing__btn landing__btn--outline" onClick={goOnboarding}>
          Become an Expert
        </View>
      </View>

      <View className="landing__features">
        <View className="landing__feature">
          <Text className="landing__feature-icon">🔍</Text>
          <Text className="landing__feature-title">AI Matching</Text>
          <Text className="landing__feature-desc">
            Describe your challenge, get matched with the right expert
          </Text>
        </View>
        <View className="landing__feature">
          <Text className="landing__feature-icon">💰</Text>
          <Text className="landing__feature-title">Secure Payments</Text>
          <Text className="landing__feature-desc">
            Pay 50% deposit upfront, remainder after your session
          </Text>
        </View>
        <View className="landing__feature">
          <Text className="landing__feature-icon">⭐</Text>
          <Text className="landing__feature-title">Verified Experts</Text>
          <Text className="landing__feature-desc">
            All experts are verified community members
          </Text>
        </View>
      </View>
    </View>
  );
}
