import { Container, Group, Stack, Title } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { LanguagePicker } from '@shared/ui/language-picker/language-picker.shared'

import { InstallationGuideWidget } from '../../../../widgets/main/installation-guide/installation-guide.widget'
import { SubscriptionLinkWidget } from '../../../../widgets/main/subscription-link/subscription-link.widget'
import { SubscriptionInfoWidget } from '../../../../widgets/main/subscription-info/subscription-info.widget'

export const MainPageComponent = () => {
    const { t } = useTranslation()

    return (
        <Container my="xl" size="xl">
            <Stack gap="xl">
                <Group justify="space-between">
                    <Group gap="xs">
                        <Title order={4}>{t('main.page.component.podpiska')}</Title>
                    </Group>
                    <Group gap="xs">
                        <SubscriptionLinkWidget />
                    </Group>
                </Group>
                <SubscriptionInfoWidget />
                <InstallationGuideWidget />
                {/* Переключатель языка в конце страницы */}
                <Group justify="center" mt="md">
                    <LanguagePicker size="xs" /> {/* Добавляем параметр size */}
                </Group>
            </Stack>
        </Container>
    )
}
