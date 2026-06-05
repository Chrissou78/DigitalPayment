import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAuthStore } from "@/stores/auth";

interface Props {
  onSuccess: () => void;
  onFallbackPin: () => void;
}

export function BiometricGate({ onSuccess, onFallbackPin }: Props) {
  const loginWithBiometric = useAuthStore((s) => s.loginWithBiometric);
  const [error, setError] = useState<string | null>(null);

  const attempt = async () => {
    setError(null);
    const ok = await loginWithBiometric();
    if (ok) {
      onSuccess();
    } else {
      setError("Biometric authentication failed.");
    }
  };

  useEffect(() => {
    attempt();
  }, []);

  return (
    <View className="flex-1 bg-bg items-center justify-center px-8">
      <Text className="font-heading text-gold text-3xl mb-2">PayDuka</Text>
      <Text className="text-ink-muted text-base mb-10">
        Touch the sensor to unlock
      </Text>

      {error && (
        <Text className="text-red text-sm mb-6 text-center">{error}</Text>
      )}

      <TouchableOpacity
        onPress={attempt}
        className="bg-surface border border-gold-dim rounded-2xl px-10 py-4 mb-4"
      >
        <Text className="text-gold text-base font-heading">Try Again</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onFallbackPin}>
        <Text className="text-ink-muted text-sm underline">Use PIN instead</Text>
      </TouchableOpacity>
    </View>
  );
}
