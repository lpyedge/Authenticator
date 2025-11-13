import protobuf from './protobufjs';

// Define the protobuf schema for Google Authenticator migration
const MIGRATION_SCHEMA = `
message OtpParameters {
  optional bytes secret = 1;
  optional string name = 2;
  optional string issuer = 3;
  optional int32 algorithm = 4;
  optional int32 digits = 5;
  optional int32 type = 6;
  optional int64 counter = 7;
}

message MigrationPayload {
  repeated OtpParameters otp_parameters = 1;
  optional int32 version = 2;
  optional int32 batch_size = 3;
  optional int32 batch_index = 4;
  optional int32 batch_id = 5;
}`;

// Base32 decode helper
const base32Decode = (base32: string): Uint8Array => {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanBase32 = base32.toUpperCase().replace(/=/g, '');
    
    let bits = '';
    for (let i = 0; i < cleanBase32.length; i++) {
        const charIndex = base32Chars.indexOf(cleanBase32[i]);
        if (charIndex === -1) {
            throw new Error('Invalid base32 character');
        }
        bits += charIndex.toString(2).padStart(5, '0');
    }

    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
        const chunk = bits.slice(i, i + 8);
        if (chunk.length === 8) {
            bytes.push(parseInt(chunk, 2));
        }
    }
    return new Uint8Array(bytes);
};

// Base32 encode helper
const base32Encode = (bytes: Uint8Array): string => {
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    
    // Convert bytes to bits string
    for (let i = 0; i < bytes.length; i++) {
        bits += bytes[i].toString(2).padStart(8, '0');
    }
    
    let base32 = '';
    for (let i = 0; i < bits.length; i += 5) {
        const chunk = bits.slice(i, i + 5).padEnd(5, '0');
        base32 += base32Chars[parseInt(chunk, 2)];
    }
    
    // Add padding if necessary
    const padding = [0, 6, 4, 3, 1][base32.length % 8];
    return base32 + '='.repeat(padding);
};

export interface ParsedOtpParameters {
    secret: string;  // base32 encoded
    name: string;
    issuer: string;
    algorithm: number;  // 1 = SHA1
    digits: number;    // 1 = 6 digits
    type: number;      // 1 = HOTP, 2 = TOTP
    counter?: number;  // only for HOTP
}

export const parseMigrationUri = async (uri: string): Promise<ParsedOtpParameters[]> => {
    // Check if URI is in the correct format
    if (!uri.startsWith('otpauth-migration://offline?data=')) {
        throw new Error('Invalid migration URI format');
    }

    try {
        // Extract and decode the base64 data
        const data = uri.split('?data=')[1];
        const decoded = atob(decodeURIComponent(data));
        const buffer = new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));

        // Parse the protobuf schema
        const root = protobuf.parse(MIGRATION_SCHEMA).root;
        const MigrationPayload = root.lookupType('MigrationPayload');
        
        // Decode the protobuf message
        const message = MigrationPayload.decode(buffer);
        const payload = MigrationPayload.toObject(message, {
            longs: String,
            enums: String,
            bytes: Array,
        });

        // Convert the parsed parameters to our format
        if (!payload.otpParameters) {
            return [];
        }

        return payload.otpParameters.map(params => ({
            secret: base32Encode(new Uint8Array(params.secret)),
            name: params.name || '',
            issuer: params.issuer || '',
            algorithm: typeof params.algorithm === 'number' ? params.algorithm : 1,
            digits: typeof params.digits === 'number' ? params.digits : 1,
            type: typeof params.type === 'number' ? params.type : 2,
            counter: typeof params.counter === 'string' ? parseInt(params.counter, 10) : undefined
        }));
    } catch (error) {
        console.error('Failed to parse migration URI:', error);
        throw new Error('Failed to parse migration data');
    }
};