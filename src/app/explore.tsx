import { ReactElement } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AgroDataRoute(): ReactElement {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Cultiva</Text>
          <Text style={styles.title}>Campo, dados e decisão</Text>
          <Text style={styles.body}>
            O fluxo principal organiza propriedade, lotes, leiras, sensores, mapa e diagnóstico em uma experiência simples para agricultores e agrônomos.
          </Text>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    backgroundColor: '#F8F6F1',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E0D6',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  kicker: {
    color: '#2D6A4F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1A1A1A',
    fontSize: 28,
    fontWeight: '900',
  },
  body: {
    color: '#66746B',
    fontSize: 15,
    lineHeight: 22,
  },
});
