import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { ethers } from 'ethers';

// The wallet lives only on this device: the recovery phrase is stored in
// SecureStore (backed by the Android Keystore) and never leaves the phone.
// Derivation matches the Guppy's Guide family: m/44'/60'/0'/0/0.

const PHRASE_KEY = 'ethcaw.wallet.phrase.v1';
const ADDRESS_KEY = 'ethcaw.wallet.address.v1';

export async function hasWallet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PHRASE_KEY)) != null;
}

export async function storedAddress(): Promise<string | null> {
  return SecureStore.getItemAsync(ADDRESS_KEY);
}

async function savePhrase(phrase: string): Promise<ethers.HDNodeWallet> {
  const wallet = ethers.HDNodeWallet.fromPhrase(phrase);
  await SecureStore.setItemAsync(PHRASE_KEY, phrase);
  await SecureStore.setItemAsync(ADDRESS_KEY, wallet.address);
  return wallet;
}

/** Create a fresh wallet; returns the phrase ONCE so the user can back it up. */
export async function createWallet(): Promise<{ wallet: ethers.HDNodeWallet; phrase: string }> {
  const entropy = await Crypto.getRandomBytesAsync(16);
  const mnemonic = ethers.Mnemonic.fromEntropy(ethers.hexlify(entropy));
  const wallet = await savePhrase(mnemonic.phrase);
  return { wallet, phrase: mnemonic.phrase };
}

export async function importWallet(phrase: string): Promise<ethers.HDNodeWallet> {
  const normalized = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!ethers.Mnemonic.isValidMnemonic(normalized)) {
    throw new Error('リカバリーフレーズの形式が正しくありません');
  }
  return savePhrase(normalized);
}

/** Load the signer. Call only after the biometric gate has passed. */
export async function loadWallet(): Promise<ethers.HDNodeWallet> {
  const phrase = await SecureStore.getItemAsync(PHRASE_KEY);
  if (!phrase) throw new Error('ウォレットがありません');
  return ethers.HDNodeWallet.fromPhrase(phrase);
}

export async function revealPhrase(): Promise<string> {
  const phrase = await SecureStore.getItemAsync(PHRASE_KEY);
  if (!phrase) throw new Error('ウォレットがありません');
  return phrase;
}

export async function deleteWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(PHRASE_KEY);
  await SecureStore.deleteItemAsync(ADDRESS_KEY);
}
