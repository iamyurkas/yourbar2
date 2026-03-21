import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDialog } from '@/components/AppDialog';
import { AppImage } from '@/components/AppImage';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { BUILTIN_INGREDIENT_TAGS } from '@/constants/ingredient-tags';
import { useAppColors } from '@/constants/theme';
import { useI18n } from '@/libs/i18n/use-i18n';
import { useInventory } from '@/providers/inventory-provider';
import { appendBarcode, findIngredientByBarcode } from '@/services/barcode/findIngredientByBarcode';
import { findSimilarIngredientByName } from '@/services/barcode/findSimilarIngredientByName';
import { lookupProductByBarcode } from '@/services/barcode/lookupProductByBarcode';
import { pickIngredientTagsByIds, suggestIngredientTagIds } from '@/services/barcode/suggestIngredientTags';
import type { ScannedProductDraft } from '@/services/barcode/types';

type ScanState =
  | { kind: 'ready' }
  | { kind: 'loading'; barcode: string }
  | { kind: 'duplicate'; barcode: string; ingredientId: number; ingredientName: string }
  | { kind: 'similar'; draft: ScannedProductDraft; ingredientId: number; ingredientName: string }
  | { kind: 'product'; draft: ScannedProductDraft }
  | { kind: 'not-found'; barcode: string }
  | { kind: 'error'; barcode?: string; message: string };

