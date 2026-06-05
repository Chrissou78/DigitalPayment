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
          tabBarIcon: ({ focused }) => <TabIcon label="Wallet" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Pay" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="send"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Send" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Activity" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="Me" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
