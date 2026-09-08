import { type RefObject, useEffect, useRef } from 'react'

import classes from './obsidian.module.css'

interface Props {
    imageRef: RefObject<HTMLImageElement | null>
    label: string
}

// Shared vertices keep the textured fragments seamless when they reunite.
const SIZE = 600
const random = (seed: number) => {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453
    return value - Math.floor(value)
}
const vertices = Array.from({ length: 49 }, (_, i) => {
    const x = i % 7
    const y = Math.floor(i / 7)
    return [
        x * 100 + (x > 0 && x < 6 ? (random(i) - 0.5) * 65 : 0),
        y * 100 + (y > 0 && y < 6 ? (random(i + 80) - 0.5) * 65 : 0)
    ]
})
const fragments = Array.from({ length: 36 }, (_, i) => {
    const start = Math.floor(i / 6) * 7 + (i % 6)
    return [
        [start, start + 1, start + 7],
        [start + 1, start + 8, start + 7]
    ]
})
    .flat()
    .map((indices, i) => {
        const points = indices.map((index) => vertices[index])
        const x = points.reduce((sum, point) => sum + point[0], 0) / 3
        const y = points.reduce((sum, point) => sum + point[1], 0) / 3
        return {
            points,
            depth: (random(i + 600) - 0.5) * 260,
            tilt: (random(i + 700) - 0.5) * 1.9,
            x,
            y,
            dx: (x - 300) * 0.75,
            dy: (y - 300) * 0.65,
            spin: (random(i + 150) - 0.5) * 2.4
        }
    })

// Cache alpha-masked faces and side walls; transparent image areas stay transparent.
const createTextures = (image: HTMLImageElement) =>
    fragments.map((fragment) => {
        const left = Math.floor(Math.min(...fragment.points.map(([x]) => x))) - 2
        const top = Math.floor(Math.min(...fragment.points.map(([, y]) => y))) - 2
        const width = Math.ceil(Math.max(...fragment.points.map(([x]) => x))) - left + 2
        const height = Math.ceil(Math.max(...fragment.points.map(([, y]) => y))) - top + 2
        const face = document.createElement('canvas')
        face.width = width
        face.height = height
        const ctx = face.getContext('2d')!
        ctx.translate(-left, -top)
        ctx.beginPath()
        fragment.points.forEach(([x, y], index) =>
            index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        )
        ctx.closePath()
        ctx.clip()
        ctx.drawImage(image, 0, 0, SIZE, SIZE)
        const tint = (stops: [number, string][]) => {
            const layer = document.createElement('canvas')
            layer.width = width
            layer.height = height
            const layerContext = layer.getContext('2d')!
            layerContext.drawImage(face, 0, 0)
            layerContext.globalCompositeOperation = 'source-in'
            const gradient = layerContext.createLinearGradient(0, 0, width, height)
            stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
            layerContext.fillStyle = gradient
            layerContext.fillRect(0, 0, width, height)
            return layer
        }
        const side = tint([
            [0, '#b4f9de'],
            [0.18, '#398875'],
            [0.55, '#0a2421'],
            [1, '#020b0d']
        ])
        const light = tint([
            [0, 'rgba(210,255,242,0.85)'],
            [0.5, 'rgba(67,223,177,0.05)'],
            [1, 'rgba(0,12,16,0.9)']
        ])
        return { ...fragment, face, side, light, left, top }
    })

