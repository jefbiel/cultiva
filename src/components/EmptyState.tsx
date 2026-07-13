import { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function EmptyState({ title, message }: { title: string; message: string }): ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E0D6',
    backgroundColor: '#FCFBF8',
    padding: 16,
  },
  title: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '900',
  },
  message: {
    color: '#66746B',
    fontSize: 14,
    lineHeight: 20,
  },
});
