import { useState, useMemo, useEffect } from 'react';
import { useI18n } from './useI18n';
import { TOTP } from '../libs/otpauth';
import { useTotpTicker } from './useTotpTicker';

export const useTOTP = (secret: string, period: number = 30, algorithm: string = 'SHA1', digits: number = 6) => {
    const { t } = useI18n();
    const { timeLeft, slot } = useTotpTicker(period);
    const [token, setToken] = useState('...');

    const totp = useMemo(() => {
        try {
            return new TOTP({
                issuer: 'ACME',
                label: 'Default',
                algorithm: algorithm,
                digits: digits,
                period: period,
                secret,
            });
        } catch (error) {
            console.error('Invalid secret key:', error);
            return null;
        }
    }, [secret, period, algorithm, digits]);

    useEffect(() => {
        if (!totp) {
            setToken(t('account_item.invalid_secret'));
            return;
        }
        setToken(totp.generate());
    }, [totp, slot, t]);

    const isTokenValid = !!totp;
    const progress = (timeLeft / period) * 100;

    return { 
        token, 
        remainingTime: timeLeft, 
        progress, 
        isTokenValid 
    };
};