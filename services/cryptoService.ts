
import CryptoJS from '../libs/crypto-js';

class CryptoService {
    encrypt(data: string, secret: string): string {
        return CryptoJS.AES.encrypt(data, secret).toString();
    }

    decrypt(ciphertext: string, secret: string): string {
        const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText) {
            throw new Error('Decryption failed: could be a wrong password or corrupted data.');
        }
        return originalText;
    }
}

export const cryptoService = new CryptoService();