export default function ScanIngredientScreen() {
  const { t } = useI18n();
  const colors = useAppColors();
  const { ingredients, customIngredientTags, createIngredient, updateIngredient } = useInventory();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>({ kind: 'ready' });
  const [hasScanned, setHasScanned] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  const handleScan = useCallback(async (rawBarcode?: string) => {
    const barcode = rawBarcode?.trim();
    if (!barcode || hasScanned) {
      return;
    }

    setHasScanned(true);

    const existingByBarcode = findIngredientByBarcode(ingredients, barcode);
    if (existingByBarcode?.id != null) {
      setScanState({
        kind: 'duplicate',
        barcode,
        ingredientId: Number(existingByBarcode.id),
        ingredientName: existingByBarcode.name,
      });
      return;
    }

    setScanState({ kind: 'loading', barcode });
    const lookup = await lookupProductByBarcode(barcode);

    if (lookup.kind === 'error') {
      setScanState({ kind: 'error', barcode, message: lookup.message });
      return;
    }

    if (lookup.kind === 'not-found') {
      setScanState({ kind: 'not-found', barcode });
      return;
    }

    const similarIngredient = findSimilarIngredientByName(ingredients, lookup.draft.name);
    if (similarIngredient?.id != null) {
      setScanState({
        kind: 'similar',
        draft: lookup.draft,
        ingredientId: Number(similarIngredient.id),
        ingredientName: similarIngredient.name,
      });
      return;
    }

    setScanState({ kind: 'product', draft: lookup.draft });
  }, [hasScanned, ingredients]);

  const resetScanner = useCallback(() => {
    setHasScanned(false);
    setScanState({ kind: 'ready' });
  }, []);

  const allIngredientTags = useMemo(
    () => [...BUILTIN_INGREDIENT_TAGS, ...customIngredientTags],
    [customIngredientTags],
  );

  const createWithDraft = useCallback((draft: ScannedProductDraft) => {
    const name = draft.name?.trim() || draft.barcode;
    const suggestedTagIds = suggestIngredientTagIds({ categories: draft.categories, productName: name });
    const selectedTags = pickIngredientTagsByIds(allIngredientTags, suggestedTagIds);

    const created = createIngredient({
      name,
      description: draft.description,
      photoUri: draft.imageUrl,
      imageUrl: draft.imageUrl,
      abv: draft.abv,
      barcodes: [draft.barcode],
      tags: selectedTags,
    });

    if (created?.id != null) {
      router.replace({ pathname: '/ingredients/[ingredientId]', params: { ingredientId: String(created.id) } });
    }
  }, [allIngredientTags, createIngredient]);

  const editWithDraft = useCallback((draft: ScannedProductDraft) => {
    const params: Record<string, string> = {
      prefillBarcode: draft.barcode,
    };

    if (draft.name) {
      params.suggestedName = draft.name;
    }
    if (draft.description) {
      params.prefillDescription = draft.description;
    }
    if (draft.imageUrl) {
      params.prefillImageUrl = draft.imageUrl;
    }
    if (draft.abv != null) {
      params.prefillAbv = String(draft.abv);
    }

    const suggestedTagIds = suggestIngredientTagIds({ categories: draft.categories, productName: draft.name });
    if (suggestedTagIds.length > 0) {
      params.prefillTagIds = suggestedTagIds.join(',');
    }

    router.push({ pathname: '/ingredients/create', params });
  }, []);

  const createDuplicate = useCallback((barcode: string) => {
    router.push({ pathname: '/ingredients/create', params: { suggestedName: barcode, prefillBarcode: barcode } });
  }, []);

  const attachBarcode = useCallback((ingredientId: number, barcode: string) => {
    const existing = ingredients.find((item) => Number(item.id ?? -1) === ingredientId);
    if (!existing) {
      return;
    }

    updateIngredient(ingredientId, {
      name: existing.name,
      description: existing.description,
      synonyms: existing.synonyms,
      photoUri: existing.photoUri,
      imageUrl: existing.imageUrl,
      abv: existing.abv,
      baseIngredientId: existing.baseIngredientId,
      styleIngredientId: existing.styleIngredientId,
      tags: existing.tags,
      barcodes: appendBarcode(existing, barcode),
    });

    router.replace({ pathname: '/ingredients/[ingredientId]', params: { ingredientId: String(ingredientId) } });
  }, [ingredients, updateIngredient]);

  const permissionDenied = permission?.granted === false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: t('barcode.scanBarcode'),
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: {
            color: colors.onSurface,
            fontSize: Platform.OS === 'ios' ? 17 : 16,
            fontWeight: '600',
          },
          headerLeft: () => (
            <HeaderIconButton onPress={() => router.back()} accessibilityLabel={t('common.back')}>
              <MaterialCommunityIcons
                name={Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left'}
                size={Platform.OS === 'ios' ? 26 : 22}
                color={colors.onSurface}
              />
            </HeaderIconButton>
          ),
          headerRight: () => (
            <HeaderIconButton
              onPress={() => setIsHelpVisible(true)}
              accessibilityLabel={t('common.openScreenHelp')}>
              <MaterialCommunityIcons name="help-circle-outline" size={22} color={colors.onSurface} />
            </HeaderIconButton>
          ),
        }}
      />

      {!permission ? (
        <ActivityIndicator color={colors.tint} />
      ) : null}

      {permissionDenied ? (
        <View style={styles.centered}>
          <Text style={[styles.message, { color: colors.onSurface }]}>{t('barcode.cameraPermissionNeeded')}</Text>
          {permission?.canAskAgain ? (
            <Pressable style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.tint }]} onPress={requestPermission}>
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('common.tryAgain')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {permission?.granted && scanState.kind === 'ready' ? (
        <View style={styles.scannerWrap}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={({ data }: { data?: string }) => void handleScan(data)}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
            }}
          />
          <Text style={[styles.caption, { color: colors.onSurfaceVariant }]}>{t('barcode.scanBarcode')}</Text>
        </View>
      ) : null}

      {scanState.kind === 'loading' ? <Text style={[styles.message, { color: colors.onSurface }]}>{t('barcode.loadingProductInfo')}</Text> : null}

      {scanState.kind === 'duplicate' ? (
        <View style={styles.card}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{t('barcode.productAlreadyExists')}</Text>
          <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{scanState.ingredientName}</Text>
          <Pressable style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.tint }]} onPress={() => router.replace({ pathname: '/ingredients/[ingredientId]', params: { ingredientId: String(scanState.ingredientId) } })}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('barcode.openExisting')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => createDuplicate(scanState.barcode)}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('barcode.createDuplicate')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}

      {scanState.kind === 'similar' ? (
        <View style={styles.card}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{t('barcode.similarProductFound')}</Text>
          {scanState.draft.imageUrl ? <AppImage source={{ uri: scanState.draft.imageUrl }} style={styles.previewImage} contentFit="cover" /> : null}
          <Text style={[styles.message, { color: colors.onSurface }]}>{scanState.draft.name ?? scanState.draft.barcode}</Text>
          <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{scanState.ingredientName}</Text>
          <Pressable style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.tint }]} onPress={() => attachBarcode(scanState.ingredientId, scanState.draft.barcode)}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('barcode.addBarcodeToExisting')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => createWithDraft(scanState.draft)}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('barcode.createNewIngredient')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}

      {scanState.kind === 'product' ? (
        <View style={styles.card}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{t('barcode.weFoundProduct')}</Text>
          {scanState.draft.imageUrl ? <AppImage source={{ uri: scanState.draft.imageUrl }} style={styles.previewImage} contentFit="cover" /> : null}
          <Text style={[styles.message, { color: colors.onSurface }]}>{scanState.draft.name ?? scanState.draft.barcode}</Text>
          {scanState.draft.description ? <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{scanState.draft.description}</Text> : null}
          {scanState.draft.abv != null ? <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{`${scanState.draft.abv}% ABV`}</Text> : null}
          <Pressable style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.tint }]} onPress={() => createWithDraft(scanState.draft)}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('barcode.createIngredient')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => editWithDraft(scanState.draft)}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('barcode.editBeforeSaving')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}

      {scanState.kind === 'not-found' ? (
        <View style={styles.card}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{t('barcode.productNotFound')}</Text>
          <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{scanState.barcode}</Text>
          <Pressable style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.tint }]} onPress={() => router.push({ pathname: '/ingredients/create', params: { prefillBarcode: scanState.barcode } })}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('barcode.createManually')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={resetScanner}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('barcode.scanAgain')}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonOutline, { backgroundColor: colors.surfaceBright, borderColor: colors.tint }]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, { color: colors.tint }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}

      {scanState.kind === 'error' ? (
        <View style={styles.card}>
          <Text style={[styles.title, { color: colors.error }]}>{t('common.somethingWentWrong')}</Text>
          <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{scanState.message}</Text>
          <Pressable style={[styles.button, styles.buttonPrimary, { backgroundColor: colors.tint }]} onPress={resetScanner}>
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      ) : null}

      <AppDialog
        visible={isHelpVisible}
        onRequestClose={() => setIsHelpVisible(false)}
        title={t('barcode.helpTitle')}
        message={t('barcode.helpMessage')}
        actions={[{ label: t('common.gotIt'), variant: 'secondary' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  centered: { alignItems: 'center', gap: 12 },
  scannerWrap: { flex: 1, gap: 8 },
  camera: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  caption: { textAlign: 'center' },
  card: { gap: 10, borderRadius: 16, padding: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 16 },
  previewImage: { width: '100%', height: 180, borderRadius: 12 },
  button: {
    minWidth: 250,
    height: 56,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {},
  buttonOutline: {
    borderWidth: 1,
  },
  buttonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
