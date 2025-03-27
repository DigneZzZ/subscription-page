import { Container, Group, Stack, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LanguagePicker } from '@shared/ui/language-picker/language-picker.shared'

import { InstallationGuideWidget } from '../../../../widgets/main/installation-guide/installation-guide.widget'    
import { SubscriptionLinkWidget } from '../../../../widgets/main/subscription-link/subscription-link.widget'
import { SubscriptionInfoWidget } from '../../../../widgets/main/subscription-info/subscription-info.widget'

export const MainPageComponent: React.FC = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const { id } = useParams(); // Если используете роутинг и ID подписки приходит из URL

    useEffect(() => {
        // Здесь должна быть логика получения данных подписки
        // Например, запрос к API или получение из URL
        const getSubscriptionData = async () => {
            try {
                // Пример: данные могут приходить из URL или API
                const subscriptionData = {
                    subscriptionUrl: window.location.href // или id из useParams(), или другой источник
                };
                setSubscription(subscriptionData);
            } catch (error) {
                console.error('Failed to fetch subscription data:', error);
                // Здесь можно добавить обработку ошибок
            }
        };

        getSubscriptionData();
    }, [id]); // Зависимость от id, если используете роутинг

    // Если данные подписки еще не загружены, можно показать загрузку
    if (!subscription) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <InstallationGuideWidget subscription={subscription} />
        </div>
    );
};
