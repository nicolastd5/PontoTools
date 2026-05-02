import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_TOKENS_UPDATED_AT_KEY = 'authTokensUpdatedAt';

export async function saveAuthTokens(
  accessToken: string,
  refreshToken?: string | null,
  updatedAtMs = Date.now(),
) {
  const pairs: [string, string][] = [
    ['accessToken', accessToken],
    [AUTH_TOKENS_UPDATED_AT_KEY, String(updatedAtMs)],
  ];

  if (refreshToken !== undefined && refreshToken !== null) {
    pairs.push(['refreshToken', refreshToken]);
  }

  await AsyncStorage.multiSet(pairs);
}

export async function getAuthTokensUpdatedAt(): Promise<number> {
  const raw = await AsyncStorage.getItem(AUTH_TOKENS_UPDATED_AT_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