export const CrystalBurst = ({ imageRef, label }: Props) => {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const texturesRef = useRef<null | ReturnType<typeof createTextures>>(null)
    const frameRef = useRef(0)
    const busyRef = useRef(false)
    const stopRef = useRef<() => void>(() => {})

    useEffect(() => {
        const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
        const stop = () => stopRef.current()
        motion.addEventListener('change', stop)
        document.addEventListener('visibilitychange', stop)
        return () => {
            stop()
            motion.removeEventListener('change', stop)
            document.removeEventListener('visibilitychange', stop)
        }
    }, [])

    const burst = () => {
        const image = imageRef.current
        const canvas = canvasRef.current
        const button = buttonRef.current
        if (busyRef.current || !image?.complete || !image.naturalWidth || !canvas || !button) return
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const context = canvas.getContext('2d')
        if (!context) return
        texturesRef.current ??= createTextures(image)
        const textures = [...texturesRef.current].sort((a, b) => a.depth - b.depth)
        busyRef.current = true
        button.dataset.burst = 'active'
        image.style.animationPlayState = 'paused'
        canvas.style.transform = getComputedStyle(image).transform
        canvas.width = Math.min(960, Math.round(button.clientWidth * window.devicePixelRatio * 1.6))
        canvas.height = canvas.width
        image.style.visibility = 'hidden'
        stopRef.current = () => {
            cancelAnimationFrame(frameRef.current)
            busyRef.current = false
            delete button.dataset.burst
            image.style.removeProperty('visibility')
            image.style.removeProperty('animation-play-state')
            context.clearRect(0, 0, canvas.width, canvas.height)
        }
        const started = performance.now()
        const draw = (now: number) => {
            const progress = Math.min(1, (now - started) / 2400)
            let spread = 1
            if (progress < 0.32) spread = 1 - (1 - progress / 0.32) ** 3
            else if (progress >= 0.46)
                spread = ((1 + Math.cos((Math.PI * (progress - 0.46)) / 0.54)) / 2) ** 1.3
            context.resetTransform()
            context.clearRect(0, 0, canvas.width, canvas.height)
            // A larger canvas allows debris to travel without clipping at the crystal bounds.
            context.scale(canvas.width / (SIZE * 1.6), canvas.height / (SIZE * 1.6))
            context.translate(SIZE * 0.3, SIZE * 0.3)
            const pulse = Math.max(0, 1 - progress / 0.22)
            if (pulse > 0) {
                const radius = 45 + (1 - pulse) * 250
                const glow = context.createRadialGradient(300, 290, 0, 300, 290, radius)
                glow.addColorStop(0, `rgba(190,255,229,${pulse * 0.45})`)
                glow.addColorStop(0.25, `rgba(69,235,175,${pulse * 0.22})`)
                glow.addColorStop(1, 'rgba(20,150,110,0)')
                context.fillStyle = glow
                context.fillRect(0, 0, SIZE, SIZE)
                context.strokeStyle = `rgba(137,255,215,${pulse * 0.38})`
                context.lineWidth = 1.5
                context.beginPath()
                context.ellipse(300, 290, radius, radius * 0.62, -0.35, 0, Math.PI * 2)
                context.stroke()
            }
            textures.forEach(
                ({ x, y, dx, dy, spin, depth, tilt, face, side, light, left, top }) => {
                    const perspective = 700 / (700 - depth * spread)
                    const thickness = (4 + Math.abs(tilt) * 8) * spread
                    context.save()
                    context.translate(
                        300 + (x - 300 + dx * spread) * perspective,
                        300 + (y - 300 + dy * spread) * perspective
                    )
                    context.rotate(spin * spread)
                    context.transform(
                        perspective * Math.cos(tilt * spread),
                        Math.sin(tilt * spread) * 0.18,
                        0,
                        perspective,
                        0,
                        0
                    )
                    context.translate(-x, -y)
                    context.globalAlpha = 1 - (Math.max(0, -depth) / 650) * spread
                    // Stacked silhouettes create visible thickness without filling transparent areas.
                    for (let layer = Math.ceil(thickness); layer > 0; layer -= 2) {
                        context.drawImage(side, left + layer * 0.6, top + layer)
                    }
                    context.drawImage(face, left, top)
                    context.globalAlpha *=
                        spread * (0.45 + Math.abs(Math.sin(tilt * spread)) * 0.45)
                    context.drawImage(light, left, top)
                    context.restore()
                }
            )
            context.save()
            context.globalCompositeOperation = 'lighter'
            const dustOpacity = Math.sin(Math.PI * progress) * 0.85
            for (let i = 0; i < 54; i++) {
                const angle = random(i + 300) * Math.PI * 2
                const radius = (90 + random(i + 400) * 190) * spread
                const x = 300 + Math.cos(angle) * radius
                const y = 290 + Math.sin(angle) * radius
                const size = 0.6 + random(i + 500) * 1.8
                const trail = Math.max(0, 1 - progress / 0.38) * (8 + random(i) * 24)
                context.globalAlpha = dustOpacity
                context.strokeStyle = '#66dcb5'
                context.lineWidth = size * 0.65
                context.beginPath()
                context.moveTo(x - Math.cos(angle) * trail, y - Math.sin(angle) * trail)
                context.lineTo(x, y)
                context.stroke()
                context.fillStyle = i % 3 === 0 ? '#dcfff1' : '#61dfb2'
                context.shadowColor = '#4ef5b4'
                context.shadowBlur = i % 3 === 0 ? 8 : 3
                context.beginPath()
                context.arc(x, y, size, 0, Math.PI * 2)
                context.fill()
            }
            context.restore()
            context.globalAlpha = 1
            if (progress < 1) frameRef.current = requestAnimationFrame(draw)
            else stopRef.current()
        }
        frameRef.current = requestAnimationFrame(draw)
    }

    return (
        <button
            aria-label={label}
            className={classes.crystalTrigger}
            onClick={burst}
            ref={buttonRef}
            type="button"
        >
            <canvas aria-hidden className={classes.crystalCanvas} ref={canvasRef} />
        </button>
    )
}
