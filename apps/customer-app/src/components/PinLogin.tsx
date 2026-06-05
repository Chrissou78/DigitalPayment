import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuthStore } from "@/stores/auth";

interface Props {
  onSuccess: () => void;
  onRegister: () => void;
}

export function PinLogin({ onSuccess, onRegister }: Props) {
  const login = useAuthStore((s) => s.login);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!phone.trim() || !pin.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await login(phone.trim(), pin.trim());
      onSuccess();
    } catch (e: any) {
      setError(e?.data?.message ?? "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-bg items-center justify-center px-8">
      <Text className="font-heading text-gold text-3xl mb-1">PayDuka</Text>
      <Text className="text-ink-muted text-base mb-10">Welcome back</Text>

      <TextInput
        placeholder="Phone number"
        placeholderTextColor="#A09880"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />
      <TextInput
        placeholder="PIN"
        placeholderTextColor="#A09880"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-6"
      />

      {error && (
        <Text className="text-red text-sm mb-4 text-center">{error}</Text>
      )}

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        className="w-full bg-gold rounded-xl py-4 items-center mb-4"
      >
        {loading ? (
          <ActivityIndicator color="#0A0A08" />
        ) : (
          <Text className="text-bg font-heading text-base">Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onRegister}>
        <Text className="text-gold text-sm">
          New to PayDuka? <Text className="underline">Create account</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
