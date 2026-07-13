import { type ReactElement } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { severityLabels } from '@/features/agro/model';
import { palette, severityStyles, styles } from '@/features/agro/styles';
import { AlertSeverity } from '@/types/agro';

export function Field({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
}): ReactElement {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

// Grupo de opções clicáveis usado no cadastro.
export function OptionGroup({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string;
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
}): ReactElement {
  return (
    <View style={styles.optionGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => {
          const selected = selectedValue === option;

          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(option)}
              style={({ pressed }) => [
                styles.optionButton,
                selected && styles.optionButtonSelected,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Botão para escolher Agricultor ou Agrônomo.
export function RoleButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleButton,
        selected && styles.roleButtonSelected,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.roleButtonText, selected && styles.roleButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

// Botão principal para confirmar ações.
export function PrimaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

// Botão secundário para ações de apoio.
export function SecondaryButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}): ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.disabledButton,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

// Badge de risco usado nos detalhes dos alertas.
export function SeverityPill({ severity }: { severity: AlertSeverity }): ReactElement {
  return (
    <View style={[styles.severityPill, severityStyles[severity]]}>
      <Text style={styles.severityText}>Risco {severityLabels[severity]}</Text>
    </View>
  );
}

// Linha simples de label e valor.
export function InfoRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.mutedText}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
