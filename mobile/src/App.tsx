// MTQΣ Wallet — The Global Purchasing Power Unit
// Mobile app shell (React Native / Expo)
//
// Features:
//   - Multi-currency display (7 currencies: USD/EUR/GBP/JPY/CNY/CHF/Gold)
//   - Mint/Redeem interface
//   - GFB Index live ticker
//   - Portfolio tracking (show MTQΣ balance in 7 currencies)
//   - Push notifications for risk state changes + oracle alerts
//
// This is a shell — the actual screens need implementation.
// The API endpoints are already live at https://mtq-sigma.vercel.app/api/*

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';

const API_BASE = 'https://mtq-sigma.vercel.app/api';

export default function App() {
  const [metrics, setMetrics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error('Failed to fetch metrics:', e);
    }
  };

  useEffect(() => { let mounted = true; const init = async () => { const data = await (await fetch(`${API_BASE}/metrics`)).json(); if (mounted) setMetrics(data); }; init(); const id = setInterval(fetchMetrics, 4000); return () => { mounted = false; clearInterval(id); }; }, []);

  const onRefresh = async () => { setRefreshing(true); await fetchMetrics(); setRefreshing(false); };

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.header}>
        <Text style={styles.title}>MTQΣ</Text>
        <Text style={styles.subtitle}>The Global Purchasing Power Unit</Text>
      </View>
      {metrics ? (
        <View style={styles.card}>
          <Text style={styles.label}>GFB Index</Text>
          <Text style={styles.value}>{metrics.gfbIndex?.toFixed(4)}</Text>
          <Text style={styles.label}>MTQ Price</Text>
          <Text style={styles.value}>${metrics.mtqPrice?.toFixed(4)}</Text>
          <Text style={styles.label}>NAV</Text>
          <Text style={styles.value}>${metrics.nav?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          <Text style={styles.label}>Reserve Ratio</Text>
          <Text style={styles.value}>{Number.isFinite(metrics.reserveRatio) ? metrics.reserveRatio.toFixed(2) : '∞'}</Text>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.value, { color: metrics.status === 'NORMAL' ? '#12b76a' : '#f6465d' }]}>{metrics.status}</Text>
        </View>
      ) : (
        <Text style={styles.loading}>Loading...</Text>
      )}
      <Text style={styles.footer}>Candidate for public testing — NOT production-authorized</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  header: { padding: 24, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#1e2329' },
  subtitle: { fontSize: 14, color: '#707a8a', marginTop: 4 },
  card: { margin: 16, padding: 20, backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#eaecef', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  label: { fontSize: 12, fontWeight: '600', color: '#707a8a', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 },
  value: { fontSize: 18, fontWeight: '600', color: '#1e2329', fontFamily: 'monospace', marginTop: 2 },
  loading: { textAlign: 'center', padding: 40, color: '#707a8a' },
  footer: { textAlign: 'center', padding: 16, fontSize: 11, color: '#707a8a' },
});
