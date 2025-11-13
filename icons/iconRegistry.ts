import type { IconType } from 'react-icons';
import {
    FiCheck,
    FiEdit2,
    FiKey,
    FiLock,
    FiMonitor,
    FiMoon,
    FiPlus,
    FiRefreshCw,
    FiSettings,
    FiSun,
    FiTrash2
} from 'react-icons/fi';
import {
    SiAmazon,
    SiApple,
    SiDropbox,
    SiGithub,
    SiGoogle,
    SiMicrosoft
} from 'react-icons/si';

export type UiIconName =
    | 'add'
    | 'check'
    | 'delete'
    | 'edit'
    | 'lock'
    | 'key'
    | 'settings'
    | 'importExport'
    | 'theme-light'
    | 'theme-dark'
    | 'theme-system';

export type BrandIconName =
    | 'amazon'
    | 'apple'
    | 'dropbox'
    | 'github'
    | 'google'
    | 'microsoft';

export const uiIcons: Record<UiIconName, IconType> = {
    add: FiPlus,
    check: FiCheck,
    delete: FiTrash2,
    edit: FiEdit2,
    lock: FiLock,
    key: FiKey,
    settings: FiSettings,
    importExport: FiRefreshCw,
    'theme-light': FiSun,
    'theme-dark': FiMoon,
    'theme-system': FiMonitor,
};

export const brandIcons: Record<BrandIconName, IconType> = {
    amazon: SiAmazon,
    apple: SiApple,
    dropbox: SiDropbox,
    github: SiGithub,
    google: SiGoogle,
    microsoft: SiMicrosoft,
};

export const getIconComponent = (
    name: UiIconName | BrandIconName,
    fallback: IconType = FiKey
): IconType => {
    return (uiIcons as Record<string, IconType>)[name] ?? (brandIcons as Record<string, IconType>)[name] ?? fallback;
};
