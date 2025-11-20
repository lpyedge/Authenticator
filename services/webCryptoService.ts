
export class WebCryptoService {
    private static readonly ALGORITHM = 'AES-GCM';
    private static readonly KDF_ALGORITHM = 'PBKDF2';
    private static readonly HASH = 'SHA-256';
    private static readonly ITERATIONS = 100000;
    private static readonly SALT_LENGTH = 16;
    private static readonly IV_LENGTH = 12; // Recommended for AES-GCM

    // Convert string to ArrayBuffer
    private str2ab(str: string): Uint8Array {
        return new TextEncoder().encode(str);
    }

    // Convert ArrayBuffer to Base64 string
    private ab2base64(buf: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buf);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // Convert Base64 string to Uint8Array
    private base642ab(base64: string): Uint8Array {
        const binary_string = window.atob(base64);
        const len = binary_string.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes;
    }

    async deriveKey(password: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            this.str2ab(password),
            { name: WebCryptoService.KDF_ALGORITHM },
            false,
            ['deriveKey']
        );

        return window.crypto.subtle.deriveKey(
            {
                name: WebCryptoService.KDF_ALGORITHM,
                salt: salt,
                iterations: WebCryptoService.ITERATIONS,
                hash: WebCryptoService.HASH,
            },
            keyMaterial,
            { name: WebCryptoService.ALGORITHM, length: 256 },
            false,
            usage
        );
    }

    async encrypt(data: string, password: string): Promise<string> {
        const salt = window.crypto.getRandomValues(new Uint8Array(WebCryptoService.SALT_LENGTH));
        const iv = window.crypto.getRandomValues(new Uint8Array(WebCryptoService.IV_LENGTH));
        
        const key = await this.deriveKey(password, salt, ['encrypt']);
        
        const encodedData = this.str2ab(data);
        const encryptedContent = await window.crypto.subtle.encrypt(
            {
                name: WebCryptoService.ALGORITHM,
                iv: iv,
            },
            key,
            encodedData
        );

        const payload = {
            v: 2, // Version 2 for WebCrypto
            salt: this.ab2base64(salt),
            iv: this.ab2base64(iv),
            data: this.ab2base64(encryptedContent)
        };

        return JSON.stringify(payload);
    }

    async decrypt(ciphertext: string, password: string): Promise<string> {
        try {
            const payload = JSON.parse(ciphertext);
            
            // Check if it's our new format
            if (payload.v === 2 && payload.salt && payload.iv && payload.data) {
                const salt = this.base642ab(payload.salt);
                const iv = this.base642ab(payload.iv);
                const data = this.base642ab(payload.data);

                const key = await this.deriveKey(password, salt, ['decrypt']);

                const decryptedContent = await window.crypto.subtle.decrypt(
                    {
                        name: WebCryptoService.ALGORITHM,
                        iv: iv,
                    },
                    key,
                    data
                );

                return new TextDecoder().decode(decryptedContent);
            }
            
            throw new Error('Unknown format');
        } catch (e) {
            // If JSON parse fails or format is wrong, it might be legacy data or invalid
            throw new Error('Decryption failed or invalid format');
        }
    }
}

export const webCryptoService = new WebCryptoService();
