import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
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
    <View style={styles.container}>
      <Text style={styles.title}>PayDuka</Text>
      <Text style={styles.subtitle}>Welcome back</Text>

      <TextInput
        placeholder="Phone number"
        placeholderTextColor="#A09880"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />
      <TextInput
        placeholder="PIN"
        placeholderTextColor="#A09880"
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        style={[styles.input, { marginBottom: 24 }]}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity onPress={handleLogin} disabled={loading} style={styles.button}>
        {loading ? (
          <ActivityIndicator color="#0A0A08" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={onRegister}>
        <Text style={styles.link}>
          New to PayDuka? <Text style={styles.linkUnderline}>Create account</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A08",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: "#C8A85C",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    color: "#A09880",
    fontSize: 16,
    marginBottom: 40,
  },
  input: {
    width: "100%",
    backgroundColor: "#141410",
    borderWidth: 1,
    borderColor: "#1E1E18",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#F5F0E8",
    fontSize: 16,
    marginBottom: 16,
  },
  error: {
    color: "#F87171",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    width: "100%",
    backgroundColor: "#C8A85C",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#0A0A08",
    fontWeight: "bold",
    fontSize: 16,
  },
  link: {
    color: "#C8A85C",
    fontSize: 14,
  },
  linkUnderline: {
    textDecorationLine: "underline",
  },
});
