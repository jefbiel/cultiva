import { type ReactElement, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, InfoRow, OptionGroup, PrimaryButton, RoleButton, SecondaryButton } from '@/features/agro/components';
import { appName, assistedClientsOptions, cropOptions, cultivaLogo, farmSizeUnitOptions, roleLabels, specialtyOptions } from '@/features/agro/model';
import { palette, styles } from '@/features/agro/styles';
import { fetchAddressByCep } from '@/services/api';
import { LoginForm, OnboardingForm, UserRole } from '@/types/agro';

export function LoginScreen({
  form,
  canSubmit,
  errorMessage,
  onChangeForm,
  onCreateAccount,
  onSubmit,
}: {
  form: LoginForm;
  canSubmit: boolean;
  errorMessage: string | null;
  onChangeForm: (form: LoginForm) => void;
  onCreateAccount: (role: UserRole) => void;
  onSubmit: () => void;
}): ReactElement {
  function updateForm(changes: Partial<LoginForm>): void {
    onChangeForm({ ...form, ...changes });
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
      <SafeAreaView style={[styles.safeArea, styles.loginSafeArea]}>
        <View style={styles.loginBrandBlock}>
          <Image source={cultivaLogo} style={styles.loginLogo} resizeMode="contain" />
        </View>

        <View style={[styles.card, styles.loginFormCard]}>
          <Text style={styles.sectionTitle}>Escolha seu perfil</Text>
          <View style={styles.segment}>
            <RoleButton
              label="Agricultor"
              selected={form.role === UserRole.Farmer}
              onPress={() => updateForm({ role: UserRole.Farmer })}
            />
            <RoleButton
              label="Agrônomo"
              selected={form.role === UserRole.Agronomist}
              onPress={() => updateForm({ role: UserRole.Agronomist })}
            />
          </View>

          {form.role === null ? (
            <View style={styles.emptyBox}>
              <Text style={styles.cardTitle}>Selecione uma opção para continuar</Text>
              <Text style={styles.mutedText}>
                Agricultores entram com e-mail e senha. Agrônomos entram com usuário e senha.
              </Text>
            </View>
          ) : (
            <>
              {form.role === UserRole.Farmer ? (
                <Field
                  label="E-mail cadastrado"
                  value={form.email}
                  placeholder="voce@email.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={(email) => updateForm({ email })}
                />
              ) : (
                <Field
                  label="Usuário profissional"
                  value={form.username}
                  placeholder="nome usado no cadastro"
                  autoCapitalize="words"
                  onChangeText={(username) => updateForm({ username })}
                />
              )}

              <Field
                label="Senha"
                value={form.password}
                placeholder="sua senha"
                secureTextEntry
                onChangeText={(password) => updateForm({ password })}
              />

              {errorMessage !== null && <Text style={styles.errorText}>{errorMessage}</Text>}

              <PrimaryButton label="Entrar" disabled={!canSubmit} onPress={onSubmit} />
              <SecondaryButton
                label="Criar cadastro"
                onPress={() => {
                  if (form.role !== null) {
                    onCreateAccount(form.role);
                  }
                }}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

export function OnboardingScreen({
  form,
  canSubmit,
  onChangeForm,
  onBackToLogin,
  onSubmit,
}: {
  form: OnboardingForm;
  canSubmit: boolean;
  onChangeForm: (form: OnboardingForm) => void;
  onBackToLogin: () => void;
  onSubmit: () => void;
}): ReactElement {
  const [step, setStep] = useState<number>(0);
  const [isLookingUpCep, setIsLookingUpCep] = useState<boolean>(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const steps = [
    'Acesso',
    'Endereço',
    form.role === UserRole.Farmer ? 'Fazenda' : 'Profissional',
    'Revisão',
  ];

  function updateForm(changes: Partial<OnboardingForm>): void {
    onChangeForm({ ...form, ...changes });
  }

  async function handleCepChange(cep: string): Promise<void> {
    const numericCep = cep.replace(/\D/g, '').slice(0, 8);
    updateForm({ cep: numericCep });
    setCepMessage(null);

    if (numericCep.length !== 8) {
      return;
    }

    setIsLookingUpCep(true);

    try {
      const address = await fetchAddressByCep(numericCep);
      const region = `${address.city} - ${address.state}`;

      updateForm({
        cep: address.cep,
        street: address.street,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        region,
        serviceRegion: form.role === UserRole.Agronomist ? region : form.serviceRegion,
      });
      setCepMessage('Endereço encontrado e preenchido automaticamente.');
    } catch {
      setCepMessage('Não foi possível buscar esse CEP. Confira os números digitados.');
    } finally {
      setIsLookingUpCep(false);
    }
  }

  function isCurrentStepValid(): boolean {
    if (step === 0) {
      return (
        form.name.trim().length >= 3 &&
        form.email.includes('@') &&
        form.password.trim().length >= 3
      );
    }

    if (step === 1) {
      return (
        form.cep.replace(/\D/g, '').length === 8 &&
        form.street.trim().length >= 2 &&
        form.city.trim().length >= 2 &&
        form.state.trim().length === 2 &&
        form.region.trim().length >= 2
      );
    }

    if (step === 2 && form.role === UserRole.Farmer) {
      return (
        form.farmName.trim().length >= 2 &&
        Number(form.farmSize.replace(',', '.')) > 0 &&
        form.farmSizeUnit.trim().length >= 2 &&
        form.preferredCrop.trim().length >= 2
      );
    }

    if (step === 2) {
      return (
        form.specialty.trim().length >= 2 &&
        form.registration.trim().length >= 2 &&
        form.serviceRegion.trim().length >= 2 &&
        form.preferredCrop.trim().length >= 2
      );
    }

    return canSubmit;
  }

  function goBack(): void {
    if (step === 0) {
      onBackToLogin();
      return;
    }

    setStep((current) => current - 1);
  }

  function goNext(): void {
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
    }
  }

  function renderStep(): ReactElement {
    if (step === 0) {
      return (
        <>
          <Text style={styles.sectionTitle}>Dados de acesso</Text>
          <Field
            label="Nome completo"
            value={form.name}
            placeholder="Ex: Ana Souza"
            onChangeText={(name) => updateForm({ name })}
          />
          <Field
            label="E-mail"
            value={form.email}
            placeholder="voce@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(email) => updateForm({ email })}
          />
          <Field
            label="Senha"
            value={form.password}
            placeholder="crie uma senha"
            secureTextEntry
            onChangeText={(password) => updateForm({ password })}
          />
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <Text style={styles.sectionTitle}>Endereço da operação</Text>
          <Field
            label="CEP"
            value={form.cep}
            placeholder="Digite 8 números"
            keyboardType="numeric"
            onChangeText={(cep) => void handleCepChange(cep)}
          />
          {isLookingUpCep && (
            <View style={styles.inlineState}>
              <ActivityIndicator color={palette.medium} />
              <Text style={styles.mutedText}>Buscando endereço pelo CEP...</Text>
            </View>
          )}
          {cepMessage !== null && (
            <Text style={cepMessage.startsWith('Endereço') ? styles.successText : styles.errorText}>
              {cepMessage}
            </Text>
          )}
          <Field
            label="Endereço"
            value={form.street}
            placeholder="Rua, avenida ou estrada"
            onChangeText={(street) => updateForm({ street })}
          />
          <View style={styles.addressGrid}>
            <View style={styles.addressCityField}>
              <Field
                label="Cidade"
                value={form.city}
                placeholder="Cidade"
                onChangeText={(city) => {
                  const region = form.state.trim().length > 0 ? `${city} - ${form.state}` : city;
                  updateForm({ city, region });
                }}
              />
            </View>
            <View style={styles.addressStateField}>
              <Field
                label="UF"
                value={form.state}
                placeholder="UF"
                autoCapitalize="characters"
                onChangeText={(state) => {
                  const normalizedState = state.toUpperCase().slice(0, 2);
                  const region =
                    form.city.trim().length > 0
                      ? `${form.city} - ${normalizedState}`
                      : normalizedState;
                  updateForm({ state: normalizedState, region });
                }}
              />
            </View>
          </View>
          <Field
            label="Bairro"
            value={form.neighborhood}
            placeholder="Bairro ou comunidade"
            onChangeText={(neighborhood) => updateForm({ neighborhood })}
          />
        </>
      );
    }

    if (step === 2 && form.role === UserRole.Farmer) {
      return (
        <>
          <Text style={styles.sectionTitle}>Dados da fazenda</Text>
          <Field
            label="Nome da propriedade"
            value={form.farmName}
            placeholder="Ex: Sítio Boa Terra"
            onChangeText={(farmName) => updateForm({ farmName })}
          />
          <Field
            label="Tamanho da propriedade"
            value={form.farmSize}
            placeholder="Ex: 12,5"
            keyboardType="numeric"
            onChangeText={(farmSize) => updateForm({ farmSize })}
          />
          <OptionGroup
            label="Unidade de medida"
            options={farmSizeUnitOptions}
            selectedValue={form.farmSizeUnit}
            onSelect={(farmSizeUnit) => updateForm({ farmSizeUnit })}
          />
          <Field
            label="Cultura principal"
            value={form.preferredCrop}
            placeholder="Ex: Morango, milho, soja..."
            onChangeText={(preferredCrop) => updateForm({ preferredCrop })}
          />
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <Text style={styles.sectionTitle}>Dados profissionais</Text>
          <OptionGroup
            label="Especialidade"
            options={specialtyOptions}
            selectedValue={form.specialty}
            onSelect={(specialty) => updateForm({ specialty })}
          />
          <Field
            label="CREA ou registro"
            value={form.registration}
            placeholder="Registro profissional"
            autoCapitalize="characters"
            onChangeText={(registration) => updateForm({ registration })}
          />
          <OptionGroup
            label="Culturas atendidas"
            options={cropOptions}
            selectedValue={form.preferredCrop}
            onSelect={(preferredCrop) => updateForm({ preferredCrop })}
          />
          <OptionGroup
            label="Clientes assistidos"
            options={assistedClientsOptions}
            selectedValue={form.assistedClients}
            onSelect={(assistedClients) => updateForm({ assistedClients })}
          />
          <Field
            label="Região de atendimento"
            value={form.serviceRegion}
            placeholder="Preenchido pelo CEP ou manualmente"
            onChangeText={(serviceRegion) => updateForm({ serviceRegion, region: serviceRegion })}
          />
        </>
      );
    }

    return (
      <>
        <Text style={styles.sectionTitle}>Revise e confirme</Text>
        <View style={styles.reviewBox}>
          <InfoRow label="Perfil" value={roleLabels[form.role]} />
          <InfoRow label="Região" value={form.region || 'Não informada'} />
          <InfoRow label="Cultura" value={form.preferredCrop || 'Não informada'} />
        </View>
        <Field
          label={form.role === UserRole.Farmer ? 'CPF ou código do produtor' : 'Documento'}
          value={form.document}
          placeholder="Opcional"
          onChangeText={(document) => updateForm({ document })}
        />
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>Receber notificações</Text>
            <Text style={styles.helper}>Preferência salva no aparelho.</Text>
          </View>
          <Switch
            value={form.notificationsEnabled}
            onValueChange={(notificationsEnabled) => updateForm({ notificationsEnabled })}
            thumbColor={form.notificationsEnabled ? '#FFFFFF' : palette.background}
            trackColor={{ false: '#DCE8DE', true: palette.medium }}
          />
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.onboardingSafeArea}>
      <View style={styles.onboardingCard}>
        <View style={styles.onboardingHeader}>
          <Text style={styles.kicker}>{appName}</Text>
          <Text style={styles.title}>Vamos montar seu perfil</Text>
          <Text style={styles.subtitle}>
            {steps[step]} · etapa {step + 1} de {steps.length}
          </Text>
          <View style={styles.stepDots}>
            {steps.map((item, index) => (
              <View key={item} style={[styles.stepDot, index <= step && styles.stepDotActive]} />
            ))}
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.onboardingBody}>
          {renderStep()}
        </ScrollView>

        <View style={styles.onboardingFooter}>
          <SecondaryButton label={step === 0 ? 'Voltar ao login' : 'Voltar'} onPress={goBack} />
          {step < steps.length - 1 ? (
            <PrimaryButton label="Continuar" disabled={!isCurrentStepValid()} onPress={goNext} />
          ) : (
            <PrimaryButton label="Concluir cadastro" disabled={!canSubmit} onPress={onSubmit} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
