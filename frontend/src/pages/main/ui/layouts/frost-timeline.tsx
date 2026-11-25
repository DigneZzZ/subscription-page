import dayjs from 'dayjs'

import classes from './frost.module.css'

const intervals = 3
const steps = [
    [1, 'day'],
    [2, 'day'],
    [3, 'day'],
    [5, 'day'],
    [7, 'day'],
    [14, 'day'],
    [1, 'month'],
    [2, 'month'],
    [3, 'month'],
    [4, 'month'],
    [6, 'month'],
    [1, 'year'],
    [2, 'year'],
    [3, 'year'],
    [4, 'year']
] as const

interface IFrostTimelineProps {
    dateText: string
    expiresAt: Date
    locale: string
    now: Date
}

export const FrostTimeline = ({ dateText, expiresAt, locale, now }: IFrostTimelineProps) => {
    const ru = locale === 'ru-RU'
    const today = dayjs(now).startOf('day')
    const isToday = today.isSame(expiresAt, 'day')
    const [step, unit] = steps.find(([amount, period]) =>
        today.add(intervals * amount, period).isAfter(expiresAt)
    ) ?? [4, 'year']
    const ticks = isToday
        ? [today, today.hour(8), today.hour(16), today.add(1, 'day').startOf('day')]
        : Array.from({ length: intervals + 1 }, (_, index) => today.add(step * index, unit))
    const start = today.valueOf()
    const span = ticks[intervals].valueOf() - start
    const position = (date: number) => `${((date - start) / span) * 100}%`
    const deadline = position(expiresAt.getTime())
    const calendarLabelOptions: Intl.DateTimeFormatOptions = {
        day: unit === 'day' ? 'numeric' : undefined,
        month: unit === 'year' ? undefined : 'short',
        year: unit === 'year' ? 'numeric' : undefined
    }
    const labelFormat = new Intl.DateTimeFormat(
        locale,
        isToday ? { hour: '2-digit', minute: '2-digit' } : calendarLabelOptions
    )
    const dateFormat = new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeStyle: isToday ? 'short' : undefined
    })

    return (
        <div
            aria-label={
                ru
                    ? `Срок подписки. Действует до ${dateText}`
                    : `Subscription timeline. Valid until ${dateText}`
            }
            className={classes.timeline}
            data-frost-timeline
            role="img"
        >
            <span className={classes.timelineFill} style={{ width: deadline }} />
            {ticks.map((tick, index) => {
                const date = tick.valueOf()
                let label = labelFormat.format(date).replace(/\.$/, '')
                if (index === 0) label = ru ? 'Сегодня' : 'Today'
                else if (isToday && index === intervals) label = ru ? 'Завтра' : 'Tomorrow'
                else if (unit === 'month' && tick.year() !== today.year())
                    label += ` ’${String(tick.year()).slice(-2)}`
                return (
                    <time
                        className={classes.timelineTick}
                        dateTime={tick.toISOString()}
                        key={date}
                        style={{ left: position(date) }}
                        title={dateFormat.format(date)}
                    >
                        {label}
                    </time>
                )
            })}
            <span
                className={classes.timelineMarker}
                data-frost-expiry-marker
                style={{ left: deadline }}
            />
        </div>
    )
}
