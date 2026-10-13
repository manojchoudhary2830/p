import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import type { AuthStackParamList } from '../../navigation';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Onboarding'>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDES = [
  { icon: '🔍', title: 'Discover Verified PGs', subtitle: 'Search beds, rooms & properties near your college or office in seconds.' },
  { icon: '🛏', title: 'Book a Bed Instantly', subtitle: 'Reserve with a small token deposit. No brokers, no hidden fees.' },
  { icon: '💳', title: 'Pay & Manage Easily', subtitle: 'Track rent payments, raise maintenance tickets, all from one app.' },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
  }

  function next() {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
    } else {
      navigation.replace('PhoneEntry');
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skip} onPress={() => navigation.replace('PhoneEntry')}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        keyExtractor={(item) => item.title}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View style={styles.iconCircle}><Text style={styles.icon}>{item.icon}</Text></View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{index === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background.primary },
  skip: { position: 'absolute', top: 56, right: Spacing.screen, zIndex: 10 },
  skipText: { ...Typography.body, color: Colors.text.secondary },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.background.tertiary,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl,
  },
  icon: { fontSize: 56 },
  title: { ...Typography.h1, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { ...Typography.body, textAlign: 'center', lineHeight: 24 },
  footer: { padding: Spacing.screen, paddingBottom: Spacing.xxl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.xl },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border.default },
  dotActive: { backgroundColor: Colors.primary, width: 24 },
  nextBtn: { height: 56, backgroundColor: Colors.primary, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  nextBtnText: { ...Typography.button, color: Colors.text.inverse },
});
