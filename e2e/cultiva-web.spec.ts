import { expect, type Page, test } from '@playwright/test';

async function mockExternalServices(page: Page): Promise<void> {
  await page.route('https://viacep.com.br/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        cep: '01001-000',
        logradouro: 'Praca da Se',
        bairro: 'Se',
        localidade: 'Sao Paulo',
        uf: 'SP',
      }),
    });
  });

  await page.route('http://localhost:8787/agro-chat', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'Analise simulada: manter umidade estavel e vistoriar folhas afetadas.',
        severity: 'Média',
        recommendation: 'Revise irrigacao e colete uma amostra das folhas.',
        nextStep: 'Registrar fotos do lote e comparar com o historico.',
      }),
    });
  });
}

async function openFreshApp(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await mockExternalServices(page);
  await page.goto('/');
  await expect(page.getByText('Escolha seu perfil')).toBeVisible();
}

async function completeFarmerOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Criar cadastro' }).click();
  await expect(page.getByText('Vamos montar seu perfil')).toBeVisible();

  await page.getByPlaceholder('Ex: Ana Souza').fill('Ana Souza');
  await page.getByPlaceholder('voce@email.com').fill('ana@cultiva.test');
  await page.getByPlaceholder('crie uma senha').fill('123456');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByPlaceholder('Digite 8 números').fill('01001000');
  await expect(page.getByText('Endereço encontrado e preenchido automaticamente.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.getByPlaceholder('Ex: Sítio Boa Terra').fill('Sitio Boa Terra');
  await page.getByPlaceholder('Ex: 12,5').fill('12,5');
  await page.getByPlaceholder('Ex: Morango, milho, soja...').fill('Morango');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByText('Revise e confirme')).toBeVisible();
  await page.getByRole('button', { name: 'Concluir cadastro' }).click();
  await expect(page.getByText('Resumo da lavoura')).toBeVisible();
}

test.describe('Cultiva web', () => {
  test('enquadra o app no desktop e preenche telas mobile sem rolagem horizontal', async ({ browser }) => {
    for (const viewport of [
      { width: 1280, height: 800, mobile: false },
      { width: 1148, height: 650, mobile: false },
      { width: 390, height: 844, mobile: true },
      { width: 360, height: 640, mobile: true },
      { width: 844, height: 390, mobile: true },
    ]) {
      const context = await browser.newContext({
        viewport,
        isMobile: viewport.mobile,
        hasTouch: viewport.mobile,
      });
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:8081/');
      await expect(page.getByText('Escolha seu perfil')).toBeVisible();
      const frame = await page.locator('#root').boundingBox();
      expect(frame).not.toBeNull();
      expect(frame!.width).toBe(viewport.mobile ? viewport.width : 430);
      expect(frame!.height).toBe(viewport.mobile ? viewport.height : viewport.height - 48);
      expect(frame!.x).toBe(viewport.mobile ? 0 : (viewport.width - 430) / 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
      await page.screenshot({ path: `test-results/login-${viewport.width}x${viewport.height}.png` });
      await page.getByRole('button', { name: 'Criar cadastro' }).click();
      await expect(page.getByText('Vamos montar seu perfil')).toBeVisible();
      await page.screenshot({ path: `test-results/layout-${viewport.width}x${viewport.height}.png` });
      await context.close();
    }
  });

  test('exibe erro quando tenta entrar sem cadastro salvo', async ({ page }) => {
    await openFreshApp(page);

    await page.getByPlaceholder('voce@email.com').fill('ana@cultiva.test');
    await page.getByPlaceholder('sua senha').fill('123456');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Nenhum cadastro encontrado neste aparelho. Crie sua conta primeiro.')).toBeVisible();
  });

  test('conclui cadastro de agricultor e mostra o dashboard web', async ({ page }) => {
    await openFreshApp(page);
    await completeFarmerOnboarding(page);

    await expect(page.getByText('Agricultor · Sao Paulo - SP')).toBeVisible();
    await expect(page.getByText('Lotes e leiras')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Mapa/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Dados/ })).toBeVisible();
  });

  test('navega por mapa e dados da propriedade', async ({ page }) => {
    await openFreshApp(page);
    await completeFarmerOnboarding(page);

    await page.getByRole('tab', { name: /Mapa/ }).click();
    await expect(page.getByText('Visão Espacial')).toBeVisible();
    await expect(page.getByText('Focos ativos')).toBeVisible();

    await page.getByRole('tab', { name: /Dados/ }).click();
    await expect(page.getByText('Campo em números')).toBeVisible();
    await expect(page.getByText('Umidade do solo')).toBeVisible();
    await expect(page.getByText('Alertas e recomendações')).toBeVisible();
  });

  test('cadastra lote pela ação central e atualiza a visão de dados', async ({ page }) => {
    await openFreshApp(page);
    await completeFarmerOnboarding(page);

    await page.getByRole('button', { name: '+' }).click();
    await page.getByText('Cadastrar lote').click();
    await page.getByPlaceholder('Ex: Lote 12 - Morango Albion').fill('Lote QA - Morango');
    await page.getByPlaceholder('Ex: Morango').fill('Morango');
    await page.getByPlaceholder('Ex: 840 m2 ou 0,8 ha').fill('840 m2');
    await page.getByPlaceholder('Ex: 4').fill('4');
    await page.getByPlaceholder('Ex: 24').fill('24');
    await page.getByPlaceholder('Ex: Estufa 1, setor norte ou coordenadas').fill('Estufa QA');
    await page.getByRole('button', { name: 'Adicionar lote' }).click();

    await expect(page.getByText('Ação concluída')).toBeVisible();
    await expect(page.getByText('Lote QA - Morango', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Campo em números')).toBeVisible();
  });

  test('abre o chat de diagnóstico com IA e renderiza resposta mockada', async ({ page }) => {
    await openFreshApp(page);
    await completeFarmerOnboarding(page);

    await page.getByRole('button', { name: '+' }).click();
    await page.getByText('Diagnosticar com IA').click();
    await expect(page.getByText('Chat agrícola com IA real')).toBeVisible();
    const frame = await page.locator('#root').boundingBox();
    const modal = await page.locator('[aria-modal="true"]').last().boundingBox();
    expect(modal).not.toBeNull();
    expect(modal!.x).toBeGreaterThanOrEqual(frame!.x);
    expect(modal!.width).toBeLessThanOrEqual(frame!.width);
    expect(modal!.height).toBeLessThanOrEqual(frame!.height);

    await page
      .getByPlaceholder('Descreva sintomas, manchas, solo ou irrigação...')
      .fill('Folhas com manchas e solo muito umido no lote principal.');
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(page.getByText('Analise simulada: manter umidade estavel e vistoriar folhas afetadas.')).toBeVisible();
  });
});
