
import { Account } from '../types';
import { cryptoService } from './cryptoService';

const STORAGE_KEY = 'secure-authenticator-data';

class StorageService {
    hasData(): boolean {
        return localStorage.getItem(STORAGE_KEY) !== null;
    }

    async loadAndDecrypt(password: string): Promise<Account[]> {
        const encryptedData = localStorage.getItem(STORAGE_KEY);
        if (!encryptedData) {
            return [];
        }
        const decryptedData = cryptoService.decrypt(encryptedData, password);
        return JSON.parse(decryptedData);
    }

    async encryptAndSave(accounts: Account[], password: string): Promise<void> {
        const dataToEncrypt = JSON.stringify(accounts);
        const encryptedData = cryptoService.encrypt(dataToEncrypt, password);
        localStorage.setItem(STORAGE_KEY, encryptedData);
    }

    clearData(): void {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export const storageService = new StorageService();
