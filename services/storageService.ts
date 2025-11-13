
import { Account } from '../types';
import { cryptoService } from './cryptoService';

const STORAGE_KEY = 'secure-authenticator-data';

interface PersistedPayload {
    accounts: Account[];
    groups: string[];
}

class StorageService {
    hasData(): boolean {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    async loadAndDecrypt(password: string): Promise<PersistedPayload> {
        const encryptedData = localStorage.getItem(STORAGE_KEY);
        if (!encryptedData) {
            return { accounts: [], groups: [] };
        }
        const decryptedData = cryptoService.decrypt(encryptedData, password);
        try {
            const parsed = JSON.parse(decryptedData);
            if (Array.isArray(parsed)) {
                return { accounts: parsed, groups: [] };
            }
            const {
                accounts = [],
                groups = [],
            } = parsed as Partial<PersistedPayload>;
            return { accounts, groups };
        } catch (err) {
            console.error('Failed to parse persisted payload', err);
            return { accounts: [], groups: [] };
        }
    }

    async encryptAndSave(accounts: Account[], groups: string[], password: string): Promise<void> {
        const payload: PersistedPayload = { accounts, groups };
        const dataToEncrypt = JSON.stringify(payload);
        const encryptedData = cryptoService.encrypt(dataToEncrypt, password);
        localStorage.setItem(STORAGE_KEY, encryptedData);
    }

    clearData(): void {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export const storageService = new StorageService();
