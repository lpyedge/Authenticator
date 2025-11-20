import { useState, useMemo, useEffect } from 'react';
import { useI18n } from './useI18n';
import { TOTP } from '../libs/otpauth';
import { useTotpTicker } from './useTotpTicker';

const DEFAULT_PERIOD = 30;

export const useTOTP = (secret: string) => {
    const { t } = useI18n();
    const { timeLeft, slot } = useTotpTicker(DEFAULT_PERIOD);
    const [token, setToken] = useState('...');

    const totp = useMemo(() => {
        try {
            return new TOTP({
                issuer: 'ACME',
                label: 'Default',
                algorithm: 'SHA1',
                digits: 6,
                period: DEFAULT_PERIOD,
                secret,
            });
        } catch (error) {
            console.error('Invalid secret key:', error);
            return null;
        }
    }, [secret]);

    useEffect(() => {
        if (!totp) {
            setToken(t('account_item.invalid_secret'));
            return;
        }
        setToken(totp.generate());
    }, [totp, slot, t]);

    return { token, timeLeft: totp ? timeLeft : 0 };
};