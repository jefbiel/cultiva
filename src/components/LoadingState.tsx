import { ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export function LoadingState({ message }: { message: string }): ReactElement {
  return (
    <View style={styles.container}>
      <ActivityIndicator color="#2D6A4F" size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  message: {
    color: '#66746B',
    fontSize: 14,
  },
});
