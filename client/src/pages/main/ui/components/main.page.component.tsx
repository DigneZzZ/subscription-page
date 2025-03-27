import { useEffect, useState } from 'react';
import { InstallationGuideWidget } from '../../../../widgets/main/installation-guide/installation-guide.widget';
import { useParams } from 'react-router-dom';
import { Subscription } from '../../../../shared/types/subscription.types';

export const MainPageComponent: React.FC = () => {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const { id } = useParams();

    useEffect(() => {
        const getSubscriptionData = async () => {
            try {
                const subscriptionData: Subscription = {
                    subscriptionUrl: window.location.href // или ваша логика получения URL
                };
                setSubscription(subscriptionData);
            } catch (error) {
                console.error('Failed to fetch subscription data:', error);
            }
        };

        getSubscriptionData();
    }, [id]);

    if (!subscription) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <InstallationGuideWidget subscription={subscription} />
        </div>
    );
};
