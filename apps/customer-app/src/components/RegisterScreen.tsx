import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useAuthStore } from "@/stores/auth";

interface Props {
  onSuccess: () => void;
  onBackToLogin: () => void;
}

export function RegisterScreen({ onSuccess, onBackToLogin }: Props) {
  const register = useAuthStore((s) => s.register);
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!phone.trim() || !firstName.trim() || !lastName.trim()) {
      setError("All fields are required.");
      return;
    }
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await register(phone.trim(), pin, firstName.trim(), lastName.trim());
      onSuccess();
    } catch (e: any) {
      setError(e?.data?.message ?? "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerClassName="items-center justify-center px-8 py-14"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="font-heading text-gold text-3xl mb-1">PayDuka</Text>
      <Text className="text-ink-muted text-base mb-10">Create your wallet</Text>

      <TextInput
        placeholder="First name"
        placeholderTextColor="#A09880"
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />
      <TextInput
        placeholder="Last name"
        placeholderTextColor="#A09880"
        value={lastName}
        onChangeText={setLastName}
        autoCapitalize="words"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />
      <TextInput
        placeholder="Phone number (e.g. 0812345678)"
        placeholderTextColor="#A09880"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />
      <TextInput
        placeholder="Create PIN (4-6 digits)"
        placeholderTextColor="#A09880"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-4"
      />
      <TextInput
        placeholder="Confirm PIN"
        placeholderTextColor="#A09880"
        value={confirmPin}
        onChangeText={setConfirmPin}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        className="w-full bg-surface border border-surface-2 rounded-xl px-4 py-3 text-ink text-base mb-6"
      />

      {error && (
        <Text className="text-red text-sm mb-4 text-center">{error}</Text>
      )}

      <TouchableOpacity
        onPress={handleRegister}
        disabled={loading}
        className="w-full bg-gold rounded-xl py-4 items-center mb-4"
      >
        {loading ? (
          <ActivityIndicator color="#0A0A08" />
        ) : (
          <Text className="text-bg font-heading text-base">Create Account</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBackToLogin}>
        <Text className="text-ink-muted text-sm">
          Already have an account? <Text className="text-gold underline">Sign In</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
