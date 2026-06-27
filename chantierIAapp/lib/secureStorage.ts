import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Stockage chiffré (Keychain iOS / Keystore Android). Web → AsyncStorage fallback. */
export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    return AsyncStorage.getItem(key);
  }
}

export async function setSecureItem(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value) await AsyncStorage.setItem(key, value);
    else await AsyncStorage.removeItem(key);
    return;
  }
  try {
    if (value) await SecureStore.setItemAsync(key, value, OPTIONS);
    else await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch {
    if (value) await AsyncStorage.setItem(key, value);
    else await AsyncStorage.removeItem(key);
  }
}
