import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import FavoriteAlarmScreen from '@/screens/FavoriteAlarmScreen';
import FavoritesScreen from '@/screens/FavoritesScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import StopRoutesScreen from '@/screens/StopRoutesScreen';
import StopSearchScreen from '@/screens/StopSearchScreen';
import { colors } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: '도착', headerShown: false }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정', headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          headerStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="StopSearch"
          component={StopSearchScreen}
          options={{ title: '정류장 검색' }}
        />
        <Stack.Screen
          name="StopRoutes"
          component={StopRoutesScreen}
          options={({ route }) => ({ title: route.params.stop.name })}
        />
        <Stack.Screen
          name="FavoriteAlarm"
          component={FavoriteAlarmScreen}
          options={{ title: '알림 설정' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
