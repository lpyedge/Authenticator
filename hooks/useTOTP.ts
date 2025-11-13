import { useState, useEffect } from 'react';
import { useI18n } from './useI18n';
import { TOTP } from '../libs/otpauth';

export const useTOTP = (secret: string) => {
    const { t } = useI18n();
    const [token, setToken] = useState('...');
    const [timeLeft, setTimeLeft] = useState(0);

    useEffect(() => {
        let totp: TOTP;
        try {
            totp = new TOTP({
                issuer: 'ACME',
                label: 'Default',
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: secret,
            });
        } catch (e) {
            console.error("Invalid secret key:", e);
            setToken(t('account_item.invalid_secret'));
            setTimeLeft(0);
            return;
        }

        const updateToken = () => {
            const newToken = totp.generate();
            const newTimeLeft = (totp.period - (Math.floor(Date.now() / 1000) % totp.period));
            setToken(newToken);
            setTimeLeft(newTimeLeft);
        };

        updateToken(); // Initial update
        const intervalId = setInterval(updateToken, 1000);

        return () => clearInterval(intervalId);
    }, [secret, t]);

    return { token, timeLeft };
};