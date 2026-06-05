import { Tabs } from "expo-router";
import { View, Text } from "react-native";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View className="items-center pt-2">
      <Text
        className={`text-xs font-heading ${focused ? "text-gold" : "text-ink-muted"}`}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#141410",
          borderTopColor: "#1E1E18",
          height: 64,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="charge"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Charge" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="cashin"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Cash-In" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="remittance"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Send" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon label="More" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
