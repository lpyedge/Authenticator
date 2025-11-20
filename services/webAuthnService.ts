export const webAuthnService = {
    isAvailable: async (): Promise<boolean> => {
        if (!window.PublicKeyCredential) return false;
        // Check if platform authenticator is available (e.g. TouchID, Windows Hello)
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    },

    // Register a new credential (dummy registration to trigger system prompt)
    // In a real app with backend, we would send the public key to server.
    // Here we just use it to verify the user is the device owner.
    register: async (): Promise<boolean> => {
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const publicKey: PublicKeyCredentialCreationOptions = {
                challenge,
                rp: {
                    name: "Secure Authenticator",
                    id: window.location.hostname,
                },
                user: {
                    id: new Uint8Array(16),
                    name: "user",
                    displayName: "User",
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                },
                timeout: 60000,
            };

            await navigator.credentials.create({ publicKey });
            return true;
        } catch (e) {
            console.error("WebAuthn registration failed", e);
            return false;
        }
    },

    // Authenticate (trigger system prompt)
    authenticate: async (): Promise<boolean> => {
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const publicKey: PublicKeyCredentialRequestOptions = {
                challenge,
                rpId: window.location.hostname,
                userVerification: "required",
                timeout: 60000,
            };

            await navigator.credentials.get({ publicKey });
            return true;
        } catch (e) {
            console.error("WebAuthn authentication failed", e);
            return false;
        }
    }
};
